/**
 * Client Notification Service (Phase 15: Intelligent Notifications)
 */
import { hasFirebaseKeys, app, db } from '../firebase';

export const NOTIFICATION_TYPES = {
  PRICE_DROP: "PRICE_DROP",
  WISHLIST_RESTOCK: "WISHLIST_RESTOCK",
  ORDER_UPDATE: "ORDER_UPDATE",
  DELIVERY_UPDATE: "DELIVERY_UPDATE",
  RECOMMENDATION_ALERT: "RECOMMENDATION_ALERT",
  VENDOR_MESSAGE: "VENDOR_MESSAGE",
  REVIEW_REMINDER: "REVIEW_REMINDER",
  MARKETPLACE_ANNOUNCEMENT: "MARKETPLACE_ANNOUNCEMENT"
};

export const DEFAULT_PREFERENCES = {
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

export async function fetchUserPreferences(userId) {
  if (!userId) return DEFAULT_PREFERENCES;

  if (!hasFirebaseKeys) {
    try {
      const stored = localStorage.getItem(`vendora_notif_prefs_${userId}`);
      return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    } catch (e) {
      return DEFAULT_PREFERENCES;
    }
  }

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'user_notification_preferences', userId));
    if (snap.exists()) {
      return { ...DEFAULT_PREFERENCES, ...snap.data() };
    }
  } catch (err) {
    console.warn("Could not fetch remote notification preferences:", err);
  }
  return DEFAULT_PREFERENCES;
}

export async function saveUserPreferences(userId, newPreferences) {
  if (!userId) return false;

  const merged = { ...DEFAULT_PREFERENCES, ...newPreferences };

  try {
    localStorage.setItem(`vendora_notif_prefs_${userId}`, JSON.stringify(merged));
  } catch (e) {}

  if (hasFirebaseKeys) {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'user_notification_preferences', userId), merged, { merge: true });
      return true;
    } catch (err) {
      console.warn("Could not save remote notification preferences:", err);
    }
  }
  return true;
}

export async function dispatchIntelligentNotification({
  type,
  recipientId,
  entityId = null,
  data = {}
}) {
  if (!recipientId || !type) return { success: false, reason: "INVALID_PARAMETERS" };

  if (hasFirebaseKeys) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'sendIntelligentNotification');
      const res = await fn({ type, recipientId, entityId, data });
      return res.data;
    } catch (err) {
      console.warn("Remote notification dispatch failed, falling back to local:", err.message);
    }
  }

  // Local / offline fallback pipeline
  const prefs = await fetchUserPreferences(recipientId);

  // Preference check
  const prefKeyMap = {
    PRICE_DROP: 'priceDrops',
    WISHLIST_RESTOCK: 'wishlistRestock',
    ORDER_UPDATE: 'orderUpdates',
    DELIVERY_UPDATE: 'deliveryUpdates',
    RECOMMENDATION_ALERT: 'recommendations',
    VENDOR_MESSAGE: 'vendorMessages',
    REVIEW_REMINDER: 'reviewReminders',
    MARKETPLACE_ANNOUNCEMENT: 'announcements'
  };

  const requiredPref = prefKeyMap[type];
  if (requiredPref && prefs[requiredPref] === false) {
    return { success: false, reason: "USER_OPTED_OUT" };
  }

  // Generate localized, non-mutating copy
  const notification = formatLocalNotification(type, data, recipientId);

  // Persist to local storage notifications feed
  try {
    const key = `vendora_notifs_${recipientId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift(notification);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {}

  return {
    success: true,
    notification,
    deliveredChannels: {
      inApp: true,
      email: prefs.emailNotifications !== false
    }
  };
}

function formatLocalNotification(type, data, recipientId) {
  let title = "Vendora Notification";
  let message = "You have an update.";
  let link = data.link || null;

  switch (type) {
    case NOTIFICATION_TYPES.PRICE_DROP:
      title = `Price Drop: ${data.productTitle || 'Item in Wishlist'}`;
      message = data.oldPrice && data.newPrice
        ? `"${data.productTitle}" dropped from Rs. ${data.oldPrice.toLocaleString()} to Rs. ${data.newPrice.toLocaleString()}!`
        : `"${data.productTitle}" is now on sale!`;
      link = data.productId ? `/product/${data.productId}` : null;
      break;

    case NOTIFICATION_TYPES.WISHLIST_RESTOCK:
      title = `Back in Stock: ${data.productTitle || 'Artisan Piece'}`;
      message = `"${data.productTitle || 'An item'}" from your wishlist is now restocked!`;
      link = data.productId ? `/product/${data.productId}` : null;
      break;

    case NOTIFICATION_TYPES.ORDER_UPDATE:
      title = `Order #${data.orderId} Update`;
      message = `Your order is now ${data.status || 'in progress'}.`;
      link = '/my-orders';
      break;

    case NOTIFICATION_TYPES.DELIVERY_UPDATE:
      title = data.status === 'delivered' ? `Delivered: Order #${data.orderId}` : `Out for Delivery: #${data.orderId}`;
      message = data.status === 'delivered' 
        ? `Your package has been safely delivered. Enjoy your handcrafted piece!`
        : `Package is with the courier for delivery today.`;
      link = '/my-orders';
      break;

    case NOTIFICATION_TYPES.RECOMMENDATION_ALERT:
      title = `Curated for You: ${data.category || 'Handicrafts'}`;
      message = data.productTitle
        ? `We think you'll love "${data.productTitle}" based on your style tastes.`
        : `New authentic items added matching your recent interests.`;
      link = data.productId ? `/product/${data.productId}` : '/category/all';
      break;

    case NOTIFICATION_TYPES.VENDOR_MESSAGE:
      title = `Message from ${data.vendorName || 'Artisan'}`;
      message = `"${data.messageSnippet || 'Update regarding your order'}"`;
      link = '/my-orders';
      break;

    case NOTIFICATION_TYPES.REVIEW_REMINDER:
      title = `Rate your experience`;
      message = `How do you like your ${data.productTitle || 'recent order'}? Tap to leave a quick review.`;
      link = '/my-orders';
      break;

    case NOTIFICATION_TYPES.MARKETPLACE_ANNOUNCEMENT:
      title = data.headline || "Vendora Artisan Fair Announcement";
      message = data.body || "Explore our spring master artisan exhibition now live!";
      link = data.link || '/category/all';
      break;
  }

  return {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientId,
    type,
    title,
    message,
    orderId: data.orderId || null,
    productId: data.productId || null,
    link,
    read: false,
    createdAt: new Date().toISOString()
  };
}
