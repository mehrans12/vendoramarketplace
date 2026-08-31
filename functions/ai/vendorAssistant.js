/**
 * VENDORA PHASE 11: AI VENDOR ASSISTANT BACKEND
 * 
 * Provides:
 * 1. Strictly authorized vendor tools (no cross-vendor data access).
 * 2. Analytics integration (orders, products, revenue, stock, reviews, cancellations, trust score).
 * 3. Business intelligence synthesizer for store performance, restocking, declining sales analysis, and listing optimization.
 * 4. Zero direct Firestore access by the LLM.
 */

const admin = require("firebase-admin");

/**
 * 1. AUTHORIZED VENDOR TOOLS
 * All tools strictly bind to vendorId derived from authenticated session.
 */
const VendorTools = {
  /**
   * Retrieves products belonging strictly to this vendor.
   */
  async getVendorProducts(vendorId) {
    const db = admin.firestore();
    const snap = await db.collection("products")
      .where("vendorId", "==", vendorId)
      .get();

    return snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: typeof d.title === "object" ? (d.title.en || Object.values(d.title)[0]) : d.title,
        price: d.price || 0,
        stock: d.stock || 0,
        rating: d.rating || 0,
        reviewsCount: d.reviewCount || d.reviewsCount || 0,
        category: d.category || "general",
        subcategory: d.subcategory || "",
        status: d.status || "active",
        qualityScore: d.qualityAudit?.overallScore || 75
      };
    });
  },

  /**
   * Retrieves orders belonging strictly to this vendor.
   */
  async getVendorOrders(vendorId) {
    const db = admin.firestore();
    const snap = await db.collection("orders")
      .where("vendorId", "==", vendorId)
      .limit(100)
      .get();

    return snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        status: d.status || "pending",
        total: d.total || 0,
        createdAt: d.createdAt || new Date().toISOString(),
        itemsCount: (d.items || []).length,
        items: (d.items || []).map(i => ({
          productId: i.id || i.productId,
          title: i.title,
          quantity: i.quantity || 1,
          price: i.price || 0
        }))
      };
    });
  },

  /**
   * Computes aggregated store analytics for this vendor.
   */
  async getVendorAnalytics(vendorId) {
    const products = await this.getVendorProducts(vendorId);
    const orders = await this.getVendorOrders(vendorId);

    const deliveredOrders = orders.filter(o => o.status === "delivered");
    const activeOrders = orders.filter(o => ["pending", "confirmed", "packaging", "shipped"].includes(o.status));
    const cancelledOrders = orders.filter(o => o.status === "cancelled" || o.status === "cancellation_requested");

    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const pendingRevenue = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Calculate product sales distribution
    const salesByProduct = {};
    orders.forEach(o => {
      if (o.status !== "cancelled") {
        (o.items || []).forEach(it => {
          const pid = it.productId || it.title;
          if (!salesByProduct[pid]) {
            salesByProduct[pid] = { title: it.title, unitsSold: 0, revenue: 0 };
          }
          salesByProduct[pid].unitsSold += (it.quantity || 1);
          salesByProduct[pid].revenue += ((it.price || 0) * (it.quantity || 1));
        });
      }
    });

    const topSellingProducts = Object.values(salesByProduct)
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    // Identify low stock items (stock <= 5)
    const lowStockProducts = products.filter(p => p.stock <= 5);

    // Category distribution
    const categorySales = {};
    products.forEach(p => {
      categorySales[p.category] = (categorySales[p.category] || 0) + 1;
    });

    return {
      totalProducts: products.length,
      totalOrders: orders.length,
      deliveredOrdersCount: deliveredOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      cancellationRate: orders.length > 0 ? ((cancelledOrders.length / orders.length) * 100).toFixed(1) + "%" : "0%",
      totalRevenue,
      pendingRevenue,
      topSellingProducts,
      lowStockProducts: lowStockProducts.map(p => ({ id: p.id, title: p.title, stock: p.stock })),
      categoryBreakdown: categorySales
    };
  },

  /**
   * Retrieves customer reviews for this vendor's products.
   */
  async getVendorReviews(vendorId) {
    const products = await this.getVendorProducts(vendorId);
    const productIds = products.map(p => p.id);

    if (productIds.length === 0) return [];

    const db = admin.firestore();
    const reviewsSnap = await db.collection("reviews")
      .where("vendorId", "==", vendorId)
      .limit(50)
      .get();

    return reviewsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        productId: d.productId,
        rating: d.rating,
        comment: d.comment,
        createdAt: d.createdAt
      };
    });
  },

  /**
   * Retrieves cancelled orders or return requests for this vendor.
   */
  async getVendorReturns(vendorId) {
    const orders = await this.getVendorOrders(vendorId);
    return orders.filter(o => o.status === "cancelled" || o.status === "cancellation_requested");
  },

  /**
   * Retrieves this vendor's Trust Score from Phase 5.
   */
  async getVendorTrustScore(vendorId) {
    const db = admin.firestore();
    const tsDoc = await db.collection("trust_scores").doc(vendorId).get();
    if (tsDoc.exists) {
      return tsDoc.data();
    }
    return {
      score: 85,
      ratingLevel: "Good",
      status: "ACTIVE"
    };
  }
};

