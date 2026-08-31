/**
 * Recommendation Orchestrator — Phase 2
 *
 * Unified entry point that:
 *   1. Resolves user preference profile
 *   2. Generates multi-strategy candidate pool
 *   3. Scores similarity (with seed product if available)
 *   4. Ranks via hybrid scoring
 *   5. Applies cold-start fallback when interaction data is insufficient
 *   6. Generates concise AI explanations using Gemini
 *   7. Caches results in recommendations/{userId}/{context}
 *   8. Returns structured RecommendationResult objects
 */

const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { getUserPreferences } = require("./preferenceEngine");
const { getCandidates } = require("./candidates");
const { scoreSimilarity } = require("./similarity");
const { rankCandidates } = require("./ranking");

// Minimum interaction events before we use personalised ranking (cold-start threshold)
const COLD_START_THRESHOLD = 5;

// Cache TTL in minutes per context
const CACHE_TTL_MINUTES = {
  HOME: 60,
  PRODUCT_PAGE: 30,
  CATEGORY_PAGE: 45,
  CART: 20,
  SEARCH: 15
};

// Context → human-readable default reason (fallback when no AI available)
const CONTEXT_REASONS = {
  HOME: "Recommended For You",
  PRODUCT_PAGE: "Similar Products",
  CATEGORY_PAGE: "Based on Your Interests",
  CART: "Frequently Bought Together",
  SEARCH: "Related to Your Search"
};

/**
 * Generates a concise recommendation explanation using the existing Gemini infrastructure.
 * Only called with a small, sanitised product summary — never the full catalogue.
 *
 * @param {Array<Object>} topProducts     Max 5 products (title + category only)
 * @param {Object} prefSummary            Non-sensitive category preference summary
 * @param {string} context
 * @param {string} openRouterApiKey
 * @returns {Promise<string>}
 */
async function generateExplanation(topProducts, prefSummary, context, openRouterApiKey) {
  if (!openRouterApiKey) return CONTEXT_REASONS[context] || "Recommended For You";

  try {
    const productSummary = topProducts
      .slice(0, 5)
      .map((p) => `${p.title} (${p.category})`)
      .join(", ");

    const topCats = Object.entries(prefSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k)
      .join(", ");

    const prompt = `You are a product recommendation engine for Vendora Marketplace. 
Write a single concise sentence (max 12 words) explaining why these products are recommended.
Context: ${context}
Top product categories shown: ${productSummary}
User preferred categories: ${topCats || "not specified"}
Rules: Never say specific purchase history. Use phrases like "Based on your interests", "Because you browsed similar items", "Trending in your favourite categories". Be natural and concise.`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vendora.pk",
        "X-Title": "Vendora Marketplace"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 40,
        temperature: 0.3
      })
    });

    if (!resp.ok) throw new Error("OpenRouter API error");
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || CONTEXT_REASONS[context];
  } catch (e) {
    console.warn("AI explanation generation failed (using fallback):", e.message);
    return CONTEXT_REASONS[context] || "Recommended For You";
  }
}

/**
 * Checks whether the cached recommendations for this user+context are still valid.
 *
 * @param {string} userId
 * @param {string} context
 * @returns {Promise<Array<Object>|null>}  Cached items, or null if expired / missing
 */
async function getCache(userId, context) {
  try {
    const db = admin.firestore();
    const cacheRef = db
      .collection("recommendations")
      .doc(userId)
      .collection("contexts")
      .doc(context);
    const snap = await cacheRef.get();
    if (!snap.exists) return null;

    const data = snap.data();
    const ttlMs = (CACHE_TTL_MINUTES[context] || 60) * 60 * 1000;
    const generatedAt = data.generatedAt?.toMillis?.() ?? 0;

    if (Date.now() - generatedAt > ttlMs) return null; // expired
    return data.items || null;
  } catch (e) {
    return null;
  }
}

/**
 * Writes recommendation results to the cache.
 *
 * @param {string} userId
 * @param {string} context
 * @param {Array<Object>} items
 * @param {string} explanation
 */
