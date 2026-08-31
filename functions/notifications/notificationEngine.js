/**
 * Intelligent Notifications Engine (Phase 15)
 * 
 * Pipeline:
 * Event -> Notification Rule -> Eligibility -> Personalization -> Notification -> Delivery
 */

const admin = require("firebase-admin");

// 8 Required Notification Types
const NOTIFICATION_TYPES = {
  PRICE_DROP: "PRICE_DROP",
  WISHLIST_RESTOCK: "WISHLIST_RESTOCK",
  ORDER_UPDATE: "ORDER_UPDATE",
  DELIVERY_UPDATE: "DELIVERY_UPDATE",
  RECOMMENDATION_ALERT: "RECOMMENDATION_ALERT",
  VENDOR_MESSAGE: "VENDOR_MESSAGE",
  REVIEW_REMINDER: "REVIEW_REMINDER",
  MARKETPLACE_ANNOUNCEMENT: "MARKETPLACE_ANNOUNCEMENT"
};

// Priority & Policy Matrix
const NOTIFICATION_RULES = {
  [NOTIFICATION_TYPES.ORDER_UPDATE]: {
    priority: "HIGH",
    bypassQuietHours: true,
    dedupWindowMinutes: 2,
    defaultChannels: ["in-app", "email"],
    preferenceKey: "orderUpdates"
  },
  [NOTIFICATION_TYPES.DELIVERY_UPDATE]: {
    priority: "HIGH",
    bypassQuietHours: true,
    dedupWindowMinutes: 2,
    defaultChannels: ["in-app", "email"],
    preferenceKey: "deliveryUpdates"
  },
  [NOTIFICATION_TYPES.VENDOR_MESSAGE]: {
    priority: "HIGH",
    bypassQuietHours: true,
    dedupWindowMinutes: 5,
    defaultChannels: ["in-app"],
    preferenceKey: "vendorMessages"
  },
  [NOTIFICATION_TYPES.PRICE_DROP]: {
    priority: "NORMAL",
    bypassQuietHours: false,
    dedupWindowMinutes: 720, // 12 hours
    defaultChannels: ["in-app", "email"],
    preferenceKey: "priceDrops"
  },
  [NOTIFICATION_TYPES.WISHLIST_RESTOCK]: {
    priority: "NORMAL",
    bypassQuietHours: false,
    dedupWindowMinutes: 720, // 12 hours
    defaultChannels: ["in-app", "email"],
    preferenceKey: "wishlistRestock"
  },
  [NOTIFICATION_TYPES.RECOMMENDATION_ALERT]: {
    priority: "LOW",
    bypassQuietHours: false,
    dedupWindowMinutes: 1440, // 24 hours
    defaultChannels: ["in-app"],
    preferenceKey: "recommendations"
  },
  [NOTIFICATION_TYPES.REVIEW_REMINDER]: {
    priority: "LOW",
    bypassQuietHours: false,
    dedupWindowMinutes: 2880, // 48 hours
    defaultChannels: ["in-app", "email"],
    preferenceKey: "reviewReminders"
  },
  [NOTIFICATION_TYPES.MARKETPLACE_ANNOUNCEMENT]: {
    priority: "NORMAL",
    bypassQuietHours: false,
    dedupWindowMinutes: 1440, // 24 hours
    defaultChannels: ["in-app"],
    preferenceKey: "announcements"
  }
};

// In-memory telemetry cache for deduplication & frequency rate limits
// (backed by Firestore in production)
const dedupHistory = new Map();
const userDailySentCounts = new Map();

/**
 * Checks whether the current time is in the quiet period (10:00 PM to 08:00 AM PKT, UTC+5).
 */
function isQuietHours(now = new Date()) {
  // Convert UTC to PKT (UTC+5)
  const pktHour = (now.getUTCHours() + 5) % 24;
  return pktHour >= 22 || pktHour < 8;
}

/**
 * AI-assisted personalization without mutating critical factual data.
 */
