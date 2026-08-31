/**
 * Client Category Service (Phase 16: Category Request & Approval Workflow)
 */

import { hasFirebaseKeys, app, db } from '../firebase';

export const REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED"
};

export const DEFAULT_CATEGORIES = [
  { id: "handicrafts", slug: "handicrafts", name: "Handicrafts & Art", description: "Authentic handmade pottery, brass, woodwork and textiles", parentCategory: null, active: true },
  { id: "fashion", slug: "fashion", name: "Fashion & Apparel", description: "Handloom shawls, embroidered kurtas and traditional footwear", parentCategory: null, active: true },
  { id: "home-decor", slug: "home-decor", name: "Home & Living", description: "Glazed terracotta, rugs, lamps and regional ornaments", parentCategory: null, active: true },
  { id: "jewelry", slug: "jewelry", name: "Jewelry & Accessories", description: "Silver filigree, handmade bangles and ethnic stones", parentCategory: null, active: true },
  { id: "electronics", slug: "electronics", name: "Electronics & Tech", description: "Modern gadgets and artisan tech accessories", parentCategory: null, active: true },
  { id: "spices", slug: "spices", name: "Spices & Groceries", description: "Organic spices, saffron, dry fruits and regional delicacies", parentCategory: null, active: true }
];

export async function fetchMarketplaceCategories({ includeInactive = false } = {}) {
  try {
    const raw = localStorage.getItem('vendora_marketplace_categories');
    if (raw) {
      const list = JSON.parse(raw);
      return includeInactive ? list : list.filter(c => c.active !== false);
    }
  } catch (e) {}

  if (hasFirebaseKeys) {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'marketplace_categories'));
      if (!snap.empty) {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        localStorage.setItem('vendora_marketplace_categories', JSON.stringify(list));
        return includeInactive ? list : list.filter(c => c.active !== false);
      }
    } catch (err) {
      console.warn("Falling back to default categories:", err);
    }
  }

  return includeInactive ? DEFAULT_CATEGORIES : DEFAULT_CATEGORIES.filter(c => c.active !== false);
}

export async function requestNewCategory({
  vendorId,
  vendorEmail,
  vendorBusinessName,
  categoryName,
  description,
  reason,
  parentCategory = null
}) {
  if (hasFirebaseKeys) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'submitCategoryRequest');
      const res = await fn({ categoryName, description, reason, parentCategory });
      return res.data;
    } catch (err) {
      console.warn("Remote category request failed, storing locally:", err);
    }
  }

  // Local fallback storage
  const newReq = {
    id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    vendorId,
    vendorEmail: vendorEmail || "vendor@vendora.pk",
    vendorBusinessName: vendorBusinessName || "Artisan Store",
    categoryName: categoryName.trim(),
    description: description || "",
    reason: reason.trim(),
    parentCategory: parentCategory || null,
    status: REQUEST_STATUS.PENDING,
    rejectionReason: null,
    approvedCategoryId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const stored = getLocalRequests();
  stored.unshift(newReq);
  saveLocalRequests(stored);

  return { success: true, request: newReq };
}

export async function fetchCategoryRequests({ vendorId = null, isAdmin = false, status = null } = {}) {
  if (hasFirebaseKeys) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'getCategoryRequests');
      const res = await fn({ status });
      if (res.data && res.data.success) {
        return res.data.requests;
      }
    } catch (err) {
      console.warn("Remote category requests failed, using local:", err);
    }
  }

  let list = getLocalRequests();
  if (!isAdmin && vendorId) {
    list = list.filter(r => r.vendorId === vendorId);
  }
  if (status) {
    list = list.filter(r => r.status === status);
  }
  return list;
}

export async function reviewCategoryRequest({ requestId, decision, reason = null }) {
  if (hasFirebaseKeys) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'reviewCategoryRequest');
      const res = await fn({ requestId, decision, reason });
      return res.data;
    } catch (err) {
      console.warn("Remote review failed, updating locally:", err);
    }
  }

  const list = getLocalRequests();
  const index = list.findIndex(r => r.id === requestId);
  if (index === -1) return { success: false, error: "Request not found." };

  const req = list[index];
  req.status = decision;
  req.rejectionReason = decision === REQUEST_STATUS.REJECTED ? reason : null;
  req.reviewedAt = new Date().toISOString();
  saveLocalRequests(list);

  if (decision === REQUEST_STATUS.APPROVED) {
    await adminCreateCategory({
      name: req.categoryName,
      description: req.description,
      parentCategory: req.parentCategory
    });
  }

  return { success: true, request: req };
}

