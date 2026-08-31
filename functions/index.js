const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Initialize Firebase Admin (safe to do once at entry point)
if (admin.apps.length === 0) {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    const fs = require('fs');
    const path = require('path');
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
      });
    } else {
      admin.initializeApp();
    }
  } else {
    admin.initializeApp();
  }
}
const db = admin.firestore();

// Import AI Service modules
const { handleAssistantRequest } = require("./ai/assistant");
const { searchProducts } = require("./ai/search");
const { getRecommendations } = require("./ai/recommendations"); // legacy fallback
const { generateProductListingAI } = require("./ai/productIntelligence");
const { shouldRegenerateEmbedding, generateProductEmbeddingText, getEmbedding } = require("./ai/embeddings");
const { auditProductQuality, computeProductContentHash } = require("./ai/productQuality");

// Import Phase 2 Recommendation Engine
const { generateRecommendations } = require("./recommendations/generate");
const { buildUserPreferences } = require("./recommendations/preferenceEngine");

// Import Analytics & Events
const { trackMarketplaceEvent } = require("./analytics/events");

// Import Trust & Fraud
const { calculateVendorTrustScore } = require("./trust/trustScore");
const { assessVendorRisk, logFraudAuditAction } = require("./fraud/riskEngine");
const { enforceRateLimit } = require("./security");
const { logger, ERROR_CATEGORIES } = require("./utils/logger");

/**
 * -------------------------------------------------------------
 * 1. PRESERVED ORIGINAL FUNCTION: placeOrder
 * -------------------------------------------------------------
 */
exports.placeOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required to place an order.");
  }

  const { items, shippingAddress, paymentMethod } = request.data;
  if (!items || items.length === 0 || !shippingAddress || !paymentMethod) {
    throw new HttpsError("invalid-argument", "Missing required order parameters (items, shippingAddress, paymentMethod).");
  }

  const buyerId = request.auth.uid;
  const buyerEmail = request.auth.token.email || "";

  try {
    const itemsByVendor = {};
    items.forEach(item => {
      if (!itemsByVendor[item.vendorId]) {
        itemsByVendor[item.vendorId] = [];
      }
      itemsByVendor[item.vendorId].push(item);
    });

    const orderResults = [];

    await db.runTransaction(async (transaction) => {
      const productDocs = {};
      
      for (const item of items) {
        const productRef = db.collection("products").doc(item.productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists) {
          throw new HttpsError("not-found", `Product with ID ${item.productId} was not found.`);
        }

        const productData = productSnap.data();
        if (productData.stock < item.quantity) {
          throw new HttpsError("resource-exhausted", `Insufficient stock for product: ${productData.title}. Only ${productData.stock} units left.`);
        }

        productDocs[item.productId] = { ref: productRef, data: productData };
      }

      const orderPromises = Object.keys(itemsByVendor).map(async (vendorId) => {
        const vendorItems = itemsByVendor[vendorId];
        let vendorSubtotal = 0;

        const orderItems = vendorItems.map(item => {
          const product = productDocs[item.productId];
          const serverPrice = product.data.price; 
          vendorSubtotal += serverPrice * item.quantity;

          transaction.update(product.ref, {
            stock: product.data.stock - item.quantity
          });

          return {
            productId: item.productId,
            title: product.data.title,
            price: serverPrice,
            quantity: item.quantity,
            variant: item.variant || "Default"
          };
        });

        const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const orderRef = db.collection("orders").doc(orderId);
        
        const orderData = {
          orderId,
          buyerId,
          buyerEmail,
          vendorId,
          vendorName: vendorItems[0].vendorName || "Verified Merchant",
          items: orderItems,
          total: vendorSubtotal,
          shippingCost: 250, 
          status: "pending",
          shippingAddress,
          paymentMethod,
          createdAt: new Date().toISOString()
        };

        transaction.set(orderRef, orderData);
        orderResults.push({ orderId, total: vendorSubtotal + 250 });
      });

      await Promise.all(orderPromises);
    });

    return {
      success: true,
      orders: orderResults,
      message: "Order placed successfully. Inventory updated atomically."
    };

  } catch (error) {
    console.error("placeOrder transaction failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while creating your order.", error.message);
  }
});

/**
 * -------------------------------------------------------------
 * 2. PRESERVED ORIGINAL FUNCTION: initiatePayment
 * -------------------------------------------------------------
 */
