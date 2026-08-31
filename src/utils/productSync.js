import { db, hasFirebaseKeys } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export const MOCK_MARKETPLACE_PRODUCTS = [];

/**
 * Reads all products stored in LocalStorage for any vendor key matching vendora_products_*
 */
export const getLocalStorageVendorProducts = () => {
  const localProds = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vendora_products_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localProds.push(...parsed);
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to read local vendor products:", e);
  }
  return localProds;
};

/**
 * Returns merged list of all marketplace products (Firestore + LocalStorage + Mock)
 */
export const getMarketplaceProducts = async () => {
  const map = new Map();

  // 1. Add mock products
  MOCK_MARKETPLACE_PRODUCTS.forEach(p => map.set(p.id || p.productId, p));

  // 2. Add local storage vendor products
  const localProds = getLocalStorageVendorProducts();
  localProds.forEach(p => {
    const key = p.id || p.productId;
    if (key) map.set(key, p);
  });

  // 3. Add Firestore products if keys exist
  if (hasFirebaseKeys) {
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const key = docSnap.id || data.productId;
        if (key) {
          map.set(key, { id: docSnap.id, ...data });
        }
      });
    } catch (err) {
      console.warn("Firestore products fetch skipped/failed, using local & mock fallback:", err);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
};
