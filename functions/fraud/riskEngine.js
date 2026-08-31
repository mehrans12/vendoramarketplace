const admin = require("firebase-admin");
const { detectAnomalies } = require("./anomalyDetector");
const { SIGNAL_WEIGHTS } = require("./config");

/**
 * Assesses vendor multi-factor risk score:
 * Behavioral Risk + Transaction Risk + Review Risk + Account Risk + Product Risk
 * Normalized to 0–100.
 * 
 * @param {string} vendorId
 * @returns {Promise<Object>} The computed risk assessment document
 */
async function assessVendorRisk(vendorId) {
  const db = admin.firestore();

  if (!vendorId || typeof vendorId !== "string") {
    throw new Error("Invalid vendor ID.");
  }

  // 1. Fetch vendor profile
  const vendorSnap = await db.collection("vendors").doc(vendorId).get();
  const vendorData = vendorSnap.exists ? vendorSnap.data() : {};

  // 2. Run multi-vector anomaly detection
  const anomalyResults = await detectAnomalies(vendorId);
  const { flags, signals, evidence } = anomalyResults;

  // 3. Feature Extraction & Category Sub-scoring
  // Behavioral Risk (max 20)
  let behavioralRisk = 0;
  signals.behavioralSignals.forEach(f => {
    behavioralRisk += (SIGNAL_WEIGHTS[f] || 10);
  });
  behavioralRisk = Math.min(20, behavioralRisk);

  // Transaction Risk (max 30)
  let transactionRisk = 0;
  signals.transactionSignals.forEach(f => {
    transactionRisk += (SIGNAL_WEIGHTS[f] || 15);
  });
  transactionRisk = Math.min(30, transactionRisk);

  // Review Risk (max 20)
  let reviewRisk = 0;
  signals.reviewSignals.forEach(f => {
    reviewRisk += (SIGNAL_WEIGHTS[f] || 15);
  });
  reviewRisk = Math.min(20, reviewRisk);

  // Account Risk (max 15)
  let accountRisk = 0;
  signals.accountSignals.forEach(f => {
    accountRisk += (SIGNAL_WEIGHTS[f] || 10);
  });
  accountRisk = Math.min(15, accountRisk);

  // Product Risk (max 15)
  let productRisk = 0;
  signals.productSignals.forEach(f => {
    productRisk += (SIGNAL_WEIGHTS[f] || 10);
  });
  productRisk = Math.min(15, productRisk);

  // Base baseline score
  const baseline = 5;
  let overallScore = baseline + behavioralRisk + transactionRisk + reviewRisk + accountRisk + productRisk;
  overallScore = Math.max(0, Math.min(100, Math.round(overallScore)));

  // Risk Classification
  let level = "LOW";
  if (overallScore >= 80) level = "CRITICAL";
  else if (overallScore >= 60) level = "HIGH";
  else if (overallScore >= 30) level = "MEDIUM";

  const riskComponents = {
    behavioral: behavioralRisk,
    transaction: transactionRisk,
    review: reviewRisk,
    account: accountRisk,
    product: productRisk
  };

  const riskDoc = {
    vendorId,
    vendorName: vendorData.businessName || "Merchant Store",
    score: overallScore,
    level,
    components: riskComponents,
    factors: {
      flags,
      signals,
      evidence
    },
    status: "active",
    calculatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // 1. Write to risk_scores collection
  await db.collection("risk_scores").doc(vendorId).set(riskDoc);

  // 2. Log to history
  const historyId = `rh-${vendorId}-${Date.now()}`;
  await db.collection("risk_score_history").doc(historyId).set({
    historyId,
    ...riskDoc
  });

  // 3. Generate or update Fraud Event for Admin Investigation
  // If risk is MEDIUM, HIGH, or CRITICAL, or if any flags are present
  if (flags.length > 0 || level !== "LOW") {
    // Check if an open fraud event already exists for this vendor
    const existingEventsSnap = await db.collection("fraud_events")
      .where("entityId", "==", vendorId)
      .where("status", "in", ["NEW", "UNDER_REVIEW", "ACTION_REQUIRED"])
      .limit(1)
      .get();

    let eventId;
    let existingData = {};

    if (!existingEventsSnap.empty) {
      const existingDoc = existingEventsSnap.docs[0];
      eventId = existingDoc.id;
      existingData = existingDoc.data();
    } else {
      eventId = `fe-${vendorId}-${Date.now()}`;
    }

    const fraudEventDoc = {
      eventId,
      entityId: vendorId,
      entityType: "vendor",
      entityName: vendorData.businessName || "Merchant Store",
      riskScore: overallScore,
      level,
      riskComponents,
      flags,
      reasonCategories: Object.keys(signals).filter(k => signals[k].length > 0),
      evidenceSummary: evidence.length > 0 ? evidence.join(" ") : "Automated marketplace risk indicators triggered.",
      status: existingData.status || "NEW", // NEW | UNDER_REVIEW | CLEARED | ACTION_REQUIRED | RESOLVED
      adminNotes: existingData.adminNotes || "",
      reviewedBy: existingData.reviewedBy || null,
      reviewedAt: existingData.reviewedAt || null,
      createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("fraud_events").doc(eventId).set(fraudEventDoc, { merge: true });
  }

  return {
    success: true,
    vendorId,
    score: overallScore,
    level,
    components: riskComponents,
    flags,
    evidence
  };
}

/**
 * Logs an immutable audit trail entry whenever an administrator reviews or takes action on a fraud alert.
 * 
 * @param {Object} params
 * @param {string} params.eventId
 * @param {string} params.entityId
 * @param {string} params.adminId
 * @param {string} params.adminEmail
 * @param {string} params.action (STATUS_CHANGE, VENDOR_SUSPEND, VENDOR_RESTORE, NOTE_ADDED)
 * @param {string} [params.previousStatus]
 * @param {string} [params.newStatus]
 * @param {string} [params.notes]
 */
async function logFraudAuditAction({
  eventId,
  entityId,
  adminId,
  adminEmail,
  action,
  previousStatus = null,
  newStatus = null,
  notes = ""
}) {
  const db = admin.firestore();
  const logId = `audit-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  const auditEntry = {
    logId,
    eventId: eventId || null,
    entityId: entityId || null,
    adminId,
    adminEmail,
    action,
    previousStatus,
    newStatus,
    notes,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection("fraud_audit_logs").doc(logId).set(auditEntry);
  return auditEntry;
}

module.exports = {
  assessVendorRisk,
  logFraudAuditAction
};