exports.initiatePayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required to initiate payments.");
  }

  const { orderId, paymentMethod, amount } = request.data;
  if (!orderId || !paymentMethod || !amount) {
    throw new HttpsError("invalid-argument", "Missing parameters for payment initiation.");
  }

  const JAZZCASH_MERCHANT_ID = process.env.JAZZCASH_MERCHANT_ID || "MOCK_JAZZCASH_MID";
  const JAZZCASH_PASSWORD = process.env.JAZZCASH_PASSWORD || "MOCK_JAZZCASH_PASS";
  const JAZZCASH_SALT = process.env.JAZZCASH_SALT || "MOCK_JAZZCASH_SALT";

  const EASYPAISA_STORE_ID = process.env.EASYPAISA_STORE_ID || "MOCK_EASYPAISA_STORE";
  const EASYPAISA_HASH_KEY = process.env.EASYPAISA_HASH_KEY || "MOCK_EASYPAISA_KEY";

  const SADAPAY_API_KEY = process.env.SADAPAY_API_KEY || "MOCK_SADAPAY_KEY";

  try {
    let paymentResponse = {};

    switch (paymentMethod) {
      case "easypaisa":
        console.log(`Initiating Easypaisa checkout for order ${orderId} (Rs. ${amount})`);
        paymentResponse = {
          method: "easypaisa",
          checkoutUrl: `https://easypay.easypaisa.com.pk/easypay/index.jsf?storeId=${EASYPAISA_STORE_ID}&amount=${amount}&postBackURL=https://vendora.pk/payment/success`,
          orderId,
          amount,
          status: "redirect_required"
        };
        break;

      case "jazzcash":
        console.log(`Initiating JazzCash checkout for order ${orderId} (Rs. ${amount})`);
        paymentResponse = {
          method: "jazzcash",
          checkoutUrl: `https://sandbox.jazzcash.com.pk/CustomerPortal/transaction?merchantId=${JAZZCASH_MERCHANT_ID}&amount=${amount}`,
          orderId,
          amount,
          status: "redirect_required"
        };
        break;

      case "sadapay":
        console.log(`Initiating SadaPay invoice checkout for order ${orderId} (Rs. ${amount})`);
        paymentResponse = {
          method: "sadapay",
          checkoutUrl: `https://invoice.sadapay.pk/pay-bill?invoiceId=inv-${orderId}&key=${SADAPAY_API_KEY}`,
          orderId,
          amount,
          status: "redirect_required"
        };
        break;

      default:
        throw new HttpsError("invalid-argument", `Unsupported payment method: ${paymentMethod}`);
    }

    return {
      success: true,
      ...paymentResponse
    };

  } catch (error) {
    console.error("Payment initiation failed:", error);
    throw new HttpsError("internal", "Could not connect to payment gateway portal.", error.message);
  }
});

/**
 * -------------------------------------------------------------
 * 3. REFACTORED REST ENDPOINT: api (/ai/chat)
 * Delegates execution flow to central assistant.js
 * -------------------------------------------------------------
 */
exports.api = require("firebase-functions/v2/https").onRequest(handleAssistantRequest);

/**
 * -------------------------------------------------------------
 * 4. PRESERVED ORIGINAL FIRESTORE TRIGGER: onOrderCreated
 * -------------------------------------------------------------
 */
exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with this trigger event.");
    return;
  }

  const orderData = snapshot.data();
  const { orderId, vendorId, total } = orderData;

  console.log(`Order ${orderId} created for Vendor ${vendorId}. Dispatching alert.`);

  try {
    const notificationRef = db.collection("users").doc(vendorId).collection("notifications").doc();
    
    await notificationRef.set({
      notificationId: notificationRef.id,
      title: "New Customer Purchase!",
      message: `You received a new order #${orderId.slice(0, 8)} totaling Rs. ${total.toLocaleString()}`,
      type: "new_order",
      orderId,
      read: false,
      createdAt: new Date().toISOString()
    });

    console.log(`Notification sent successfully to vendor ${vendorId}`);
  } catch (err) {
    console.error("Failed to write vendor notification record:", err);
  }
});

/**
 * -------------------------------------------------------------
 * 5. NEW PHASE 1 FOUNDATION CALLABLES
 * -------------------------------------------------------------
 */

// Helper verification: Admin check
async function checkIsAdmin(uid, tokenEmail) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (userSnap.exists && userSnap.data().role === 'admin') {
    return true;
  }
  const email = (tokenEmail || "").toLowerCase();
  if (email === 'iphoneuser0312@gmail.com') {
    return true;
  }
  return false;
}

// Helper verification: Vendor check
async function checkIsVendor(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  return userSnap.exists && userSnap.data().role === 'vendor';
}

// API: trackEvent
exports.trackEvent = onCall(async (request) => {
  const eventData = request.data;
  const uid = request.auth ? request.auth.uid : null;

  try {
    const resolvedEvent = {
      ...eventData,
      userId: uid
    };
    const res = await trackMarketplaceEvent(resolvedEvent);
    return res;
  } catch (error) {
    console.error("trackEvent call failed:", error);
    throw new HttpsError("invalid-argument", error.message);
  }
});

// API: getRecommendations (legacy — kept for backward compatibility)
exports.getRecommendations = onCall(async (request) => {
  const limit = Math.min(10, Math.max(1, parseInt(request.data.limit) || 5));
  const uid = request.auth ? request.auth.uid : "anonymous";

  try {
    const productsList = await getRecommendations({ userId: uid, limit });
    return { success: true, products: productsList };
  } catch (error) {
    console.error("getRecommendations call failed:", error);
    throw new HttpsError("internal", "Failed to retrieve recommended catalog products.");
  }
});

