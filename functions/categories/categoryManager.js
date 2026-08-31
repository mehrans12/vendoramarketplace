/**
 * Category Management & Vendor Request Engine (Phase 16)
 * 
 * Centralizes category control under Admin governance while enabling
 * structured Vendor requests, approval workflows, audit trails, and email alerts.
 */

const admin = require("firebase-admin");

const REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED"
};

const DEFAULT_CATEGORIES = [
  { id: "handicrafts", slug: "handicrafts", name: "Handicrafts & Art", description: "Authentic handmade pottery, brass, woodwork and textiles", parentCategory: null, active: true },
  { id: "fashion", slug: "fashion", name: "Fashion & Apparel", description: "Handloom shawls, embroidered kurtas and traditional footwear", parentCategory: null, active: true },
  { id: "home-decor", slug: "home-decor", name: "Home & Living", description: "Glazed terracotta, rugs, lamps and regional ornaments", parentCategory: null, active: true },
  { id: "jewelry", slug: "jewelry", name: "Jewelry & Accessories", description: "Silver filigree, handmade bangles and ethnic stones", parentCategory: null, active: true },
  { id: "electronics", slug: "electronics", name: "Electronics & Tech", description: "Modern gadgets and artisan tech accessories", parentCategory: null, active: true },
  { id: "spices", slug: "spices", name: "Spices & Groceries", description: "Organic spices, saffron, dry fruits and regional delicacies", parentCategory: null, active: true }
];

// In-memory cache for fast local testing and fallback
let memoryCategories = [...DEFAULT_CATEGORIES];
let memoryRequests = [];
let memoryAuditLogs = [];

/**
 * Creates slug from category name
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Helper to record category audit logs
 */
async function recordAuditLog({
  action,
  categoryId = null,
  requestId = null,
  requester = {},
  adminDecision = null,
  metadata = {}
}) {
  const logEntry = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    categoryId,
    requestId,
    requester: {
      uid: requester.uid || "system",
      email: requester.email || "system@vendora.pk",
      role: requester.role || "vendor"
    },
    adminDecision: adminDecision ? {
      status: adminDecision.status,
      reason: adminDecision.reason || null,
      adminUid: adminDecision.adminUid || "admin"
    } : null,
    metadata,
    timestamp: new Date().toISOString()
  };

  memoryAuditLogs.unshift(logEntry);

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("category_audit_logs").doc(logEntry.id).set(logEntry);
    } catch (err) {
      console.warn("Failed to write category audit log:", err.message);
    }
  }

  return logEntry;
}

/**
 * 1. GET ALL CATEGORIES
 */
async function getCategories({ includeInactive = false } = {}) {
  if (admin.apps && admin.apps.length > 0) {
    try {
      const snap = await admin.firestore().collection("marketplace_categories").get();
      if (!snap.empty) {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return includeInactive ? list : list.filter(c => c.active !== false);
      }
    } catch (e) {
      console.warn("Falling back to local categories:", e.message);
    }
  }

  return includeInactive ? memoryCategories : memoryCategories.filter(c => c.active !== false);
}

/**
 * 2. ADMIN CREATE CATEGORY
 */
async function createCategory({ name, description, parentCategory = null, adminUid, adminEmail }) {
  if (!name || !name.trim()) {
    throw new Error("Category name is required.");
  }

  const slug = slugify(name);
  const exists = memoryCategories.some(c => c.slug === slug || c.id === slug);
  if (exists) {
    throw new Error(`Category with slug "${slug}" already exists.`);
  }

  const newCategory = {
    id: slug,
    slug,
    name: name.trim(),
    description: description ? description.trim() : "",
    parentCategory: parentCategory || null,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  memoryCategories.push(newCategory);

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("marketplace_categories").doc(slug).set(newCategory);
    } catch (err) {
      console.warn("Failed saving category to Firestore:", err.message);
    }
  }

  await recordAuditLog({
    action: "CATEGORY_CREATED",
    categoryId: slug,
    requester: { uid: adminUid, email: adminEmail, role: "admin" },
    metadata: { name: newCategory.name, parentCategory: newCategory.parentCategory }
  });

  return newCategory;
}

/**
 * 3. ADMIN UPDATE CATEGORY
 */
async function updateCategory({ id, updates, adminUid, adminEmail }) {
  const index = memoryCategories.findIndex(c => c.id === id || c.slug === id);
  if (index === -1) {
    throw new Error(`Category "${id}" not found.`);
  }

  const updated = {
    ...memoryCategories[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  memoryCategories[index] = updated;

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("marketplace_categories").doc(id).update(updates);
    } catch (err) {
      console.warn("Failed updating category in Firestore:", err.message);
    }
  }

  await recordAuditLog({
    action: "CATEGORY_UPDATED",
    categoryId: id,
    requester: { uid: adminUid, email: adminEmail, role: "admin" },
    metadata: { updates }
  });

  return updated;
}