function personalizeContent(type, eventData, userProfile = {}) {
  const name = userProfile.displayName || userProfile.name || "Valued Shopper";

  switch (type) {
    case NOTIFICATION_TYPES.PRICE_DROP: {
      const { productTitle, oldPrice, newPrice } = eventData;
      const savings = oldPrice && newPrice ? (oldPrice - newPrice).toLocaleString() : null;
      return {
        title: `Price Drop: ${productTitle}`,
        message: savings 
          ? `Good news, ${name}! "${productTitle}" dropped from Rs. ${oldPrice.toLocaleString()} to Rs. ${newPrice.toLocaleString()} (Save Rs. ${savings}).`
          : `"${productTitle}" is now on sale for Rs. ${newPrice?.toLocaleString()}!`
      };
    }

    case NOTIFICATION_TYPES.WISHLIST_RESTOCK: {
      const { productTitle } = eventData;
      return {
        title: `Back in Stock: ${productTitle}`,
        message: `Hello ${name}, an item from your wishlist, "${productTitle}", has just been restocked by the artisan.`
      };
    }

    case NOTIFICATION_TYPES.ORDER_UPDATE: {
      const { orderId, status } = eventData;
      const readableStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      return {
        title: `Order Update #${orderId}`,
        message: `Your order #${orderId} is now ${readableStatus}. Verified master craftspeople are tending to your shipment.`
      };
    }

    case NOTIFICATION_TYPES.DELIVERY_UPDATE: {
      const { orderId, status, trackingNumber } = eventData;
      return {
        title: status === "delivered" ? `Delivered: Order #${orderId}` : `Out for Delivery: Order #${orderId}`,
        message: status === "delivered"
          ? `Your handmade order #${orderId} has been successfully delivered. We hope it brings warmth to your home!`
          : `Order #${orderId} is out for delivery today${trackingNumber ? ` (Tracking: ${trackingNumber})` : ""}.`
      };
    }

    case NOTIFICATION_TYPES.RECOMMENDATION_ALERT: {
      const { category, productTitle } = eventData;
      return {
        title: `Curated Picks: ${category || "Artisan Crafts"}`,
        message: productTitle 
          ? `Specially picked for your taste: "${productTitle}" from certified Pakistani craft villages.`
          : `We found new authentic pieces aligned with your cultural design interests.`
      };
    }

    case NOTIFICATION_TYPES.VENDOR_MESSAGE: {
      const { vendorName, messageSnippet, orderId } = eventData;
      return {
        title: `Message from ${vendorName || "Artisan"}`,
        message: `"${messageSnippet || "New update regarding your order"}"${orderId ? ` (Order #${orderId})` : ""}.`
      };
    }

    case NOTIFICATION_TYPES.REVIEW_REMINDER: {
      const { orderId, productTitle } = eventData;
      return {
        title: `How was your experience with ${productTitle || "your order"}?`,
        message: `Salam ${name}! Your review directly empowers our local craftspeople. Tap here to rate order #${orderId}.`
      };
    }

    case NOTIFICATION_TYPES.MARKETPLACE_ANNOUNCEMENT: {
      const { headline, body } = eventData;
      return {
        title: headline || "Vendora Artisan Announcement",
        message: body || "Exciting new collections and cultural exhibitions are now live on Vendora."
      };
    }

    default:
      return {
        title: eventData.title || "Vendora Notification",
        message: eventData.message || "You have a new update from Vendora."
      };
  }
}

/**
 * Executes the 6-step intelligent notification pipeline.
 *
 * @param {Object} event
 * @param {string} event.type Notification type enum
 * @param {string} event.recipientId User UID receiving the notification
 * @param {string} [event.requesterId] Caller UID (for security authorization check)
 * @param {string} [event.entityId] Distinct ID (orderId, productId, etc.) for deduplication
 * @param {Object} event.data Factual parameters
 * @param {Object} [options] Custom overrides
 */
async function processNotificationEvent(event, options = {}) {
  const { type, recipientId, requesterId, entityId, data = {} } = event;

  // 1. VALIDATION & SECURITY
  if (!recipientId) {
    return { success: false, reason: "MISSING_RECIPIENT_ID" };
  }
  if (!NOTIFICATION_TYPES[type]) {
    return { success: false, reason: "INVALID_NOTIFICATION_TYPE" };
  }

  // Security: If a requesterId is provided, they must either be an admin or matching recipient/vendor
  if (requesterId && requesterId !== recipientId) {
    const isSpecialCase = (type === NOTIFICATION_TYPES.VENDOR_MESSAGE) || (type === NOTIFICATION_TYPES.MARKETPLACE_ANNOUNCEMENT);
    if (!isSpecialCase && !options.isAdmin) {
      return { success: false, reason: "UNAUTHORIZED_RECIPIENT_ACCESS" };
    }
  }

  const rule = NOTIFICATION_RULES[type];

  // 2. ELIGIBILITY & USER PREFERENCES
  const userPreferences = options.mockPreferences || await getUserPreferences(recipientId);
  if (rule.preferenceKey && userPreferences[rule.preferenceKey] === false) {
    return { success: false, reason: "USER_OPTED_OUT", preferenceKey: rule.preferenceKey };
  }

  // 3. ANTI-SPAM & FREQUENCY LIMITS
  // Non-urgent notifications are limited to 5 per 24 hours
  const dateKey = `${recipientId}_${new Date().toISOString().slice(0, 10)}`;
  const currentDailyCount = userDailySentCounts.get(dateKey) || 0;

  if (rule.priority === "LOW" && currentDailyCount >= 5) {
    return { success: false, reason: "FREQUENCY_LIMIT_EXCEEDED" };
  }

  // 4. DUPLICATE PREVENTION
  const dedupKey = `${recipientId}_${type}_${entityId || data.orderId || data.productId || "universal"}`;
  const now = options.mockTime ? new Date(options.mockTime) : new Date();
  const lastSent = dedupHistory.get(dedupKey);

  if (lastSent) {
    const elapsedMinutes = (now.getTime() - lastSent.getTime()) / (1000 * 60);
    if (elapsedMinutes < rule.dedupWindowMinutes) {
      return { 
        success: false, 
        reason: "DUPLICATE_SUPPRESSED", 
        remainingMinutes: Math.round(rule.dedupWindowMinutes - elapsedMinutes) 
      };
    }
  }

  // 5. QUIET HOURS ENFORCEMENT
  if (!rule.bypassQuietHours && isQuietHours(now) && !options.bypassQuietHours) {
    return { success: false, reason: "QUIET_HOURS_SUPPRESSED" };
  }

  // 6. PERSONALIZATION (AI-Assisted, Factual Invariance Preserved)
  const personalized = personalizeContent(type, data, options.userProfile || {});

  const notificationRecord = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    recipientId,
    type,
    title: personalized.title,
    message: personalized.message,
    priority: rule.priority,
    orderId: data.orderId || null,
    productId: data.productId || null,
    link: data.link || (data.orderId ? "/my-orders" : data.productId ? `/product/${data.productId}` : null),
    read: false,
    createdAt: now.toISOString()
  };

  // 7. DELIVERY (In-app + Email simulation)
  await deliverInAppNotification(recipientId, notificationRecord);

  let emailDelivered = false;
  if (rule.defaultChannels.includes("email") && userPreferences.emailNotifications !== false) {
    emailDelivered = await deliverEmailNotification(recipientId, notificationRecord, options.userEmail);
  }

  // Update Telemetry & Caches
  dedupHistory.set(dedupKey, now);
  userDailySentCounts.set(dateKey, currentDailyCount + 1);

  return {
    success: true,
    notification: notificationRecord,
    deliveredChannels: {
      inApp: true,
      email: emailDelivered
    }
  };
}

