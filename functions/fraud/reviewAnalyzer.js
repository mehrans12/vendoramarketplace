/**
 * Review Fraud Analyzer
 * Detects: review bombing, copy-paste manipulation, coordinated patterns,
 * suspicious timing bursts, and single-user multi-review abuse.
 * 
 * IMPORTANT: Flags are advisory only. No review is auto-deleted.
 */

const admin = require('firebase-admin');
const { THRESHOLDS } = require('./config');
const { checkSimilarReviewText } = require('./rules');

/**
 * Analyzes reviews for a specific product for manipulation signals.
 * @param {string} productId
 * @returns {Promise<{ flags: string[], suspiciousReviewIds: string[], summary: string }>}
 */
async function analyzeProductReviews(productId) {
  const db = admin.firestore();
  const flags = [];
  const suspiciousReviewIds = [];

  const snap = await db.collection('reviews')
    .where('productId', '==', productId)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const reviews = [];
  snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));

  if (reviews.length < THRESHOLDS.minReviewsForPattern) {
    return { flags, suspiciousReviewIds, summary: 'Insufficient reviews for pattern analysis.' };
  }

  // ── Signal 1: Review bombing (sudden burst of 5★ or 1★ in 48h) ──────────
  const now = Date.now();
  const cutoff48h = now - 48 * 60 * 60 * 1000;
  const recent = reviews.filter(r => new Date(r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt).getTime() > cutoff48h);
  const fiveStarRecent = recent.filter(r => r.rating >= 5).length;
  const fiveStarRatio = recent.length > 0 ? fiveStarRecent / recent.length : 0;

  if (recent.length >= THRESHOLDS.minReviewsForPattern && fiveStarRatio >= THRESHOLDS.suspiciousRatingRatio) {
    flags.push('REVIEW_BOMBING');
    recent.forEach(r => suspiciousReviewIds.push(r.id));
  }

  // ── Signal 2: Duplicate buyer submitting multiple reviews ────────────────
  const reviewsByBuyer = {};
  for (const r of reviews) {
    const bid = r.buyerId || r.userId;
    if (!bid) continue;
    reviewsByBuyer[bid] = (reviewsByBuyer[bid] || 0) + 1;
  }
  const duplicateBuyers = Object.entries(reviewsByBuyer)
    .filter(([, count]) => count >= THRESHOLDS.reviewsPerProductPerVendor);
  if (duplicateBuyers.length > 0) {
    flags.push('DUPLICATE_REVIEW');
    for (const r of reviews) {
      const bid = r.buyerId || r.userId;
      if (bid && reviewsByBuyer[bid] >= THRESHOLDS.reviewsPerProductPerVendor) {
        suspiciousReviewIds.push(r.id);
      }
    }
  }

  // ── Signal 3: Suspiciously similar review texts (copy-paste) ─────────────
  const textChecked = new Set();
  for (let i = 0; i < reviews.length; i++) {
    for (let j = i + 1; j < reviews.length; j++) {
      const key = `${reviews[i].id}-${reviews[j].id}`;
      if (textChecked.has(key)) continue;
      textChecked.add(key);
      if (checkSimilarReviewText(reviews[i].reviewText || reviews[i].text || '', reviews[j].reviewText || reviews[j].text || '')) {
        flags.push('SUSPICIOUS_REVIEW_PATTERN');
        suspiciousReviewIds.push(reviews[i].id, reviews[j].id);
        break; // One pair is enough to flag
      }
    }
    if (flags.includes('SUSPICIOUS_REVIEW_PATTERN')) break;
  }

  // ── Signal 4: Coordinated reviews (many reviews within 10 minutes) ───────
  const timestamps = reviews.map(r => {
    const raw = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : new Date(r.createdAt).getTime();
    return raw;
  }).sort();

  const windowMs = 10 * 60 * 1000;
  let windowCount = 1;
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] - timestamps[i - 1] < windowMs) {
      windowCount++;
      if (windowCount >= THRESHOLDS.minReviewsForPattern) {
        flags.push('COORDINATED_REVIEWS');
        break;
      }
    } else {
      windowCount = 1;
    }
  }

  // Deduplicate suspicious review IDs
  const uniqueSuspicious = [...new Set(suspiciousReviewIds)];

  const summary = flags.length === 0
    ? 'No suspicious review patterns detected.'
    : `Detected ${flags.length} signal(s): ${flags.join(', ')}. ${uniqueSuspicious.length} review(s) flagged for admin review.`;

  return {
    flags: [...new Set(flags)],
    suspiciousReviewIds: uniqueSuspicious,
    summary
  };
}

/**
 * Checks a single user's review frequency across all products.
 * @param {string} userId
 * @returns {Promise<boolean>} True if user is submitting too many reviews too fast.
 */
async function checkUserReviewFrequency(userId) {
  if (!userId) return false;
  const db = admin.firestore();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const snap = await db.collection('reviews')
    .where('buyerId', '==', userId)
    .where('createdAt', '>=', cutoff)
    .get();

  return snap.size > THRESHOLDS.reviewsPerDayPerUser;
}

module.exports = { analyzeProductReviews, checkUserReviewFrequency };