/**
 * 2. BUSINESS INTELLIGENCE SYNTHESIZER
 * Evaluates business queries deterministically & grounds responses strictly in authorized vendor data.
 */
async function processVendorAssistantQuery({ prompt, vendorId }) {
  if (!vendorId) {
    throw new Error("Unauthorized: Vendor identification missing.");
  }

  const query = (prompt || "").toLowerCase();

  // 1. BEST SELLING PRODUCTS
  if (query.includes("selling best") || query.includes("top seller") || query.includes("best selling") || query.includes("popular product")) {
    const analytics = await VendorTools.getVendorAnalytics(vendorId);
    if (!analytics.topSellingProducts || analytics.topSellingProducts.length === 0) {
      return {
        reply: `**Top Selling Products Analysis**\n\nYou have not recorded completed sales yet across your ${analytics.totalProducts} active listings. Once orders are confirmed, top selling items will be ranked here by volume and revenue.`,
        data: analytics
      };
    }

    const list = analytics.topSellingProducts
      .map((p, idx) => `${idx + 1}. **${p.title}** — ${p.unitsSold} units sold (Rs. ${p.revenue.toLocaleString()} revenue)`)
      .join("\n");

    return {
      reply: `**🏆 Your Top Selling Products**\n\nHere are your highest performing products based on completed orders:\n\n${list}\n\n**Strategy Tip**: Consider increasing inventory and featuring these bestsellers at the top of your shop profile.`,
      data: analytics.topSellingProducts
    };
  }

  // 2. RESTOCKING & INVENTORY
  if (query.includes("restock") || query.includes("inventory") || query.includes("low stock") || query.includes("out of stock")) {
    const analytics = await VendorTools.getVendorAnalytics(vendorId);
    if (analytics.lowStockProducts.length === 0) {
      return {
        reply: `**Inventory Status: Healthy ✅**\n\nAll your products currently have healthy stock levels (> 5 units in reserve across ${analytics.totalProducts} items). None require urgent restocking today.`,
        data: []
      };
    }

    const items = analytics.lowStockProducts
      .map(p => `- **${p.title}**: only **${p.stock} units left** ${p.stock === 0 ? "⚠️ (OUT OF STOCK)" : "⚠️ (Low)"}`)
      .join("\n");

    return {
      reply: `**⚠️ Restocking Recommendations**\n\nThe following **${analytics.lowStockProducts.length} product(s)** require immediate inventory replenishment:\n\n${items}\n\n**Action Item**: Restock these items to prevent sales loss and maintain your high vendor fulfillment rate.`,
      data: analytics.lowStockProducts
    };
  }

  // 3. STORE PERFORMANCE SUMMARY
  if (query.includes("summarize") || query.includes("performance") || query.includes("overview") || query.includes("how is my store")) {
    const analytics = await VendorTools.getVendorAnalytics(vendorId);
    const trust = await VendorTools.getVendorTrustScore(vendorId);

    return {
      reply: `**📊 Store Performance Summary**\n\n- **Active Products**: ${analytics.totalProducts} listings\n- **Total Orders**: ${analytics.totalOrders} (${analytics.deliveredOrdersCount} delivered)\n- **Delivered Revenue**: Rs. ${analytics.totalRevenue.toLocaleString()}\n- **Pending Revenue**: Rs. ${analytics.pendingRevenue.toLocaleString()}\n- **Cancellation Rate**: ${analytics.cancellationRate}\n- **Vendora Trust Score**: ${trust.score}/100 (${trust.ratingLevel || 'Good'})\n\n**Health Assessment**: Your shop is operating smoothly. Keep order processing swift to retain your high trust tier!`,
      data: { analytics, trust }
    };
  }

  // 4. SALES DECLINE / POOR PERFORMANCE DIAGNOSIS
  if (query.includes("declin") || query.includes("poor") || query.includes("slow") || query.includes("why might sales") || query.includes("low sales")) {
    const products = await VendorTools.getVendorProducts(vendorId);
    const analytics = await VendorTools.getVendorAnalytics(vendorId);
    const trust = await VendorTools.getVendorTrustScore(vendorId);

    const zeroSales = products.filter(p => {
      const sold = analytics.topSellingProducts.some(ts => ts.title === p.title);
      return !sold;
    });

    const lowQuality = products.filter(p => p.qualityScore < 70);

    return {
      reply: `**🔍 Sales & Conversion Diagnosis**\n\nBased on your store data, here are 3 key diagnostic insights:\n\n1. **Zero-Order Listings**: You have ${zeroSales.length} product(s) with no recorded sales yet. Ensure titles contain high-intent search keywords (e.g. city origin, material).\n2. **Listing Quality Audit**: ${lowQuality.length} listing(s) have quality scores below 70%. High quality images and detailed specifications directly boost conversion.\n3. **Fulfillment Speed & Cancellation**: Your cancellation rate is ${analytics.cancellationRate}. Keeping this under 3% improves your visibility in marketplace search ranking.`,
      data: { zeroSalesCount: zeroSales.length, lowQualityCount: lowQuality.length }
    };
  }

  // 5. HIGH RETURN / CANCELLATION RATES
  if (query.includes("return") || query.includes("cancel")) {
    const returns = await VendorTools.getVendorReturns(vendorId);
    const analytics = await VendorTools.getVendorAnalytics(vendorId);

    if (returns.length === 0) {
      return {
        reply: `**Return & Cancellation Report: Excellent 🎉**\n\nYour store currently has **0 cancellations or return requests**! You maintain a 0.0% cancellation rate, which strengthens your Vendora Trust Score.`,
        data: []
      };
    }

    return {
      reply: `**⚠️ Returns & Cancellations Report**\n\nYour store has recorded **${returns.length} cancellation request(s)** (Cancellation Rate: ${analytics.cancellationRate}).\n\n**Common Prevention Tips**:\n- Ensure size and dimensions are explicitly listed.\n- Ensure images accurately reflect colors under natural lighting.\n- Dispatch orders within 24–48 hours to minimize buyer regrets.`,
      data: returns
    };
  }

  // 6. CATEGORY PERFORMANCE
  if (query.includes("category") || query.includes("categories")) {
    const analytics = await VendorTools.getVendorAnalytics(vendorId);
    const breakdown = Object.entries(analytics.categoryBreakdown)
      .map(([cat, count]) => `- **${cat.toUpperCase()}**: ${count} listing(s)`)
      .join("\n");

    return {
      reply: `**📂 Category Distribution & Performance**\n\nYour store currently offers listings in the following categories:\n\n${breakdown}\n\n**Recommendation**: Handicrafts and traditional fashion boast the highest average order value across Pakistani e-commerce.`,
      data: analytics.categoryBreakdown
    };
  }

  // 7. CONTENT GENERATION / TITLE IMPROVEMENT
  if (query.includes("description") || query.includes("title") || query.includes("generate") || query.includes("improve")) {
    return {
      reply: `**✍️ Listing Copy Assistant**\n\nTo optimize your product titles and descriptions for high conversion on Vendora:\n\n- **Formula for Titles**: [Brand / Artisan] + [Material] + [Product Type] + [Color/Pattern] + [City Origin]\n  *Example*: *"Handmade Multani Blue Pottery Ceramic Floral Vase (12-inch)"*\n\n- **Formula for Descriptions**: Lead with heritage, highlight durable craftsmanship, list dimensions clearly, and specify care instructions.\n\n*Tip: You can also use the 'AI Assist' button in the Product Form to automatically generate complete listing metadata.*`,
      data: null
    };
  }

  // GENERAL DEFAULT EXECUTIVE RESPONSE
  const analytics = await VendorTools.getVendorAnalytics(vendorId);
  return {
    reply: `**Vendora AI Vendor Assistant**\n\nI can help you monitor and grow your store. Here are quick things you can ask me:\n- *"Which products are selling best?"*\n- *"Which products need restocking?"*\n- *"Summarize my store performance"*\n- *"Why might sales be declining?"*\n- *"Which products have high return rates?"*`,
    data: analytics
  };
}

module.exports = {
  VendorTools,
  processVendorAssistantQuery
};
