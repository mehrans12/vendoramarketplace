const { THRESHOLDS } = require('./config');

/**
 * Rule-based fraud detection functions.
 * Each function is pure, receives pre-fetched data, and returns boolean.
 * All thresholds are imported from config.js for easy tuning.
 */

/** Order velocity: >N orders received by vendor in last hour */
function checkOrderVelocity(recentOrders, threshold = THRESHOLDS.orderVelocityPerHour) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const count = recentOrders.filter(o => new Date(o.createdAt).getTime() > cutoff).length;
  return count > threshold;
}

/** Cancellation rate exceeds configured threshold */
function checkAbnormalCancellationRate(cancellationRate, threshold = THRESHOLDS.cancellationRate) {
  return cancellationRate > threshold;
}

/** Return + refund rate exceeds threshold */
function checkAbnormalReturnRate(returnRate, threshold = THRESHOLDS.returnRate) {
  return returnRate > threshold;
}

/** Any single order value exceeds high-value threshold */
function checkHighValueTransactionSpike(orders, threshold = THRESHOLDS.highValueOrderPKR) {
  return orders.some(o => (o.total || 0) > threshold);
}

/** 24h order count is >N× the past 30d daily average */
function checkSuddenVelocitySpike(orders) {
  if (orders.length < THRESHOLDS.suddenVelocityMinCount) return false;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const last24h = orders.filter(o => new Date(o.createdAt).getTime() > oneDayAgo).length;
  const pastMonth = orders.filter(o => {
    const t = new Date(o.createdAt).getTime();
    return t > thirtyDaysAgo && t <= oneDayAgo;
  }).length;

  const dailyAvg = pastMonth / 29;
  return last24h > THRESHOLDS.suddenVelocityMinCount &&
    last24h > (dailyAvg * THRESHOLDS.suddenVelocityMultiplier);
}

/** Different IP or device in quick succession */
function checkSuspiciousLoginPattern(securityEvents) {
  if (!securityEvents || securityEvents.length < 2) return false;
  const logins = securityEvents.filter(e =>
    e.eventType === 'LOGIN' || e.eventType === 'SECURITY_EVENT'
  );
  const windowMs = THRESHOLDS.multipleDevicesWindowMinutes * 60 * 1000;

  for (let i = 0; i < logins.length - 1; i++) {
    const t1 = new Date(logins[i].createdAt || logins[i].timestamp).getTime();
    const t2 = new Date(logins[i + 1].createdAt || logins[i + 1].timestamp).getTime();
    if (Math.abs(t1 - t2) < windowMs) {
      const ip1  = logins[i].metadata?.ip || '';
      const ip2  = logins[i + 1].metadata?.ip || '';
      const dev1 = logins[i].metadata?.deviceId || '';
      const dev2 = logins[i + 1].metadata?.deviceId || '';
      if ((ip1 && ip2 && ip1 !== ip2) || (dev1 && dev2 && dev1 !== dev2)) return true;
    }
  }
  return false;
}

/** New vendor (<N days) with unexpectedly high order volume */
function checkNewVendorHighVolume(vendorCreatedAt, orderCount) {
  const ageDays = (Date.now() - new Date(vendorCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays < THRESHOLDS.newVendorHighVolumeDays &&
    orderCount >= THRESHOLDS.newVendorHighVolumeOrders;
}

/** Product listed below N% of its category average price */
function checkUnusualPricing(productPrice, categoryAvgPrice) {
  if (!categoryAvgPrice || categoryAvgPrice <= 0) return false;
  return productPrice < categoryAvgPrice * THRESHOLDS.priceDumpThreshold;
}

/** More than N new products listed by the same vendor within 1 hour */
function checkProductListingBurst(recentProducts, threshold = THRESHOLDS.unusualProductBurstCount) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = recentProducts.filter(p => {
    const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
    return t > cutoff;
  });
  return recent.length > threshold;
}

/**
 * Normalised Levenshtein distance (0=identical, 1=completely different)
 * Used for duplicate title detection and review text similarity.
 */
function normalizedLevenshtein(a, b) {
  if (!a || !b) return 1;
  a = a.toLowerCase().replace(/\s+/g, ' ').trim();
  b = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (a === b) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;

  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length] / maxLen;
}

/** Two product titles are too similar (likely duplicate) */
function checkDuplicateTitle(title1, title2) {
  const similarity = 1 - normalizedLevenshtein(title1, title2);
  return similarity >= THRESHOLDS.duplicateTitleSimilarity;
}

/** Two review texts are suspiciously similar (copy-paste manipulation) */
function checkSimilarReviewText(text1, text2) {
  const similarity = 1 - normalizedLevenshtein(text1, text2);
  return similarity >= THRESHOLDS.reviewTextSimilarityThreshold;
}

module.exports = {
  checkOrderVelocity,
  checkAbnormalCancellationRate,
  checkAbnormalReturnRate,
  checkHighValueTransactionSpike,
  checkSuddenVelocitySpike,
  checkSuspiciousLoginPattern,
  checkNewVendorHighVolume,
  checkUnusualPricing,
  checkProductListingBurst,
  checkDuplicateTitle,
  checkSimilarReviewText,
  normalizedLevenshtein
};
