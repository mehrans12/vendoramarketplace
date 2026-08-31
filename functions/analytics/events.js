const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const ALLOWED_EVENT_TYPES = new Set([
  // Core commerce events
  "PRODUCT_VIEW",
  "PRODUCT_SEARCH",
  "PRODUCT_CLICK",
  "CATEGORY_VIEW",
  "WISHLIST_ADD",
  "WISHLIST_REMOVE",
  "CART_ADD",
  "CART_REMOVE",
  "CHECKOUT_START",
  "CHECKOUT_STARTED",  // legacy alias
  "PURCHASE",
  "ORDER_CREATED",
  "ORDER_CANCELLED",
  "ORDER_DELIVERED",
  "REFUND_REQUESTED",
  "REVIEW_SUBMITTED",
  "REVIEW_CREATED",   // legacy alias
  // Auth & security events
  "LOGIN",
  "LOGOUT",
  "DEVICE_SEEN",
  "SECURITY_EVENT",
  // Recommendation tracking events (Phase 2)
  "RECOMMENDATION_IMPRESSION",
  "RECOMMENDATION_CLICK",
  "RECOMMENDATION_PURCHASE",
  // AI assistant tracking events (Phase 3)
  "AI_ASSISTANT_OPEN",
  "AI_QUERY",
  "AI_SEARCH",
  "AI_RECOMMENDATION",
  "AI_PRODUCT_CLICK",
  "AI_COMPARISON",
  "AI_ORDER_QUERY",
  "AI_ERROR"
]);

/**
 * Validates and logs a marketplace event to firestore under user_events or search_events.
 * @param {Object} eventData
 * @param {string} eventData.userId
 * @param {string} eventData.sessionId
 * @param {string} eventData.eventType
 * @param {string} [eventData.productId]
 * @param {string} [eventData.vendorId]
 * @param {string} [eventData.category]
 * @param {Object} [eventData.metadata]
 * @returns {Promise<Object>} The written event object or error details
 */
async function trackMarketplaceEvent(eventData) {
  const db = admin.firestore();
  
  if (!eventData || typeof eventData !== 'object') {
    throw new Error("Invalid event data payload.");
  }

  const {
    userId = null,
    sessionId = null,
    eventType,
    productId = null,
    vendorId = null,
    category = null,
    metadata = {}
  } = eventData;

  // 1. Validation checks
  if (!eventType || typeof eventType !== 'string') {
    throw new Error("Event type is required and must be a string.");
  }

  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new Error(`Event type '${eventType}' is not recognized.`);
  }

  if (userId && typeof userId !== 'string') {
    throw new Error("userId must be a string or null.");
  }

  if (sessionId && typeof sessionId !== 'string') {
    throw new Error("sessionId must be a string or null.");
  }

  // 2. Sanitization
  // Sanitizing metadata by ensuring no nested fields have arbitrary length, and filter out functions
  const sanitizedMetadata = {};
  if (metadata && typeof metadata === 'object') {
    for (const [key, val] of Object.entries(metadata)) {
      if (typeof val === 'function') continue;
      // Do not store passwords, raw tokens, or payment credentials
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') || 
        lowerKey.includes('token') || 
        lowerKey.includes('card') || 
        lowerKey.includes('cvv') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('secret')
      ) {
        continue;
      }
      
      // Limit value size
      if (typeof val === 'string') {
        sanitizedMetadata[key] = val.substring(0, 1000); // Truncate extremely long strings
      } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
        sanitizedMetadata[key] = val;
      } else if (typeof val === 'object') {
        // Flat string representation for objects
        sanitizedMetadata[key] = JSON.stringify(val).substring(0, 1000);
      }
    }
  }

  const eventId = `evt-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const collectionName = eventType === "PRODUCT_SEARCH" ? "search_events" : "user_events";
  
  const eventDoc = {
    eventId,
    userId: userId || null,
    sessionId: sessionId || null,
    eventType,
    productId: productId || null,
    vendorId: vendorId || null,
    category: category || null,
    metadata: sanitizedMetadata,
    createdAt: FieldValue.serverTimestamp()
  };

  await db.collection(collectionName).doc(eventId).set(eventDoc);

  return { success: true, eventId };
}

module.exports = {
  trackMarketplaceEvent,
  ALLOWED_EVENT_TYPES
};