// API: getPersonalisedRecommendations (Phase 2 — full hybrid engine)
exports.getPersonalisedRecommendations = onCall(async (request) => {
  const uid = request.auth ? request.auth.uid : "anonymous";
  const {
    context = "HOME",
    seedProductId = null,
    categoryId = null,
    limit = 10,
    skipCache = false
  } = request.data || {};

  // Validate limit
  const safeLimit = Math.min(20, Math.max(1, parseInt(limit) || 10));

  try {
    const result = await generateRecommendations({
      userId: uid,
      context,
      seedProductId,
      categoryId,
      limit: safeLimit,
      skipCache
    });
    return { success: true, ...result };
  } catch (error) {
    console.error("getPersonalisedRecommendations failed:", error);
    throw new HttpsError("internal", "Failed to generate recommendations.");
  }
});

// API: buildUserPreferences (callable by authenticated user for own profile)
exports.buildUserPreferences = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  try {
    const prefs = await buildUserPreferences(uid);
    return { success: true, eventCount: prefs.eventCount };
  } catch (error) {
    console.error("buildUserPreferences failed:", error);
    throw new HttpsError("internal", "Failed to build preference profile.");
  }
});

// API: searchProducts
exports.searchProducts = onCall(async (request) => {
  const { query: searchQuery, language, filters } = request.data;
  const uid = request.auth ? request.auth.uid : null;

  try {
    const results = await searchProducts({
      query: searchQuery,
      language,
      filters,
      userId: uid
    });
    return { success: true, results };
  } catch (error) {
    console.error("searchProducts call failed:", error);
    throw new HttpsError("internal", "Failed to perform natural language search.");
  }
});

// API: requestCategory (Vendor only)
exports.requestCategory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to request a category.");
  }
  
  const isVendor = await checkIsVendor(request.auth.uid);
  if (!isVendor) {
    throw new HttpsError("permission-denied", "Only vendors are permitted to make category requests.");
  }

  const { requestedName, reason } = request.data;
  if (!requestedName || !reason) {
    throw new HttpsError("invalid-argument", "requestedName and reason are required parameters.");
  }

  const vendorId = request.auth.uid;
  const vendorSnap = await db.collection("vendors").doc(vendorId).get();
  const vendorName = vendorSnap.exists ? (vendorSnap.data().businessName || "Verified Vendor") : "Verified Vendor";

  const requestedSlug = requestedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const requestDoc = {
    requestId,
    vendorId,
    vendorName,
    requestedName,
    requestedSlug,
    reason: String(reason).substring(0, 1000),
    status: "pending",
    createdAt: new Date().toISOString()
  };

  await db.collection("category_requests").doc(requestId).set(requestDoc);

  return { success: true, requestId, message: "Category request logged successfully." };
});

// API: approveCategoryRequest (Admin only)
exports.approveCategoryRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { requestId, adminNote } = request.data;
  if (!requestId) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }

  const reqRef = db.collection("category_requests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Category request not found.");
  }

  const reqData = reqSnap.data();

  // Process approval in a transaction
  await db.runTransaction(async (transaction) => {
    transaction.update(reqRef, {
      status: "approved",
      reviewedAt: new Date().toISOString(),
      reviewedBy: request.auth.uid,
      adminNote: adminNote || "Approved"
    });

    const categoryRef = db.collection("categories").doc(reqData.requestedSlug);
    transaction.set(categoryRef, {
      slug: reqData.requestedSlug,
      name: reqData.requestedName,
      iconName: "ShoppingBag", // default fallback icon
      createdAt: new Date().toISOString()
    });
  });

  return { success: true, message: "Category request approved and category created." };
});

// API: rejectCategoryRequest (Admin only)
exports.rejectCategoryRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { requestId, adminNote } = request.data;
  if (!requestId) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }

  await db.collection("category_requests").doc(requestId).update({
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    reviewedBy: request.auth.uid,
    adminNote: adminNote || "Rejected by administrator."
  });

  return { success: true, message: "Category request rejected." };
});

// API: addCategory (Admin CRUD)
exports.addCategory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { slug, name, iconName } = request.data;
  if (!slug || !name) {
    throw new HttpsError("invalid-argument", "slug and name parameters are required.");
  }

  await db.collection("categories").doc(slug).set({
    slug,
    name,
    iconName: iconName || "ShoppingBag",
    createdAt: new Date().toISOString()
  });

  return { success: true, message: "Category added successfully." };
});

// API: updateCategory (Admin CRUD)
exports.updateCategory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { slug, name, iconName } = request.data;
  if (!slug) {
    throw new HttpsError("invalid-argument", "slug is required.");
  }

  const updateObj = {};
  if (name) updateObj.name = name;
  if (iconName) updateObj.iconName = iconName;

  await db.collection("categories").doc(slug).update(updateObj);

  return { success: true, message: "Category updated successfully." };
});

// API: deleteCategory (Admin CRUD)
exports.deleteCategory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { slug } = request.data;
  if (!slug) {
    throw new HttpsError("invalid-argument", "slug is required.");
  }

  await db.collection("categories").doc(slug).delete();

  return { success: true, message: "Category deleted successfully." };
});

