/**
 * Configurable thresholds for all fraud detection rules.
 * Centralised here so they can be tuned without touching detection logic.
 */
const THRESHOLDS = {
  // Order behavior
  orderVelocityPerHour: 10,           // >N orders in 1 hour from same vendor
  cancellationRate: 0.50,             // >50% cancellation rate (30-day window)
  returnRate: 0.40,                   // >40% return+refund rate
  highValueOrderPKR: 100000,          // Single order >100,000 PKR
  suddenVelocityMultiplier: 5,        // 24h orders > 5x daily average
  suddenVelocityMinCount: 10,         // Only flag if 24h count > this

  // Review behavior
  reviewsPerDayPerUser: 5,            // >5 reviews in 24h by same user
  reviewsPerProductPerVendor: 3,      // >3 reviews on same vendor product from same user
  suspiciousRatingRatio: 0.80,        // >80% of reviews are 5-star within 48h (review bombing)
  minReviewsForPattern: 4,            // Minimum reviews to detect patterns
  reviewTextSimilarityThreshold: 0.75,// Normalized edit-distance similarity

  // Login / device behavior
  multipleDevicesWindowMinutes: 10,   // Different IP/device within N minutes
  unusualLoginHoursStart: 2,          // 02:00 AM local
  unusualLoginHoursEnd: 5,            // 05:00 AM local

  // Product behavior
  priceDumpThreshold: 0.20,           // Product price < 20% of category average
  duplicateTitleSimilarity: 0.85,     // Normalized title similarity for dup detection
  unusualProductBurstCount: 5,        // >5 new products listed within 1 hour

  // Account behavior
  newVendorHighVolumeDays: 7,         // Account younger than N days with high orders
  newVendorHighVolumeOrders: 20       // Order count threshold for new vendor flag
};

// Risk score contribution per signal (additive, normalised to 0–100 final)
const SIGNAL_WEIGHTS = {
  HIGH_ORDER_VELOCITY:         30,
  HIGH_CANCELLATION_RATE:      20,
  HIGH_RETURN_RATE:            15,
  ABNORMAL_TRANSACTION_VALUE:  20,
  SUDDEN_VELOCITY_SPIKE:       25,
  SUSPICIOUS_LOGIN_PATTERN:    15,
  REVIEW_BOMBING:              25,
  SUSPICIOUS_REVIEW_PATTERN:   20,
  DUPLICATE_REVIEW:            15,
  DUPLICATE_PRODUCT:           15,
  UNUSUAL_PRICING:             10,
  PRODUCT_LISTING_BURST:       10,
  NEW_VENDOR_HIGH_VOLUME:      20,
  COORDINATED_REVIEWS:         30,
};

module.exports = { THRESHOLDS, SIGNAL_WEIGHTS };
