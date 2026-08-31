/**
 * Hybrid Ranking Engine — Phase 2
 *
 * Combines five normalised sub-scores into a single final score:
 *
 *   Final Score =
 *     0.35 × Behavioral Score        (user has interacted with this product/category)
 *   + 0.30 × Similarity Score        (semantic cosine similarity to seed)
 *   + 0.20 × Category Preference     (user's preferred category weight)
 *   + 0.10 × Popularity Score        (rating × review count, normalised)
 *   + 0.05 × Freshness Score         (recency of the product listing)
 *
 * All weights are declared in RANKING_WEIGHTS and can be tuned without
 * touching ranking logic.
 */

// ── Configurable weights ──────────────────────────────────────────────────────
const RANKING_WEIGHTS = {
  behavioral: 0.35,
  similarity: 0.30,
  categoryPreference: 0.20,
  popularity: 0.10,
  freshness: 0.05
};

/**
 * Normalises a raw numeric map so all values are in [0, 1].
 * @param {Map<string,number>} scoreMap
 * @returns {Map<string,number>}
 */
function normaliseMap(scoreMap) {
  const max = Math.max(...scoreMap.values(), 1e-9);
  const out = new Map();
  scoreMap.forEach((v, k) => out.set(k, Math.max(0, v / max)));
  return out;
}

/**
 * Computes a behavioural score for each candidate based on user interaction history.
 *
 * @param {Array<Object>} candidates
 * @param {Object} preferences        User preferences from preferenceEngine
 * @returns {Map<string,number>}      Raw behavioural scores per productId
 */
function computeBehavioralScores(candidates, preferences) {
  const productInterests = preferences?.productInterests || {};
  const categoryPrefs = preferences?.categories || {};

  const scores = new Map();
  candidates.forEach((p) => {
    let score = 0;
    // Direct product interaction signal
    if (productInterests[p.id]) score += productInterests[p.id] * 10;
    // Category signal
    if (p.category && categoryPrefs[p.category]) score += categoryPrefs[p.category] * 3;
    // Source multiplier: products fetched from preference-matched strategies score higher
    if (p._sources?.includes("category_preference")) score += 2;
    if (p._sources?.includes("trending")) score += 1.5;
    scores.set(p.id, score);
  });
  return scores;
}

/**
 * Computes popularity score = (rating * log(reviewsCount + 1)) normalised.
 * @param {Array<Object>} candidates
 * @returns {Map<string,number>}
 */
function computePopularityScores(candidates) {
  const scores = new Map();
  candidates.forEach((p) => {
    const rating = Math.min(5, Math.max(0, p.rating || 0));
    const reviews = Math.max(0, p.reviewsCount || 0);
    const pop = rating * Math.log(reviews + 1);
    scores.set(p.id, pop);
  });
  return scores;
}

/**
 * Computes freshness score based on how recently the product was listed.
 * Products less than 7 days old score 1.0; older products decay linearly
 * to 0 at 180 days.
 *
 * @param {Array<Object>} candidates
 * @returns {Map<string,number>}
 */
function computeFreshnessScores(candidates) {
  const now = Date.now();
  const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
  const PEAK_AGE_MS = 7 * 24 * 60 * 60 * 1000;  //   7 days

  const scores = new Map();
  candidates.forEach((p) => {
    let ageMs = MAX_AGE_MS; // default: treat as old
    try {
      const ts = p.createdAt;
      if (ts) {
        const date = ts?.toMillis?.() ?? new Date(ts).getTime();
        ageMs = now - date;
      }
    } catch (e) {}

    const freshness = ageMs <= PEAK_AGE_MS
      ? 1.0
      : Math.max(0, 1 - (ageMs - PEAK_AGE_MS) / (MAX_AGE_MS - PEAK_AGE_MS));

    scores.set(p.id, freshness);
  });
  return scores;
}

/**
 * Computes category preference score for each candidate based on user prefs.
 * @param {Array<Object>} candidates
 * @param {Object} preferences
 * @returns {Map<string,number>}
 */
function computeCategoryPreferenceScores(candidates, preferences) {
  const categoryPrefs = preferences?.categories || {};
  const scores = new Map();
  candidates.forEach((p) => {
    const catScore = p.category ? (categoryPrefs[p.category] || 0) : 0;
    scores.set(p.id, catScore);
  });
  return scores;
}

/**
 * Main ranking function. Combines all sub-scores using RANKING_WEIGHTS.
 *
 * @param {Array<Object>} candidates          Raw candidate products
 * @param {Object} params
 * @param {Object} [params.preferences]       User preference profile
 * @param {Map<string,number>} [params.similarityScores]  From similarity.js
 * @param {Object} [params.weights]           Override RANKING_WEIGHTS
 * @returns {Array<Object>} Candidates sorted by finalScore desc, with scores attached
 */
function rankCandidates(candidates, { preferences = null, similarityScores = null, weights = null } = {}) {
  const W = { ...RANKING_WEIGHTS, ...(weights || {}) };

  // Compute all sub-score maps
  const behavioralRaw = computeBehavioralScores(candidates, preferences);
  const popularityRaw = computePopularityScores(candidates);
  const freshnessRaw  = computeFreshnessScores(candidates);
  const catPrefRaw    = computeCategoryPreferenceScores(candidates, preferences);

  // Normalise
  const behavioral       = normaliseMap(behavioralRaw);
  const popularity       = normaliseMap(popularityRaw);
  const freshness        = freshnessRaw; // already in [0,1]
  const categoryPreference = normaliseMap(catPrefRaw);

  // Build final scored list
  const scored = candidates.map((p) => {
    const b  = behavioral.get(p.id) || 0;
    const s  = similarityScores?.get?.(p.id) ?? 0; // already normalised [0,1]
    const c  = categoryPreference.get(p.id) || 0;
    const po = popularity.get(p.id) || 0;
    const f  = freshness.get(p.id) || 0;

    const finalScore =
      W.behavioral        * b  +
      W.similarity        * s  +
      W.categoryPreference * c +
      W.popularity        * po +
      W.freshness         * f;

    return {
      ...p,
      _scores: { behavioral: b, similarity: s, categoryPreference: c, popularity: po, freshness: f },
      finalScore: parseFloat(finalScore.toFixed(6))
    };
  });

  // Sort descending
  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored;
}

module.exports = { rankCandidates, RANKING_WEIGHTS };