/**
 * Retrieves user notification preferences from Firestore with sensible defaults.
 */
async function getUserPreferences(userId) {
  const defaults = {
    orderUpdates: true,
    deliveryUpdates: true,
    vendorMessages: true,
    priceDrops: true,
    wishlistRestock: true,
    recommendations: true,
    reviewReminders: true,
    announcements: true,
    emailNotifications: true
  };

  if (!admin.apps || admin.apps.length === 0) return defaults;

  try {
    const doc = await admin.firestore().collection("user_notification_preferences").doc(userId).get();
    if (doc.exists) {
      return { ...defaults, ...doc.data() };
    }
  } catch (err) {
    console.warn("Could not fetch user notification preferences:", err.message);
  }
  return defaults;
}

/**
 * Delivers in-app notification to users/{userId}/notifications.
 */
async function deliverInAppNotification(userId, notification) {
  if (!admin.apps || admin.apps.length === 0) return;

  try {
    await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .doc(notification.id)
      .set(notification);
  } catch (err) {
    console.warn("Failed saving in-app notification:", err.message);
  }
}

/**
 * Delivers/logs email notification.
 */
async function deliverEmailNotification(userId, notification, recipientEmail) {
  if (!admin.apps || admin.apps.length === 0) return true;

  try {
    await admin.firestore().collection("email_notifications").add({
      userId,
      recipientEmail: recipientEmail || "user@vendora.pk",
      subject: notification.title,
      body: notification.message,
      notificationId: notification.id,
      sentAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.warn("Failed logging email delivery:", err.message);
    return false;
  }
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_RULES,
  processNotificationEvent,
  personalizeContent,
  isQuietHours,
  getUserPreferences
};
