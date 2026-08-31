const admin = require("firebase-admin");

/**
 * Generates personalized or popular product recommendations for a user.
 * @param {Object} params
 * @param {string} params.userId Current user ID (could be 'anonymous')
 * @param {number} params.limit Number of recommendations to return
 * @returns {Promise<Array<Object>>} List of recommended products
 */
async function getRecommendations({ userId, limit = 5 }) {
  const db = admin.firestore();
  
  // 1. Load products
  const productsSnap = await db.collection("products").limit(100).get();
  const products = [];
  productsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

  if (products.length === 0) {
    return [];
  }

  // 2. Fetch User Interaction Preferences (if authenticated)
  let categoryPreferences = {};
  let vendorPreferences = {};

  if (userId && userId !== "anonymous") {
    try {
      const eventsSnap = await db.collection("user_events")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      eventsSnap.forEach(docSnap => {
        const ev = docSnap.data();
        if (ev.category) {
          categoryPreferences[ev.category] = (categoryPreferences[ev.category] || 0) + 1;
        }
        if (ev.vendorId) {
          vendorPreferences[ev.vendorId] = (vendorPreferences[ev.vendorId] || 0) + 1;
        }
      });
    } catch (e) {
      console.warn("Could not retrieve user events for recommendations personalization:", e);
    }
  }

  // 3. Score products
  const scoredProducts = await Promise.all(products.map(async (pd) => {
    let score = 0;

    // A. Rating Boost: rating is usually 1-5, add directly to score
    score += (pd.rating || 4.0);

    // B. Popularity Boost: we can boost by stock levels (having stock is positive)
    if (pd.stock > 0) score += 2;

    // C. User Personalization Boosts
    if (pd.category && categoryPreferences[pd.category]) {
      score += categoryPreferences[pd.category] * 3; // Boost matching category views
    }
    if (pd.vendorId && vendorPreferences[pd.vendorId]) {
      score += vendorPreferences[pd.vendorId] * 2; // Boost matching vendor views
    }

    // D. Vendor Trust Score Boost
    try {
      const trustSnap = await db.collection("trust_scores").doc(pd.vendorId).get();
      if (trustSnap.exists) {
        const trust = trustSnap.data();
        // Add trust score scaled (e.g. 95 trust = +4.75 points)
        score += (trust.score || 80) / 20;
      } else {
        score += 4; // Default trust boost
      }
    } catch (e) {
      score += 4;
    }

    // E. Vendor Risk Score Penalty (trusted vendor can temporarily have critical risk due to velocity)
    try {
      const riskSnap = await db.collection("risk_scores").doc(pd.vendorId).get();
      if (riskSnap.exists) {
        const risk = riskSnap.data();
        if (risk.level === "CRITICAL") {
          score -= 10; // Major penalty for critical risk
        } else if (risk.level === "HIGH") {
          score -= 5;
        }
      }
    } catch (e) {}

    return { ...pd, recScore: score };
  }));

  // Sort descending by calculated recommendation score
  scoredProducts.sort((a, b) => b.recScore - a.recScore);

  return scoredProducts.slice(0, limit);
}

module.exports = {
  getRecommendations
};