async function writeCache(userId, context, items, explanation) {
  try {
    const db = admin.firestore();
    const cacheRef = db
      .collection("recommendations")
      .doc(userId)
      .collection("contexts")
      .doc(context);

    const ttlMs = (CACHE_TTL_MINUTES[context] || 60) * 60 * 1000;

    await cacheRef.set({
      userId,
      context,
      explanation,
      items: items.slice(0, 20), // store up to 20 for pagination
      generatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString()
    });
  } catch (e) {
    console.warn("Failed to write recommendation cache:", e.message);
  }
}

/**
 * Main orchestration function — the public API for this module.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.context]         HOME|PRODUCT_PAGE|CATEGORY_PAGE|CART|SEARCH
 * @param {string} [params.seedProductId]   Required for PRODUCT_PAGE
 * @param {string} [params.categoryId]      Required for CATEGORY_PAGE
 * @param {number} [params.limit]           Max results to return
 * @param {boolean} [params.skipCache]      Force fresh generation
 * @returns {Promise<{items: Array, explanation: string, context: string, isColdStart: boolean}>}
 */
async function generateRecommendations({
  userId,
  context = "HOME",
  seedProductId = null,
  categoryId = null,
  limit = 10,
  skipCache = false
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // ── 1. Try cache ───────────────────────────────────────────────────────────
  if (!skipCache) {
    const cached = await getCache(userId, context);
    if (cached && cached.length > 0) {
      return {
        items: cached.slice(0, limit),
        explanation: CONTEXT_REASONS[context],
        context,
        isColdStart: false,
        fromCache: true
      };
    }
  }

  // ── 2. Load user preferences ───────────────────────────────────────────────
  let preferences = null;
  let isColdStart = true;

  if (userId && userId !== "anonymous") {
    try {
      preferences = await getUserPreferences(userId);
      isColdStart = !preferences || (preferences.eventCount || 0) < COLD_START_THRESHOLD;
    } catch (e) {
      console.warn("Could not load user preferences:", e.message);
    }
  }

  // ── 3. Generate candidates ─────────────────────────────────────────────────
  let candidates = [];
  try {
    candidates = await getCandidates({
      userId,
      context,
      seedProductId,
      categoryId,
      preferences,
      limit: 40
    });
  } catch (e) {
    console.error("Candidate generation failed:", e.message);
  }

  // Cold-start fallback: ensure we always have something to show
  if (candidates.length === 0) {
    try {
      const db = admin.firestore();
      const snap = await db.collection("products").orderBy("rating", "desc").limit(limit).get();
      snap.forEach((d) => candidates.push({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Cold-start fallback failed:", e.message);
    }
  }

  // ── 4. Score similarity (if seed product is known) ─────────────────────────
  let similarityScores = null;
  if (seedProductId && candidates.length > 0 && apiKey) {
    try {
      const db = admin.firestore();
      const seedSnap = await db.collection("products").doc(seedProductId).get();
      if (seedSnap.exists) {
        const seedProduct = { id: seedSnap.id, ...seedSnap.data() };
        similarityScores = await scoreSimilarity(seedProduct, candidates, apiKey);
      }
    } catch (e) {
      console.warn("Similarity scoring failed (continuing without):", e.message);
    }
  }

  // ── 5. Rank ────────────────────────────────────────────────────────────────
  const ranked = rankCandidates(candidates, { preferences, similarityScores });

  // ── 6. Format output ───────────────────────────────────────────────────────
  const outputItems = ranked.slice(0, limit).map((p) => ({
    productId: p.id,
    title: p.title,
    price: p.price,
    images: p.images || [],
    category: p.category,
    rating: p.rating,
    reviewsCount: p.reviewsCount,
    vendorName: p.vendorName,
    vendorId: p.vendorId,
    stock: p.stock,
    score: p.finalScore,
    sources: p._sources || []
  }));

  // ── 7. Generate explanation ────────────────────────────────────────────────
  const prefSummary = preferences?.categories || {};
  const explanation = await generateExplanation(outputItems, prefSummary, context, apiKey);

  // ── 8. Write cache (fire-and-forget) ──────────────────────────────────────
  if (userId && outputItems.length > 0) {
    writeCache(userId, context, outputItems, explanation).catch((e) =>
      console.warn("Cache write error:", e.message)
    );
  }

  return { items: outputItems, explanation, context, isColdStart, fromCache: false };
}

module.exports = { generateRecommendations };
