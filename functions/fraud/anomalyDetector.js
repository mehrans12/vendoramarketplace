const admin = require("firebase-admin");
const rules = require("./rules");
const { THRESHOLDS } = require("./config");
const { analyzeProductReviews } = require("./reviewAnalyzer");
const { scanVendorProducts } = require("./productDetector");

/**
 * Runs comprehensive multi-vector anomaly checks for a vendor across:
 * - Transactions & Orders
 * - Security & Account Patterns
 * - Product Catalog & Pricing
 * - Product Reviews & Feedback
 * - Behavioral & Event Stream Signals
 * 
 * @param {string} vendorId
 * @returns {Promise<Object>} Categorized signals, evidence items, and flags
 */
async function detectAnomalies(vendorId) {
  const db = admin.firestore();

  const signals = {
    transactionSignals: [],
    accountSignals: [],
    reviewSignals: [],
    productSignals: [],
    behavioralSignals: []
  };

  const evidence = [];

  try {
    // ── 1. VENDOR ACCOUNT PROFILE ───────────────────────────────────────────
    const vendorDoc = await db.collection("vendors").doc(vendorId).get();
    const vendorData = vendorDoc.exists ? vendorDoc.data() : {};

    // ── 2. TRANSACTION & ORDER CHECKS ───────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ordersSnap = await db.collection("orders")
      .where("vendorId", "==", vendorId)
      .where("createdAt", ">=", thirtyDaysAgo)
      .get();

    const orders = [];
    ordersSnap.forEach(d => orders.push({ id: d.id, ...d.data() }));

    const totalOrders = orders.length;
    const cancelledOrders = orders.filter(o => o.status === "cancelled" || o.status === "cancellation_requested").length;
    const returnedOrders = orders.filter(o => o.status === "returned" || o.status === "refunded" || o.status === "disputed").length;

    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) : 0.0;
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) : 0.0;

    // Check cancellation rate
    if (rules.checkAbnormalCancellationRate(cancellationRate, THRESHOLDS.cancellationRate)) {
      signals.transactionSignals.push("HIGH_CANCELLATION_RATE");
      evidence.push(`Cancellation rate is ${(cancellationRate * 100).toFixed(1)}% (${cancelledOrders}/${totalOrders} orders cancelled).`);
    }

    // Check return rate
    if (rules.checkAbnormalReturnRate(returnRate, THRESHOLDS.returnRate)) {
      signals.transactionSignals.push("HIGH_RETURN_RATE");
      evidence.push(`Return/refund rate is ${(returnRate * 100).toFixed(1)}% (${returnedOrders}/${totalOrders} orders returned/disputed).`);
    }

    // Check order velocity in last hour
    if (rules.checkOrderVelocity(orders, THRESHOLDS.orderVelocityPerHour)) {
      signals.transactionSignals.push("HIGH_ORDER_VELOCITY");
      evidence.push(`Unusual order surge: more than ${THRESHOLDS.orderVelocityPerHour} orders placed within the last 1 hour.`);
    }

    // Check high value spikes
    if (rules.checkHighValueTransactionSpike(orders, THRESHOLDS.highValueOrderPKR)) {
      signals.transactionSignals.push("ABNORMAL_TRANSACTION_VALUE");
      const highVal = orders.find(o => (o.total || 0) > THRESHOLDS.highValueOrderPKR);
      evidence.push(`Contains high-value order #${highVal?.id?.slice(0, 8)} totaling Rs. ${highVal?.total?.toLocaleString()} (threshold: Rs. ${THRESHOLDS.highValueOrderPKR.toLocaleString()}).`);
    }

    // Check sudden velocity surge
    if (rules.checkSuddenVelocitySpike(orders)) {
      signals.transactionSignals.push("SUDDEN_VELOCITY_SPIKE");
      evidence.push("Sudden spike: last 24h order count is more than 5x the previous 30-day daily average.");
    }

    // ── 3. ACCOUNT & SECURITY CHECKS ────────────────────────────────────────
    if (vendorData.createdAt) {
      if (rules.checkNewVendorHighVolume(vendorData.createdAt, totalOrders)) {
        signals.accountSignals.push("NEW_VENDOR_HIGH_VOLUME");
        evidence.push(`New store (<${THRESHOLDS.newVendorHighVolumeDays} days old) with unusually high order volume (${totalOrders} orders).`);
      }
    }

    const sevenDaysAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const securitySnap = await db.collection("security_events")
      .where("vendorId", "==", vendorId)
      .where("timestamp", ">=", sevenDaysAgo)
      .get();

    const securityEvents = [];
    securitySnap.forEach(d => securityEvents.push(d.data()));

    if (rules.checkSuspiciousLoginPattern(securityEvents)) {
      signals.accountSignals.push("SUSPICIOUS_LOGIN_PATTERN");
      evidence.push("Rapid login pattern from distinct IP addresses or devices within 10 minutes.");
    }

    // ── 4. PRODUCT & CATALOG CHECKS ─────────────────────────────────────────
    const productScan = await scanVendorProducts(vendorId);
    if (productScan.flags.length > 0) {
      signals.productSignals.push(...productScan.flags);
      if (productScan.duplicatePairs.length > 0) {
        evidence.push(`Found ${productScan.duplicatePairs.length} duplicate product listing pair(s) with identical attributes.`);
      }
      if (productScan.pricingAnomalies.length > 0) {
        evidence.push(`Found ${productScan.pricingAnomalies.length} extreme pricing anomaly item(s) significantly below category benchmark.`);
      }
    }

    // ── 5. REVIEW & MANIPULATION CHECKS ─────────────────────────────────────
    const productsSnap = await db.collection("products").where("vendorId", "==", vendorId).get();
    const productIds = [];
    productsSnap.forEach(d => productIds.push(d.id));

    // Sample top products for review analysis
    for (const pid of productIds.slice(0, 5)) {
      const reviewAnalysis = await analyzeProductReviews(pid);
      if (reviewAnalysis.flags.length > 0) {
        signals.reviewSignals.push(...reviewAnalysis.flags);
        evidence.push(`Review analysis for product #${pid.slice(0, 8)}: ${reviewAnalysis.summary}`);
      }
    }

    // ── 6. BEHAVIORAL CHECKS FROM USER EVENTS (Phase 2 events) ──────────────
    try {
      const oneDayAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const eventsSnap = await db.collection("user_events")
        .where("vendorId", "==", vendorId)
        .where("createdAt", ">=", oneDayAgo)
        .limit(200)
        .get();

      const events = [];
      eventsSnap.forEach(d => events.push(d.data()));

      // Detect rapid repetitive actions (e.g. >20 actions in under 60 seconds from same session)
      const sessionCounts = {};
      events.forEach(e => {
        const s = e.sessionId || "unknown";
        sessionCounts[s] = (sessionCounts[s] || 0) + 1;
      });

      const highFreqSession = Object.entries(sessionCounts).find(([, count]) => count > 50);
      if (highFreqSession) {
        signals.behavioralSignals.push("RAPID_REPEATED_ACTIONS");
        evidence.push(`High event frequency: session ${highFreqSession[0].slice(0, 8)} performed ${highFreqSession[1]} actions in under 24 hours.`);
      }
    } catch (evtErr) {
      console.warn("User events check skipped:", evtErr.message);
    }

  } catch (err) {
    console.error(`Error running multi-vector anomaly detection for vendor ${vendorId}:`, err);
  }

  // Deduplicate all signal categories
  signals.transactionSignals = [...new Set(signals.transactionSignals)];
  signals.accountSignals = [...new Set(signals.accountSignals)];
  signals.reviewSignals = [...new Set(signals.reviewSignals)];
  signals.productSignals = [...new Set(signals.productSignals)];
  signals.behavioralSignals = [...new Set(signals.behavioralSignals)];

  const allFlags = [
    ...signals.transactionSignals,
    ...signals.accountSignals,
    ...signals.reviewSignals,
    ...signals.productSignals,
    ...signals.behavioralSignals
  ];

  return {
    flags: [...new Set(allFlags)],
    signals,
    evidence: [...new Set(evidence)]
  };
}

module.exports = {
  detectAnomalies
};
