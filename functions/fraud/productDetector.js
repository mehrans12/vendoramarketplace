const admin = require("firebase-admin");
const { THRESHOLDS } = require("./config");
const { checkDuplicateTitle, checkUnusualPricing, checkProductListingBurst } = require("./rules");

/**
 * Scans a vendor's products for duplicate listings, price dumping, and listing bursts.
 * @param {string} vendorId
 * @returns {Promise<{ flags: string[], duplicatePairs: Array<Object>, pricingAnomalies: Array<Object>, summary: string }>}
 */
async function scanVendorProducts(vendorId) {
  const db = admin.firestore();
  const flags = [];
  const duplicatePairs = [];
  const pricingAnomalies = [];

  try {
    // 1. Fetch vendor's products
    const snap = await db.collection("products")
      .where("vendorId", "==", vendorId)
      .get();

    const products = [];
    snap.forEach(d => products.push({ id: d.id, ...d.data() }));

    if (products.length === 0) {
      return { flags, duplicatePairs, pricingAnomalies, summary: "No products listed by this vendor." };
    }

    // Check listing burst (e.g. >5 products within 1 hour)
    if (checkProductListingBurst(products, THRESHOLDS.unusualProductBurstCount)) {
      flags.push("PRODUCT_LISTING_BURST");
    }

    // 2. Pairwise comparison for duplicate listings
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const p1 = products[i];
        const p2 = products[j];

        const title1 = typeof p1.title === "object" ? (p1.title.en || Object.values(p1.title)[0] || "") : (p1.title || "");
        const title2 = typeof p2.title === "object" ? (p2.title.en || Object.values(p2.title)[0] || "") : (p2.title || "");

        // Same or matching category and high title similarity
        if (p1.category === p2.category && checkDuplicateTitle(title1, title2)) {
          flags.push("DUPLICATE_PRODUCT");
          duplicatePairs.push({
            productA: { id: p1.id, title: title1, price: p1.price },
            productB: { id: p2.id, title: title2, price: p2.price },
            category: p1.category
          });
        }
      }
    }

    // 3. Category average pricing benchmark to spot price dumping or abnormal pricing
    // Group products by category to calculate rough category averages
    const categoryTotals = {};
    for (const p of products) {
      const cat = p.category || "general";
      if (!categoryTotals[cat]) categoryTotals[cat] = { sum: 0, count: 0 };
      categoryTotals[cat].sum += (p.price || 0);
      categoryTotals[cat].count += 1;
    }

    for (const p of products) {
      const cat = p.category || "general";
      const avg = categoryTotals[cat] ? categoryTotals[cat].sum / categoryTotals[cat].count : 0;
      if (checkUnusualPricing(p.price, avg) && p.price < 500) {
        flags.push("UNUSUAL_PRICING");
        pricingAnomalies.push({
          productId: p.id,
          title: typeof p.title === "object" ? (p.title.en || Object.values(p.title)[0]) : p.title,
          price: p.price,
          categoryAvg: Math.round(avg)
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning products for vendor ${vendorId}:`, err);
  }

  const uniqueFlags = [...new Set(flags)];
  const summary = uniqueFlags.length === 0
    ? "No product anomalies detected."
    : `Detected ${uniqueFlags.length} product flag(s): ${uniqueFlags.join(", ")}. ${duplicatePairs.length} duplicate pair(s), ${pricingAnomalies.length} pricing outlier(s).`;

  return {
    flags: uniqueFlags,
    duplicatePairs,
    pricingAnomalies,
    summary
  };
}

module.exports = {
  scanVendorProducts
};
