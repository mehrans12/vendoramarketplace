/**
 * Recommendation Candidate Generator — Phase 2
 *
 * Fetches raw product candidates from Firestore using multiple strategies:
 *   1. Category-preference matched products
 *   2. Recently interacted product siblings
 *   3. Trending products (high view/cart velocity)
 *   4. Popular products (high rating + review count)
 *   5. New arrivals (freshness)
 *
 * Filters:
 *   - Removes out-of-stock / deactivated / deleted products
 *   - Removes already-purchased products (for PRODUCT_PAGE / CART contexts)
 *   - Deduplicates by productId
 */

const admin = require("firebase-admin");

/**
 * Retrieves candidate products for recommendation.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.context]         HOME|PRODUCT_PAGE|CATEGORY_PAGE|CART|SEARCH
 * @param {string} [params.seedProductId]   Anchor product (for PRODUCT_PAGE / similarity)
 * @param {string} [params.categoryId]      Anchor category (for CATEGORY_PAGE)
 * @param {Object} [params.preferences]     User preferences object from preferenceEngine
 * @param {number} [params.limit=40]        Max candidates before ranking
 * @returns {Promise<Array<Object>>}
 */
async function getCandidates({
  userId,
  context = "HOME",
  seedProductId = null,
  categoryId = null,
  preferences = null,
  limit = 40
}) {
  const db = admin.firestore();
  const candidateMap = new Map(); // productId → product object

  // ── Helper: add a product to the candidate pool ──────────────────────────
  const addCandidate = (product, source) => {
    if (!product?.id) return;
    if (product.status === "inactive" || product.status === "deleted") return;
    if (product.stock !== undefined && product.stock <= 0) return;
    if (!candidateMap.has(product.id)) {
      candidateMap.set(product.id, { ...product, _sources: [source] });
    } else {
      candidateMap.get(product.id)._sources.push(source);
    }
  };

  // ── Determine which product IDs user has already purchased ───────────────
  const purchasedProductIds = new Set();
  if (userId && userId !== "anonymous" && context !== "HOME") {
    try {
      const ordersSnap = await db
        .collection("orders")
        .where("buyerId", "==", userId)
        .where("status", "in", ["delivered", "shipped"])
        .limit(50)
        .get();
      ordersSnap.forEach((d) => {
        (d.data().items || []).forEach((item) => {
          if (item.productId) purchasedProductIds.add(item.productId);
        });
      });
    } catch (e) {
      console.warn("Could not load purchase history for candidate filtering:", e.message);
    }
  }

  const fetchPromises = [];

  // ── Strategy 1: Category preference matching ─────────────────────────────
  const topCategories = preferences?.categories
    ? Object.entries(preferences.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat)
    : [];

  if (topCategories.length > 0) {
    fetchPromises.push(
      (async () => {
        for (const cat of topCategories) {
          try {
            const snap = await db
              .collection("products")
              .where("category", "==", cat)
              .where("status", "!=", "inactive")
              .limit(12)
              .get();
            snap.forEach((d) => addCandidate({ id: d.id, ...d.data() }, "category_preference"));
          } catch (e) {
            console.warn(`Category preference fetch failed for ${cat}:`, e.message);
          }
        }
      })()
    );
  }

  // ── Strategy 2: Anchor category (CATEGORY_PAGE context) ──────────────────
  if (categoryId) {
    fetchPromises.push(
      (async () => {
        try {
          const snap = await db
            .collection("products")
            .where("category", "==", categoryId)
            .limit(15)
            .get();
          snap.forEach((d) => addCandidate({ id: d.id, ...d.data() }, "anchor_category"));
        } catch (e) {
          console.warn("Anchor category fetch failed:", e.message);
        }
      })()
    );
  }

  // ── Strategy 3: Sibling products of seed (PRODUCT_PAGE context) ──────────
  if (seedProductId) {
    fetchPromises.push(
      (async () => {
        try {
          const seedSnap = await db.collection("products").doc(seedProductId).get();
          if (seedSnap.exists) {
            const seedData = seedSnap.data();
            const siblingSnap = await db
              .collection("products")
              .where("category", "==", seedData.category)
              .limit(15)
              .get();
            siblingSnap.forEach((d) => {
              if (d.id !== seedProductId) {
                addCandidate({ id: d.id, ...d.data() }, "sibling_category");
              }
            });
          }
        } catch (e) {
          console.warn("Sibling product fetch failed:", e.message);
        }
      })()
    );
  }

  // ── Strategy 4: Trending (recently added to carts across the platform) ────
  fetchPromises.push(
    (async () => {
      try {
        const trendSnap = await db
          .collection("user_events")
          .where("eventType", "in", ["CART_ADD", "WISHLIST_ADD"])
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();

        const productFreq = {};
        trendSnap.forEach((d) => {
          const { productId } = d.data();
          if (productId) productFreq[productId] = (productFreq[productId] || 0) + 1;
        });

        const trendingIds = Object.entries(productFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id]) => id);

        for (const pid of trendingIds) {
          try {
            const snap = await db.collection("products").doc(pid).get();
            if (snap.exists) addCandidate({ id: snap.id, ...snap.data() }, "trending");
          } catch (e) {}
        }
      } catch (e) {
        console.warn("Trending fetch failed:", e.message);
      }
    })()
  );

  // ── Strategy 5: Popular (high rating) ────────────────────────────────────
  fetchPromises.push(
    (async () => {
      try {
        const snap = await db
          .collection("products")
          .orderBy("rating", "desc")
          .limit(15)
          .get();
        snap.forEach((d) => addCandidate({ id: d.id, ...d.data() }, "popular"));
      } catch (e) {
        console.warn("Popular products fetch failed:", e.message);
      }
    })()
  );

  // ── Strategy 6: New arrivals ──────────────────────────────────────────────
  fetchPromises.push(
    (async () => {
      try {
        const snap = await db
          .collection("products")
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
        snap.forEach((d) => addCandidate({ id: d.id, ...d.data() }, "new_arrival"));
      } catch (e) {
        console.warn("New arrivals fetch failed:", e.message);
      }
    })()
  );

  await Promise.allSettled(fetchPromises);

  // ── Final filtering ───────────────────────────────────────────────────────
  let candidates = Array.from(candidateMap.values());

  // Remove seed product itself from suggestions
  if (seedProductId) {
    candidates = candidates.filter((p) => p.id !== seedProductId);
  }

  // Remove purchased products (for non-HOME contexts)
  if (purchasedProductIds.size > 0 && context !== "HOME") {
    candidates = candidates.filter((p) => !purchasedProductIds.has(p.id));
  }

  return candidates.slice(0, limit);
}

module.exports = { getCandidates };