export async function cancelCategoryRequest({ requestId, vendorId }) {
  if (hasFirebaseKeys) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'cancelCategoryRequest');
      const res = await fn({ requestId });
      return res.data;
    } catch (err) {}
  }

  const list = getLocalRequests();
  const index = list.findIndex(r => r.id === requestId && r.vendorId === vendorId);
  if (index !== -1) {
    list[index].status = REQUEST_STATUS.CANCELLED;
    list[index].updatedAt = new Date().toISOString();
    saveLocalRequests(list);
    return { success: true };
  }
  return { success: false, error: "Request not found." };
}

export async function adminCreateCategory({ name, description = "", parentCategory = null }) {
  const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
  const newCat = {
    id: slug,
    slug,
    name: name.trim(),
    description,
    parentCategory,
    active: true,
    createdAt: new Date().toISOString()
  };

  const categories = await fetchMarketplaceCategories({ includeInactive: true });
  categories.push(newCat);
  localStorage.setItem('vendora_marketplace_categories', JSON.stringify(categories));
  return newCat;
}

export async function adminUpdateCategory({ id, updates }) {
  if (hasFirebaseKeys) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'manageMarketplaceCategory');
      const res = await fn({ action: 'UPDATE', id, updates });
      return res.data?.category;
    } catch (err) {
      console.warn("Remote updateCategory failed:", err);
    }
  }

  const categories = await fetchMarketplaceCategories({ includeInactive: true });
  const index = categories.findIndex(c => c.id === id || c.slug === id);
  if (index !== -1) {
    categories[index] = {
      ...categories[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('vendora_marketplace_categories', JSON.stringify(categories));
    return categories[index];
  }
  throw new Error(`Category "${id}" not found.`);
}

export async function adminToggleCategoryStatus(id, active) {
  const categories = await fetchMarketplaceCategories({ includeInactive: true });
  const index = categories.findIndex(c => c.id === id || c.slug === id);
  if (index !== -1) {
    categories[index].active = active;
    localStorage.setItem('vendora_marketplace_categories', JSON.stringify(categories));
    return categories[index];
  }
  return null;
}

export async function adminDeleteCategory(id) {
  let categories = await fetchMarketplaceCategories({ includeInactive: true });
  categories = categories.filter(c => c.id !== id && c.slug !== id);
  localStorage.setItem('vendora_marketplace_categories', JSON.stringify(categories));
  return { success: true };
}

function getLocalRequests() {
  try {
    const raw = localStorage.getItem('vendora_category_requests');
    return raw ? JSON.parse(raw) : [
      {
        id: "req-demo-1",
        vendorId: "vendor-1",
        vendorBusinessName: "Sindh Ajrak Masters",
        vendorEmail: "ajrak@vendora.pk",
        categoryName: "Ajrak & Traditional Handlooms",
        description: "Natural indigo and madder root block-printed cloth from Hala and Bhit Shah",
        reason: "Handicrafts is too broad; buyers specifically search for certified Sindhi block-printed shawls.",
        parentCategory: "fashion",
        status: "APPROVED",
        approvedCategoryId: "fashion",
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: "req-demo-2",
        vendorId: "vendor-2",
        vendorBusinessName: "Multan Blue Artistry",
        vendorEmail: "multan@vendora.pk",
        categoryName: "Glazed Architectural Ceramics",
        description: "Large terracotta jali screens and handmade restoration tiles",
        reason: "We need a designated section for heritage architectural masonry.",
        parentCategory: "home-decor",
        status: "PENDING",
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ];
  } catch (e) {
    return [];
  }
}

function saveLocalRequests(list) {
  try {
    localStorage.setItem('vendora_category_requests', JSON.stringify(list));
  } catch (e) {}
}