/**
 * 4. ADMIN TOGGLE STATUS (ACTIVATE / DEACTIVATE)
 */
async function toggleCategoryStatus({ id, active, adminUid, adminEmail }) {
  return await updateCategory({
    id,
    updates: { active: !!active },
    adminUid,
    adminEmail
  });
}

/**
 * 5. ADMIN DELETE CATEGORY
 */
async function deleteCategory({ id, adminUid, adminEmail }) {
  memoryCategories = memoryCategories.filter(c => c.id !== id && c.slug !== id);

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("marketplace_categories").doc(id).delete();
    } catch (err) {
      console.warn("Failed deleting category from Firestore:", err.message);
    }
  }

  await recordAuditLog({
    action: "CATEGORY_DELETED",
    categoryId: id,
    requester: { uid: adminUid, email: adminEmail, role: "admin" }
  });

  return { success: true, id };
}

/**
 * 6. VENDOR SUBMITS CATEGORY REQUEST
 */
async function submitCategoryRequest({
  vendorId,
  vendorEmail,
  vendorBusinessName,
  categoryName,
  description,
  reason,
  parentCategory = null
}) {
  if (!vendorId) throw new Error("Vendor authentication required.");
  if (!categoryName || !categoryName.trim()) throw new Error("Requested category name is required.");
  if (!reason || !reason.trim()) throw new Error("Justification reason is required.");

  const requestId = `cat-req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const requestDoc = {
    id: requestId,
    vendorId,
    vendorEmail: vendorEmail || "vendor@vendora.pk",
    vendorBusinessName: vendorBusinessName || "Artisan Merchant",
    categoryName: categoryName.trim(),
    description: description ? description.trim() : "",
    reason: reason.trim(),
    parentCategory: parentCategory || null,
    status: REQUEST_STATUS.PENDING,
    rejectionReason: null,
    approvedCategoryId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  memoryRequests.unshift(requestDoc);

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("category_requests").doc(requestId).set(requestDoc);

      // Trigger email to administrator backend without exposing credentials to frontend
      await admin.firestore().collection("email_notifications").add({
        recipientEmail: process.env.ADMIN_EMAIL || "admin@vendora.pk",
        subject: `[Vendora Admin] New Category Request: "${requestDoc.categoryName}"`,
        body: `Vendor "${requestDoc.vendorBusinessName}" (${requestDoc.vendorEmail}) requested a new marketplace category:\n\n` +
              `Name: ${requestDoc.categoryName}\n` +
              `Description: ${requestDoc.description || 'N/A'}\n` +
              `Reason: ${requestDoc.reason}\n` +
              `Parent: ${requestDoc.parentCategory || 'None'}\n\n` +
              `Review this request in the Vendora Admin Dashboard.`,
        sentAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Failed writing category request to Firestore:", err.message);
    }
  }

  await recordAuditLog({
    action: "REQUEST_SUBMITTED",
    requestId,
    requester: { uid: vendorId, email: vendorEmail, role: "vendor" },
    metadata: {
      categoryName: requestDoc.categoryName,
      reason: requestDoc.reason,
      businessName: requestDoc.vendorBusinessName
    }
  });

  return requestDoc;
}

/**
 * 7. ADMIN REVIEWS REQUEST (APPROVE / REJECT)
 */
async function reviewCategoryRequest({
  requestId,
  decision, // 'APPROVED' | 'REJECTED'
  reason = null,
  adminUid,
  adminEmail
}) {
  if (decision !== REQUEST_STATUS.APPROVED && decision !== REQUEST_STATUS.REJECTED) {
    throw new Error("Invalid review decision. Must be APPROVED or REJECTED.");
  }
  if (decision === REQUEST_STATUS.REJECTED && (!reason || !reason.trim())) {
    throw new Error("Rejection reason is required when rejecting a category request.");
  }

  const reqIndex = memoryRequests.findIndex(r => r.id === requestId);
  let requestObj = reqIndex !== -1 ? memoryRequests[reqIndex] : null;

  if (!requestObj && admin.apps && admin.apps.length > 0) {
    const docSnap = await admin.firestore().collection("category_requests").doc(requestId).get();
    if (docSnap.exists) {
      requestObj = { id: docSnap.id, ...docSnap.data() };
    }
  }

  if (!requestObj) {
    throw new Error(`Category request "${requestId}" not found.`);
  }

  if (requestObj.status !== REQUEST_STATUS.PENDING) {
    throw new Error(`Category request is already ${requestObj.status}.`);
  }

  let createdCategory = null;

  if (decision === REQUEST_STATUS.APPROVED) {
    // Automatically create the requested category
    try {
      createdCategory = await createCategory({
        name: requestObj.categoryName,
        description: requestObj.description,
        parentCategory: requestObj.parentCategory,
        adminUid,
        adminEmail
      });
    } catch (err) {
      // If category already exists, link to it
      const slug = slugify(requestObj.categoryName);
      createdCategory = memoryCategories.find(c => c.slug === slug || c.id === slug) || { id: slug, slug };
    }
  }

  const updatedRequest = {
    ...requestObj,
    status: decision,
    rejectionReason: decision === REQUEST_STATUS.REJECTED ? reason.trim() : null,
    approvedCategoryId: createdCategory ? createdCategory.id : null,
    reviewedBy: adminUid,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (reqIndex !== -1) {
    memoryRequests[reqIndex] = updatedRequest;
  }

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("category_requests").doc(requestId).update(updatedRequest);

      // Notify vendor in-app and email
      await admin.firestore().collection("users").doc(requestObj.vendorId).collection("notifications").add({
        title: decision === REQUEST_STATUS.APPROVED ? `Category Approved: "${requestObj.categoryName}"` : `Category Request Update`,
        message: decision === REQUEST_STATUS.APPROVED
          ? `Your category request for "${requestObj.categoryName}" was approved by marketplace administration!`
          : `Your request for "${requestObj.categoryName}" was declined: "${reason.trim()}".`,
        type: decision === REQUEST_STATUS.APPROVED ? "success" : "info",
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Failed updating category request in Firestore:", err.message);
    }
  }

  await recordAuditLog({
    action: decision === REQUEST_STATUS.APPROVED ? "REQUEST_APPROVED" : "REQUEST_REJECTED",
    requestId,
    categoryId: createdCategory ? createdCategory.id : null,
    requester: { uid: requestObj.vendorId, email: requestObj.vendorEmail, role: "vendor" },
    adminDecision: {
      status: decision,
      reason: decision === REQUEST_STATUS.REJECTED ? reason : "Approved for marketplace catalog",
      adminUid
    }
  });

  return {
    success: true,
    request: updatedRequest,
    category: createdCategory
  };
}

/**
 * 8. VENDOR CANCELS OWN REQUEST
 */
async function cancelCategoryRequest({ requestId, vendorId }) {
  const reqIndex = memoryRequests.findIndex(r => r.id === requestId);
  const requestObj = reqIndex !== -1 ? memoryRequests[reqIndex] : null;

  if (!requestObj) {
    throw new Error(`Category request "${requestId}" not found.`);
  }

  if (requestObj.vendorId !== vendorId) {
    throw new Error("Unauthorized: You can only cancel your own category requests.");
  }

  if (requestObj.status !== REQUEST_STATUS.PENDING) {
    throw new Error(`Cannot cancel request with status ${requestObj.status}.`);
  }

  requestObj.status = REQUEST_STATUS.CANCELLED;
  requestObj.updatedAt = new Date().toISOString();

  if (admin.apps && admin.apps.length > 0) {
    try {
      await admin.firestore().collection("category_requests").doc(requestId).update({
        status: REQUEST_STATUS.CANCELLED,
        updatedAt: requestObj.updatedAt
      });
    } catch (err) {
      console.warn("Failed updating cancelled request:", err.message);
    }
  }

  await recordAuditLog({
    action: "REQUEST_CANCELLED",
    requestId,
    requester: { uid: vendorId, email: requestObj.vendorEmail, role: "vendor" }
  });

  return { success: true, request: requestObj };
}

/**
 * 9. GET CATEGORY REQUESTS (SECURITY FILTERED)
 */
async function getCategoryRequests({ vendorId = null, isAdmin = false, status = null } = {}) {
  let list = [...memoryRequests];

  if (admin.apps && admin.apps.length > 0) {
    try {
      let q = admin.firestore().collection("category_requests");
      if (!isAdmin && vendorId) {
        q = q.where("vendorId", "==", vendorId);
      }
      const snap = await q.get();
      if (!snap.empty) {
        list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Falling back to local requests:", e.message);
    }
  }

  // Security check: If not admin, strictly isolate to own requests
  if (!isAdmin) {
    list = list.filter(r => r.vendorId === vendorId);
  }

  if (status) {
    list = list.filter(r => r.status === status);
  }

  return list;
}

/**
 * 10. GET AUDIT LOGS
 */
async function getCategoryAuditLogs({ limitCount = 50 } = {}) {
  if (admin.apps && admin.apps.length > 0) {
    try {
      const snap = await admin.firestore()
        .collection("category_audit_logs")
        .orderBy("timestamp", "desc")
        .limit(limitCount)
        .get();
      if (!snap.empty) {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list;
      }
    } catch (e) {}
  }
  return memoryAuditLogs.slice(0, limitCount);
}

module.exports = {
  REQUEST_STATUS,
  DEFAULT_CATEGORIES,
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  submitCategoryRequest,
  reviewCategoryRequest,
  cancelCategoryRequest,
  getCategoryRequests,
  getCategoryAuditLogs,
  slugify
};