// API: calculateTrust
exports.calculateTrust = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { vendorId } = request.data;
  if (!vendorId) {
    throw new HttpsError("invalid-argument", "vendorId is required.");
  }

  // Caller must be either target vendor themselves or platform administrator
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  const isSelf = request.auth.uid === vendorId;

  if (!isAdmin && !isSelf) {
    throw new HttpsError("permission-denied", "Unauthorized. You cannot recalculate trust scores for another vendor.");
  }

  try {
    const result = await calculateVendorTrustScore(vendorId);
    return { success: true, ...result };
  } catch (error) {
    console.error("calculateTrust call failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: getVendorTrustScore (Public - buyers can call this)
exports.getVendorTrustScore = onCall(async (request) => {
  const { vendorId } = request.data;
  if (!vendorId) {
    throw new HttpsError("invalid-argument", "vendorId is required.");
  }

  try {
    const snap = await db.collection("vendor_trust_scores").doc(vendorId).get();
    if (!snap.exists) {
      return { success: false, message: "Trust score not yet calculated for this vendor." };
    }
    const data = snap.data();
    // Return only buyer-safe fields — no risk signal internals
    return {
      success: true,
      vendorId,
      overallScore: data.overallScore,
      category: data.category,
      confidence: data.confidence,
      indicators: {
        verified: data.componentScores?.verification >= 80,
        reliableOrders: data.componentScores?.orderReliability >= 75,
        strongReviews: data.componentScores?.reviewsQuality >= 75,
        fastResponse: data.componentScores?.responseRate >= 80,
        goodReturns: data.componentScores?.returnPerformance >= 75
      },
      calculatedAt: data.calculatedAt
    };
  } catch (error) {
    console.error("getVendorTrustScore failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: batchRecalculateTrust (Admin only — recalculates all verified vendors)
exports.batchRecalculateTrust = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  try {
    const vendorsSnap = await db.collection("vendors").where("verified", "==", true).get();
    const results = [];
    const errors = [];

    for (const vendorDoc of vendorsSnap.docs) {
      try {
        const result = await calculateVendorTrustScore(vendorDoc.id);
        results.push({ vendorId: vendorDoc.id, score: result.overallScore, category: result.category });
      } catch (err) {
        errors.push({ vendorId: vendorDoc.id, error: err.message });
      }
    }

    return {
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    };
  } catch (error) {
    console.error("batchRecalculateTrust failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: assessVendorRisk (Admin only)
exports.assessVendorRisk = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { vendorId } = request.data;
  if (!vendorId) {
    throw new HttpsError("invalid-argument", "vendorId is required.");
  }

  try {
    const result = await assessVendorRisk(vendorId);
    return { success: true, ...result };
  } catch (error) {
    console.error("assessVendorRisk call failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: scanMarketplaceSafety (Admin only - scans all active vendors for fraud & safety signals)
exports.scanMarketplaceSafety = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  try {
    const vendorsSnap = await db.collection("vendors").get();
    const results = [];
    let highRiskCount = 0;
    let criticalRiskCount = 0;

    for (const vendorDoc of vendorsSnap.docs) {
      try {
        const assessment = await assessVendorRisk(vendorDoc.id);
        results.push({
          vendorId: vendorDoc.id,
          score: assessment.score,
          level: assessment.level,
          flags: assessment.flags
        });
        if (assessment.level === "HIGH") highRiskCount++;
        if (assessment.level === "CRITICAL") criticalRiskCount++;
      } catch (err) {
        console.warn(`Safety scan error for vendor ${vendorDoc.id}:`, err.message);
      }
    }

    return {
      success: true,
      scannedVendors: vendorsSnap.size,
      processed: results.length,
      highRiskCount,
      criticalRiskCount,
      results
    };
  } catch (error) {
    console.error("scanMarketplaceSafety call failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: updateFraudEventStatus (Admin only - transitions fraud review state with audit log)
exports.updateFraudEventStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { eventId, newStatus, adminNotes = "" } = request.data;
  const validStatuses = ["NEW", "UNDER_REVIEW", "CLEARED", "ACTION_REQUIRED", "RESOLVED"];
  if (!eventId || !newStatus || !validStatuses.includes(newStatus)) {
    throw new HttpsError("invalid-argument", `Invalid eventId or status. Allowed: ${validStatuses.join(", ")}`);
  }

  try {
    const eventRef = db.collection("fraud_events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", `Fraud event ${eventId} not found.`);
    }

    const previousStatus = eventSnap.data().status || "NEW";
    const entityId = eventSnap.data().entityId;

    await eventRef.update({
      status: newStatus,
      adminNotes: adminNotes || eventSnap.data().adminNotes || "",
      reviewedBy: request.auth.token.email || request.auth.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log to immutable audit trail
    await logFraudAuditAction({
      eventId,
      entityId,
      adminId: request.auth.uid,
      adminEmail: request.auth.token.email || "admin@vendora.pk",
      action: `STATUS_CHANGE_TO_${newStatus}`,
      previousStatus,
      newStatus,
      notes: adminNotes
    });

    return { success: true, eventId, previousStatus, newStatus };
  } catch (error) {
    console.error("updateFraudEventStatus call failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: adminTakeSafetyAction (Admin only - executes business action e.g. suspend/restore vendor)
exports.adminTakeSafetyAction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized administrative action.");
  }

  const { entityId, action, eventId = null, reason = "" } = request.data;
  if (!entityId || !action) {
    throw new HttpsError("invalid-argument", "entityId and action are required.");
  }

  try {
    if (action === "SUSPEND_VENDOR") {
      await db.collection("vendors").doc(entityId).update({
        status: "suspended",
        suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
        suspensionReason: reason || "Administrative safety enforcement"
      });
    } else if (action === "RESTORE_VENDOR") {
      await db.collection("vendors").doc(entityId).update({
        status: "approved",
        suspendedAt: null,
        suspensionReason: null
      });
    }

    // If linked to a fraud event, update event status
    if (eventId) {
      const nextEventStatus = action === "SUSPEND_VENDOR" ? "ACTION_REQUIRED" : "RESOLVED";
      await db.collection("fraud_events").doc(eventId).update({
        status: nextEventStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Log to immutable audit trail
    await logFraudAuditAction({
      eventId,
      entityId,
      adminId: request.auth.uid,
      adminEmail: request.auth.token.email || "admin@vendora.pk",
      action,
      notes: reason
    });

    return { success: true, entityId, action, reason };
  } catch (error) {
    console.error("adminTakeSafetyAction call failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

// API: getAdminContact
exports.getAdminContact = onCall(async (request) => {
  try {
    const contactSnap = await db.collection("admin_settings").doc("contact").get();
    if (contactSnap.exists) {
      return { success: true, settings: contactSnap.data() };
    }
    // Seed initial setting if not present
    const defaultSettings = {
      adminEmail: "iphoneuser0312@gmail.com",
      supportEmail: "support@vendora.pk",
      updatedAt: new Date().toISOString()
    };
    await db.collection("admin_settings").doc("contact").set(defaultSettings);
    return { success: true, settings: defaultSettings };
  } catch (error) {
    console.error("getAdminContact failed:", error);
    throw new HttpsError("internal", "Failed to retrieve support contact details.");
  }
});

// Triggers for Trust Score recalculation on events
exports.onOrderUpdated = onDocumentUpdated("orders/{orderId}", async (event) => {
  const change = event.data;
  if (!change) return;
  const before = change.before.data();
  const after = change.after.data();

  if (before.status !== after.status) {
    console.log(`Order status transitioned from ${before.status} to ${after.status} for vendor ${after.vendorId}. Recalculating trust score.`);
    try {
      await calculateVendorTrustScore(after.vendorId);
    } catch (err) {
      console.error("Failed to recalculate trust score on order update:", err.message);
    }
  }
});

exports.onReviewCreated = onDocumentCreated("reviews/{reviewId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const review = snapshot.data();
  console.log(`New review submitted for product ${review.productId}. Recalculating vendor trust score.`);
  try {
    const productSnap = await db.collection("products").doc(review.productId).get();
    if (productSnap.exists) {
      const vendorId = productSnap.data().vendorId;
      if (vendorId) {
        await calculateVendorTrustScore(vendorId);
      }
    }
  } catch (err) {
    console.error("Failed to recalculate trust score on review creation:", err.message);
  }
});

exports.onVendorUpdated = onDocumentUpdated("vendors/{vendorId}", async (event) => {
  const change = event.data;
  if (!change) return;
  const before = change.before.data();
  const after = change.after.data();

  if (before.verified !== after.verified || before.rating !== after.rating || before.responseRate !== after.responseRate) {
    console.log(`Vendor ${event.params.vendorId} metadata updated. Recalculating trust score.`);
    try {
      await calculateVendorTrustScore(event.params.vendorId);
    } catch (err) {
      console.error("Failed to recalculate trust score on vendor update:", err.message);
    }
  }
});

// =============================================================
// PHASE 7: AI PRODUCT INTELLIGENCE & EMBEDDING PIPELINE
// =============================================================

// API: generateProductListingAI (Vendor-authenticated)
exports.generateProductListingAI = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to use AI Product Assistant.");
  }
  enforceRateLimit(request.auth.uid, "generateProductListingAI", 5, 60000); // 5 reqs per minute

  const { title, description = "", category = "handicrafts", price = 0, specifications = {}, productId = null } = request.data;
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new HttpsError("invalid-argument", "Product title or base description is required.");
  }

  // Security authorization: if updating an existing product, caller must be the owner or admin
  if (productId) {
    const prodDoc = await db.collection("products").doc(productId).get();
    if (prodDoc.exists) {
      const prodData = prodDoc.data();
      const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
      if (prodData.vendorId !== request.auth.uid && !isAdmin) {
        throw new HttpsError("permission-denied", "Unauthorized. You cannot generate AI content for products you do not own.");
      }
    }
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || null;
    const startTime = Date.now();
    const result = await generateProductListingAI({
      title,
      description,
      category,
      price,
      specifications,
      apiKey
    });
    const latency = Date.now() - startTime;
    logger.info("AI_PERFORMANCE", `Product generation completed in ${latency}ms`, { latency }, request.auth.uid);

    return {
      success: true,
      data: result
    };
  } catch (error) {
    logger.error(ERROR_CATEGORIES.AI_ERROR, "generateProductListingAI call failed", { error: error.message }, request.auth.uid);
    throw new HttpsError("internal", error.message);
  }
});

// Trigger: onProductWritten (Intelligent Embedding Updates)
exports.onProductWritten = onDocumentWritten("products/{productId}", async (event) => {
  const change = event.data;
  if (!change) return;

  const before = change.before?.exists ? change.before.data() : null;
  const after = change.after?.exists ? change.after.data() : null;

  // Product deleted
  if (!after) return;

  // 1. Asynchronous Quality & Completeness Audit (Phase 8)
  try {
    const currentContentHash = computeProductContentHash(after);
    if (!after.qualityAudit || after.qualityAudit.contentHash !== currentContentHash) {
      console.log(`Auditing product quality for ${event.params.productId}...`);
      const qualityResult = auditProductQuality(after);
      await db.collection("products").doc(event.params.productId).update({
        qualityAudit: qualityResult
      });
      console.log(`Product ${event.params.productId} quality score: ${qualityResult.overallScore}/100 (${qualityResult.rating})`);
    }
  } catch (qualityErr) {
    console.warn(`Failed to audit product quality for ${event.params.productId}:`, qualityErr.message);
  }

  // 2. Embedding Generation (Skip if core listing text unchanged)
  if (!shouldRegenerateEmbedding(before, after)) {
    console.log(`Product ${event.params.productId} updated, but listing text unchanged. Skipping embedding regeneration.`);
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY || null;
  if (!apiKey) {
    console.log(`Product ${event.params.productId} saved, but OPENROUTER_API_KEY not configured. Skipping embedding vector generation.`);
    return;
  }

  try {
    const textToEmbed = generateProductEmbeddingText(after);
    const embedding = await getEmbedding(textToEmbed, apiKey);

    // Save vector representation directly to product document
    await db.collection("products").doc(event.params.productId).update({
      embedding,
      embeddingUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Successfully generated and updated embedding vector for product ${event.params.productId}`);
  } catch (err) {
    console.warn(`Failed to generate product embedding for ${event.params.productId}:`, err.message);
  }
});

// =============================================================
// PHASE 8: AI PRODUCT & IMAGE QUALITY ANALYSIS CALLABLES
// =============================================================

// Callable: analyzeProductQuality (Vendor-facing live audit or backend check)
exports.analyzeProductQuality = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to analyze product quality.");
  }

  const { product, productId, force = false } = request.data;
  if (!product && !productId) {
    throw new HttpsError("invalid-argument", "Product data or productId is required.");
  }

  let productToAudit = product;
  if (productId && !productToAudit) {
    const prodDoc = await db.collection("products").doc(productId).get();
    if (!prodDoc.exists) {
      throw new HttpsError("not-found", "Product not found.");
    }
    productToAudit = { id: prodDoc.id, ...prodDoc.data() };
  }

  // Verify ownership if caller is a vendor
  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (productToAudit.vendorId && productToAudit.vendorId !== request.auth.uid && !isAdmin) {
    throw new HttpsError("permission-denied", "Unauthorized. You cannot analyze products you do not own.");
  }

  try {
    const auditResult = auditProductQuality(productToAudit, { force: Boolean(force) });

    // If product exists in Firestore, persist quality audit cache
    if (productId || productToAudit.id) {
      const docId = productId || productToAudit.id;
      await db.collection("products").doc(docId).update({
        qualityAudit: auditResult
      });
    }

    return {
      success: true,
      data: auditResult
    };
  } catch (err) {
    console.error("analyzeProductQuality failed:", err);
    throw new HttpsError("internal", err.message);
  }
});

// Callable: moderateProductQuality (Admin-only moderation decision)
exports.moderateProductQuality = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const isAdmin = await checkIsAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin privileges required to moderate product quality.");
  }

  const { productId, status, reviewNotes = "" } = request.data;
  if (!productId || !["APPROVED", "REJECTED", "FLAGGED_FOR_REVIEW"].includes(status)) {
    throw new HttpsError("invalid-argument", "Valid productId and status (APPROVED, REJECTED, FLAGGED_FOR_REVIEW) are required.");
  }

  try {
    const updatePayload = {
      "qualityAudit.moderationStatus": status,
      "qualityAudit.moderationNotes": reviewNotes,
      "qualityAudit.moderatedBy": request.auth.token.email || request.auth.uid,
      "qualityAudit.moderatedAt": admin.firestore.FieldValue.serverTimestamp()
    };

    // If rejected, set product status to hidden
    if (status === "REJECTED") {
      updatePayload.status = "hidden";
    } else if (status === "APPROVED") {
      updatePayload.status = "active";
    }

    await db.collection("products").doc(productId).update(updatePayload);

    // Record immutable audit action
    await logFraudAuditAction({
      adminId: request.auth.uid,
      adminEmail: request.auth.token.email || "admin@vendora.pk",
      targetEntityId: productId,
      targetEntityType: "product",
      action: `MODERATE_PRODUCT_QUALITY_${status}`,
      reason: reviewNotes || `Admin set product moderation status to ${status}`,
      metadata: { productId, status }
    });

    return {
      success: true,
      status
    };
  } catch (err) {
    console.error("moderateProductQuality failed:", err);
    throw new HttpsError("internal", err.message);
  }
});

// =============================================================
// PHASE 9: INTELLIGENT SEARCH & DISCOVERY CALLABLE
// =============================================================
exports.intelligentSearch = onCall(async (request) => {
  const { query, language, filters = {}, limit = 20 } = request.data || {};
  const userId = request.auth ? request.auth.uid : null;
  
  if (userId) {
    enforceRateLimit(userId, "intelligentSearch", 20, 60000); // 20 reqs per minute for logged-in users
  }

  try {
    const startTime = Date.now();
    const searchResponse = await searchProducts({
      query: query || "",
      language,
      filters,
      limit,
      userId,
      apiKey: process.env.OPENROUTER_API_KEY || null
    });
    const latency = Date.now() - startTime;
    if (latency > 2000) {
      logger.warn("PERFORMANCE_WARNING", `intelligentSearch took ${latency}ms`, { latency, query }, userId);
    }

    return {
      success: true,
      ...searchResponse
    };
  } catch (err) {
    logger.error(ERROR_CATEGORIES.SEARCH_ERROR, "intelligentSearch error", { error: err.message }, userId);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 11: AI Vendor Assistant Cloud Function
 * Strictly authorized: enforces authenticated session and vendor ownership.
 */
exports.vendorAIAssistant = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in to consult the AI Vendor Assistant.");
  }
  enforceRateLimit(request.auth.uid, "vendorAIAssistant", 10, 60000); // 10 reqs per minute

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "vendor") {
    throw new HttpsError("permission-denied", "Unauthorized: Only registered vendors can access the AI Vendor Assistant.");
  }

  const { prompt } = request.data || {};
  if (!prompt || typeof prompt !== "string") {
    throw new HttpsError("invalid-argument", "Prompt is required.");
  }

  try {
    const { processVendorAssistantQuery } = require("./ai/vendorAssistant");
    const result = await processVendorAssistantQuery({
      prompt,
      vendorId: uid // Derived securely from authenticated session
    });

    return {
      success: true,
      ...result
    };
  } catch (err) {
    console.error("vendorAIAssistant error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 12: AI Admin Copilot Cloud Function
 * Strictly authorized: requires active admin session.
 */
exports.adminCopilot = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in to consult the AI Admin Copilot.");
  }
  enforceRateLimit(request.auth.uid, "adminCopilot", 10, 60000); // 10 reqs per minute

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Unauthorized: Only administrators can access the AI Admin Copilot.");
  }

  const { prompt } = request.data || {};
  if (!prompt || typeof prompt !== "string") {
    throw new HttpsError("invalid-argument", "Prompt is required.");
  }

  try {
    const { processAdminCopilotQuery } = require("./ai/adminCopilot");
    const result = await processAdminCopilotQuery({
      prompt,
      adminId: uid,
      adminEmail: userDoc.data().email || request.auth.token?.email || "admin@vendora.pk"
    });

    return {
      success: true,
      ...result
    };
  } catch (err) {
    console.error("adminCopilot error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 13: Advanced Marketplace Analytics Aggregator Endpoint
 * Strictly authorized: requires active admin session.
 */
exports.getAdvancedMarketplaceAnalytics = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in as an administrator.");
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Unauthorized: Only administrators can view advanced platform analytics.");
  }

  const { dateRange, customStart, customEnd, forceRefresh } = request.data || {};

  try {
    const { getAdvancedMarketplaceAnalytics } = require("./analytics/marketplaceAnalytics");
    const analytics = await getAdvancedMarketplaceAnalytics({
      dateRange: dateRange || "30d",
      customStart,
      customEnd,
      forceRefresh: !!forceRefresh
    });

    return {
      success: true,
      ...analytics
    };
  } catch (err) {
    console.error("getAdvancedMarketplaceAnalytics error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 15: Intelligent Notification Pipeline Endpoint
 */
exports.sendIntelligentNotification = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be authenticated to dispatch notifications.");
  }

  const callerUid = request.auth.uid;
  const { type, recipientId, entityId, data } = request.data || {};

  try {
    const userDoc = await admin.firestore().collection("users").doc(callerUid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === "admin";

    const { processNotificationEvent } = require("./notifications/notificationEngine");
    const result = await processNotificationEvent(
      {
        type,
        recipientId: recipientId || callerUid,
        requesterId: callerUid,
        entityId,
        data: data || {}
      },
      {
        isAdmin,
        userEmail: request.auth.token?.email
      }
    );

    return result;
  } catch (err) {
    console.error("sendIntelligentNotification error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 15: Get User Notification Preferences
 */
exports.getNotificationPreferences = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  try {
    const { getUserPreferences } = require("./notifications/notificationEngine");
    const preferences = await getUserPreferences(uid);
    return { success: true, preferences };
  } catch (err) {
    console.error("getNotificationPreferences error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 15: Update User Notification Preferences
 */
exports.updateNotificationPreferences = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const { preferences } = request.data || {};

  if (!preferences || typeof preferences !== "object") {
    throw new HttpsError("invalid-argument", "Invalid preferences payload.");
  }

  try {
    await admin.firestore().collection("user_notification_preferences").doc(uid).set(preferences, { merge: true });
    return { success: true, preferences };
  } catch (err) {
    console.error("updateNotificationPreferences error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Phase 16: Vendor Category Request + Admin Approval Workflow Endpoints
 */
exports.submitCategoryRequest = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication required to request categories.");
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "vendor") {
    throw new HttpsError("permission-denied", "Only registered vendors can submit category requests.");
  }

  const { categoryName, description, reason, parentCategory } = request.data || {};
  try {
    const { submitCategoryRequest } = require("./categories/categoryManager");
    const result = await submitCategoryRequest({
      vendorId: uid,
      vendorEmail: userDoc.data().email || request.auth.token?.email,
      vendorBusinessName: userDoc.data().businessName || "Artisan Vendor",
      categoryName,
      description,
      reason,
      parentCategory
    });
    return { success: true, request: result };
  } catch (err) {
    console.error("submitCategoryRequest error:", err);
    throw new HttpsError("invalid-argument", err.message);
  }
});

exports.reviewCategoryRequest = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Admin authentication required.");
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Only administrators can review category requests.");
  }

  const { requestId, decision, reason } = request.data || {};
  try {
    const { reviewCategoryRequest } = require("./categories/categoryManager");
    const result = await reviewCategoryRequest({
      requestId,
      decision,
      reason,
      adminUid: uid,
      adminEmail: userDoc.data().email || "admin@vendora.pk"
    });
    return result;
  } catch (err) {
    console.error("reviewCategoryRequest error:", err);
    throw new HttpsError("invalid-argument", err.message);
  }
});

exports.cancelCategoryRequest = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = request.auth.uid;
  const { requestId } = request.data || {};
  try {
    const { cancelCategoryRequest } = require("./categories/categoryManager");
    const result = await cancelCategoryRequest({ requestId, vendorId: uid });
    return result;
  } catch (err) {
    console.error("cancelCategoryRequest error:", err);
    throw new HttpsError("permission-denied", err.message);
  }
});

exports.manageMarketplaceCategory = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Admin authentication required.");
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Only administrators can modify marketplace categories.");
  }

  const { action, id, name, description, parentCategory, active, updates } = request.data || {};
  const categoryManager = require("./categories/categoryManager");

  try {
    switch (action) {
      case "CREATE":
        return { success: true, category: await categoryManager.createCategory({ name, description, parentCategory, adminUid: uid, adminEmail: userDoc.data().email }) };
      case "UPDATE":
        return { success: true, category: await categoryManager.updateCategory({ id, updates: updates || { name, description, parentCategory }, adminUid: uid, adminEmail: userDoc.data().email }) };
      case "TOGGLE_STATUS":
        return { success: true, category: await categoryManager.toggleCategoryStatus({ id, active, adminUid: uid, adminEmail: userDoc.data().email }) };
      case "DELETE":
        return await categoryManager.deleteCategory({ id, adminUid: uid, adminEmail: userDoc.data().email });
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("manageMarketplaceCategory error:", err);
    throw new HttpsError("invalid-argument", err.message);
  }
});

exports.getCategoryRequests = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  const isAdmin = userDoc.exists && userDoc.data().role === "admin";

  const { status } = request.data || {};
  try {
    const { getCategoryRequests } = require("./categories/categoryManager");
    const requests = await getCategoryRequests({
      vendorId: uid,
      isAdmin,
      status
    });
    return { success: true, requests };
  } catch (err) {
    console.error("getCategoryRequests error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Buyer ↔ Vendor Real-Time Chat Cloud Functions
 */
exports.createOrGetChatConversation = onCall({ cors: true }, async (request) => {
  try {
    const { handleCreateOrGetConversation } = require("./chat");
    return await handleCreateOrGetConversation(request.data, request);
  } catch (err) {
    console.error("createOrGetChatConversation error:", err);
    throw new HttpsError("internal", err.message);
  }
});

exports.sendMarketplaceMessage = onCall({ cors: true }, async (request) => {
  try {
    const { handleSendChatMessage } = require("./chat");
    return await handleSendChatMessage(request.data, request);
  } catch (err) {
    console.error("sendMarketplaceMessage error:", err);
    throw new HttpsError("internal", err.message);
  }
});

exports.adminManageChat = onCall({ cors: true }, async (request) => {
  try {
    const { handleAdminManageChat } = require("./chat");
    return await handleAdminManageChat(request.data, request);
  } catch (err) {
    console.error("adminManageChat error:", err);
    throw new HttpsError("internal", err.message);
  }
});





