const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

// Configurable weights totaling 1.0 (100%)
const TRUST_WEIGHTS = {
  verification: 0.20,
  orderReliability: 0.15,
  reviewsQuality: 0.15,
  responseRate: 0.10,
  returnPerformance: 0.10,
  customerSatisfaction: 0.10,
  accountHistory: 0.10,
  riskSignals: 0.10
};

// Configurable global benchmarks for Bayesian smoothing
const GLOBAL_BENCHMARKS = {
  orderReliabilityMean: 0.95,
  reviewsQualityMean: 4.2,
  returnPerformanceMean: 0.96,
  customerSatisfactionMean: 0.85
};

/**
 * Calculates the trust score for a specific vendor.
 * @param {string} vendorId
 * @returns {Promise<Object>} The computed trust score document
 */
async function calculateVendorTrustScore(vendorId) {
  const db = admin.firestore();

  if (!vendorId || typeof vendorId !== 'string') {
    throw new Error("Invalid vendor ID.");
  }

  // 1. Get Vendor Profile Document
  const vendorRef = db.collection("vendors").doc(vendorId);
  const vendorSnap = await vendorRef.get();
  if (!vendorSnap.exists) {
    throw new Error(`Vendor ${vendorId} does not exist.`);
  }
  const vendorData = vendorSnap.data();

  // 2. Fetch all orders for this vendor
  const ordersSnap = await db.collection("orders").where("vendorId", "==", vendorId).get();
  const orders = [];
  ordersSnap.forEach(d => orders.push(d.data()));

  const totalOrders = orders.length;
  const fulfilledOrders = orders.filter(o => o.status === 'delivered' || o.status === 'shipped').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const disputedOrders = orders.filter(o => o.status === 'disputed').length;
  const returnedOrders = orders.filter(o => o.status === 'returned' || o.status === 'refunded').length;

  // 3. Fetch reviews for this vendor's products
  const productsSnap = await db.collection("products").where("vendorId", "==", vendorId).get();
  const productIds = [];
  productsSnap.forEach(d => productIds.push(d.id));

  let reviews = [];
  if (productIds.length > 0) {
    const chunks = [];
    for (let i = 0; i < productIds.length; i += 10) {
      chunks.push(productIds.slice(i, i + 10));
    }
    await Promise.all(chunks.map(async (chunk) => {
      const revSnap = await db.collection("reviews").where("productId", "in", chunk).get();
      revSnap.forEach(d => reviews.push(d.data()));
    }));
  }

  const totalReviews = reviews.length;
  const totalRatingSum = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  const averageRating = totalReviews > 0 ? (totalRatingSum / totalReviews) : (vendorData.rating || 4.0);
  const positiveReviewsCount = reviews.filter(r => (r.rating || 0) >= 4).length;

  // 4. Fetch Risk Signals
  let riskScore = 10; // default baseline risk
  try {
    const riskSnap = await db.collection("risk_scores").doc(vendorId).get();
    if (riskSnap.exists) {
      riskScore = riskSnap.data().score || 10;
    }
  } catch (err) {
    console.warn("Failed to retrieve risk score:", err.message);
  }

  // ──────────────────────── Component Scoring [0, 100] ────────────────────────

  // A. Verification (20%)
  const isVerified = vendorData.verified === true || vendorData.status === 'approved';
  const verificationScore = isVerified ? 100 : 0;

  // B. Order Reliability (15%) - Bayesian smoothed (C = 5)
  const orderReliability = ((fulfilledOrders + 5 * GLOBAL_BENCHMARKS.orderReliabilityMean) / (totalOrders + 5)) * 100;

  // C. Reviews Quality (15%) - Bayesian smoothed (R = 5)
  const smoothedRating = (totalReviews * averageRating + 5 * GLOBAL_BENCHMARKS.reviewsQualityMean) / (totalReviews + 5);
  const reviewsQualityScore = (smoothedRating / 5.0) * 100;

  // D. Response Rate (10%)
  const responseRate = typeof vendorData.responseRate === 'number' ? vendorData.responseRate : 90;

  // E. Return Performance (10%)
  const badPerformanceCount = cancelledOrders + returnedOrders + disputedOrders;
  const returnPerformance = (1 - (badPerformanceCount / (totalOrders + 5))) * 100;

  // F. Customer Satisfaction (10%)
  const satisfactionRate = totalReviews > 0 ? (positiveReviewsCount / totalReviews) : GLOBAL_BENCHMARKS.customerSatisfactionMean;
  const customerSatisfactionScore = satisfactionRate * 100;

  // G. Account History (10%) - peaks at 180 days
  const createdAt = vendorData.createdAt ? new Date(vendorData.createdAt) : new Date();
  const ageInMs = Date.now() - createdAt.getTime();
  const ageInDays = Math.max(0, Math.floor(ageInMs / (1000 * 60 * 60 * 24)));
  const accountHistoryScore = Math.min(100, (ageInDays / 180) * 100);

  // H. Risk Signals (10%)
  const riskScoreNormalized = Math.max(0, Math.min(100, riskScore));
  const riskScoreSub = (1 - (riskScoreNormalized / 100)) * 100;

  // ──────────────────────── Final Calculation ────────────────────────
  let overallScore = 
    TRUST_WEIGHTS.verification * verificationScore +
    TRUST_WEIGHTS.orderReliability * orderReliability +
    TRUST_WEIGHTS.reviewsQuality * reviewsQualityScore +
    TRUST_WEIGHTS.responseRate * responseRate +
    TRUST_WEIGHTS.returnPerformance * returnPerformance +
    TRUST_WEIGHTS.customerSatisfaction * customerSatisfactionScore +
    TRUST_WEIGHTS.accountHistory * accountHistoryScore +
    TRUST_WEIGHTS.riskSignals * riskScoreSub;

  overallScore = Math.max(0, Math.min(100, Math.round(overallScore)));

  // Define Category
  let category = "Poor";
  if (overallScore >= 90) category = "Excellent";
  else if (overallScore >= 75) category = "Very Good";
  else if (overallScore >= 60) category = "Good";
  else if (overallScore >= 40) category = "Needs Improvement";

  const confidence = parseFloat(Math.min(1.0, (totalOrders + totalReviews) / 20).toFixed(2));

  // Fetch previous score
  let prevScore = 0;
  try {
    const prevSnap = await db.collection("vendor_trust_scores").doc(vendorId).get();
    if (prevSnap.exists) {
      prevScore = prevSnap.data().overallScore || 0;
    }
  } catch (err) {}

  const trustDoc = {
    vendorId,
    overallScore,
    category,
    componentScores: {
      verification: Math.round(verificationScore),
      orderReliability: Math.round(orderReliability),
      reviewsQuality: Math.round(reviewsQualityScore),
      responseRate: Math.round(responseRate),
      returnPerformance: Math.round(returnPerformance),
      customerSatisfaction: Math.round(customerSatisfactionScore),
      accountHistory: Math.round(accountHistoryScore),
      riskSignals: Math.round(riskScoreSub)
    },
    confidence,
    scoreVersion: "2.0.0",
    calculatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  // Write to vendor_trust_scores collection
  await db.collection("vendor_trust_scores").doc(vendorId).set(trustDoc);

  // Log to history
  if (prevScore !== overallScore) {
    const historyId = `th-${vendorId}-${Date.now()}`;
    await db.collection("vendor_trust_history").doc(historyId).set({
      historyId,
      vendorId,
      previousScore: prevScore,
      newScore: overallScore,
      category,
      reasonCategory: prevScore === 0 ? "INITIAL_CALCULATION" : "EVENT_RECALCULATION",
      scoreVersion: "2.0.0",
      timestamp: FieldValue.serverTimestamp()
    });
  }

  return trustDoc;
}

module.exports = {
  calculateVendorTrustScore
};
