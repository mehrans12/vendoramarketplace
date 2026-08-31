/**
 * Preference Engine — Phase 2
 *
 * Aggregates user_events documents into a weighted preference profile
 * stored at user_preferences/{userId}.
 *
 * Weight table (higher = stronger signal):
 *   PURCHASE          10.0
 *   CART_ADD           5.0
 *   WISHLIST_ADD       3.0
 *   PRODUCT_VIEW       1.5
 *   PRODUCT_CLICK      1.0
 *   PRODUCT_SEARCH     1.0
 *   CATEGORY_VIEW      0.5
 */

const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const EVENT_WEIGHTS = {
  PURCHASE: 10.0,
  CART_ADD: 5.0,
  WISHLIST_ADD: 3.0,
  REVIEW_SUBMITTED: 3.0,
  PRODUCT_VIEW: 1.5,
  PRODUCT_CLICK: 1.0,
  PRODUCT_SEARCH: 1.0,
  CATEGORY_VIEW: 0.5,
  WISHLIST_REMOVE: -2.0,
  CART_REMOVE: -1.5,
  ORDER_CANCELLED: -5.0
};

/**
 * Normalises a raw score map so values are in [0,1].
 * @param {Object<string,number>} scores
 * @returns {Object<string,number>}
 */
function normalizeScores(scores) {
  const max = Math.max(...Object.values(scores), 1);
  const result = {};
  for (const [k, v] of Object.entries(scores)) {
    result[k] = parseFloat(Math.max(0, v / max).toFixed(4));
  }
  return result;
}

/**
 * Builds or refreshes the preference profile for a given user.
 *
 * Reads the last 200 events from user_events for this user/anonymousId,
 * aggregates weighted signals, and writes to user_preferences/{userId}.
 *
 * @param {string} userId   Firestore user UID or anonymousId
 * @returns {Promise<Object>} The saved preference document
 */
async function buildUserPreferences(userId) {
  if (!userId) throw new Error("userId is required.");

  const db = admin.firestore();

  // Fetch the most recent 200 events for this user
  const eventsSnap = await db
    .collection("user_events")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const categoryScores = {};
  const productScores = {};
  const pricePoints = [];

  eventsSnap.forEach((docSnap) => {
    const ev = docSnap.data();
    const weight = EVENT_WEIGHTS[ev.eventType] ?? 0;
    if (weight === 0) return;

    // Accumulate category signals
    if (ev.category) {
      categoryScores[ev.category] = (categoryScores[ev.category] || 0) + weight;
    }

    // Accumulate product signals
    if (ev.productId) {
      productScores[ev.productId] = (productScores[ev.productId] || 0) + weight;
    }

    // Accumulate price range signals
    if (ev.metadata?.price && typeof ev.metadata.price === "number") {
      pricePoints.push(ev.metadata.price);
    }
  });

  // Determine price range from observed interactions
  let priceRange = { min: 0, max: 100000 };
  if (pricePoints.length > 0) {
    const sorted = [...pricePoints].sort((a, b) => a - b);
    // Use 10th-percentile as min and 90th-percentile as max (robust to outliers)
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    priceRange = { min: Math.floor(p10), max: Math.ceil(p90) };
  }

  const preferences = {
    userId,
    categories: normalizeScores(categoryScores),
    productInterests: normalizeScores(productScores),
    priceRange,
    eventCount: eventsSnap.size,
    updatedAt: FieldValue.serverTimestamp()
  };

  await db
    .collection("user_preferences")
    .doc(userId)
    .set(preferences, { merge: true });

  return preferences;
}

/**
 * Reads (and optionally refreshes) a preference profile from Firestore.
 * Refreshes automatically if older than 6 hours.
 *
 * @param {string} userId
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object|null>}
 */
async function getUserPreferences(userId, forceRefresh = false) {
  if (!userId) return null;

  const db = admin.firestore();
  const prefRef = db.collection("user_preferences").doc(userId);
  const prefSnap = await prefRef.get();

  if (!prefSnap.exists || forceRefresh) {
    return buildUserPreferences(userId);
  }

  const data = prefSnap.data();

  // Auto-refresh if stale (> 6 hours)
  const updatedAt = data.updatedAt?.toMillis?.() ?? 0;
  const sixHoursMs = 6 * 60 * 60 * 1000;
  if (Date.now() - updatedAt > sixHoursMs) {
    // Async refresh (don't block request)
    buildUserPreferences(userId).catch((err) =>
      console.warn("Background preference refresh failed:", err.message)
    );
  }

  return data;
}

module.exports = { buildUserPreferences, getUserPreferences };
