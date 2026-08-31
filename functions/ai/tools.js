const admin = require("firebase-admin");
const { searchKnowledgeBase } = require("../rag_utils");
const { generateRecommendations } = require("../recommendations/generate");
const { trackMarketplaceEvent } = require("../analytics/events");
const { analyzeProductComparison, extractUnifiedSpecifications } = require("./productComparison");

// Forward declaration of search dependency
let searchModule = null;

function getSearchModule() {
  if (!searchModule) {
    searchModule = require("./search");
  }
  return searchModule;
}

const tools = [
  {
    type: "function",
    function: {
      name: "searchVendoraProducts",
      description: "Search real Vendora products. Use this to find products by keyword, category, price, or vendor.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search terms or product names." },
          category: { type: "string", description: "Category slug: handicrafts, fashion, home-decor, jewelry, electronics, spices" },
          minPrice: { type: "number", description: "Minimum price in PKR." },
          maxPrice: { type: "number", description: "Maximum price in PKR." },
          vendorId: { type: "string", description: "Filter by specific vendor ID." },
          sortBy: { type: "string", enum: ["price_asc", "price_desc", "rating_desc"], description: "Sorting criteria." },
          limit: { type: "number", description: "Number of products to return (default 5, max 10)." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getVendoraProduct",
      description: "Retrieve complete details for a single product by its ID.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" }
        },
        required: ["productId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchVendoraCategories",
      description: "Retrieve a list of all product categories available on Vendora.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getVendoraVendor",
      description: "Retrieve details about a specific vendor/merchant by their ID.",
      parameters: {
        type: "object",
        properties: {
          vendorId: { type: "string", description: "The vendor ID" }
        },
        required: ["vendorId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getVendoraReviews",
      description: "Retrieve user reviews for a specific product.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" }
        },
        required: ["productId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "checkVendoraInventory",
      description: "Check the current availability and stock level of a product.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" }
        },
        required: ["productId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getUserOrders",
      description: "Retrieve the authenticated buyer's own orders. Only call this when the user asks about their orders. Requires authentication.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "searchVendoraKnowledgeBase",
      description: "Search Vendora static knowledge base for policy/help information (returns, shipping, FAQs, buyer/seller guidelines).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "User question or search phrase." },
          limit: { type: "number", description: "Maximum number of chunks to return (default 3)." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getVendoraRecommendations",
      description: "Retrieve recommended products from the Vendora system.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum number of recommendations to retrieve (default 5)." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getSimilarVendoraProducts",
      description: "Retrieve similar/related products for a specific product ID.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" },
          limit: { type: "number", description: "Number of products to return (default 5)." }
        },
        required: ["productId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getTrendingVendoraProducts",
      description: "Retrieve trending products from across the platform.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of products to return (default 5)." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compareVendoraProducts",
      description: "Compare multiple products side-by-side using their product IDs.",
      parameters: {
        type: "object",
        properties: {
          productIds: {
            type: "array",
            items: { type: "string" },
            description: "List of product IDs to compare."
          }
        },
        required: ["productIds"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getVendoraOrderDetails",
      description: "Retrieve complete details for a specific order by ID. Checks ownership and requires authentication.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "The order ID" }
        },
        required: ["orderId"]
      }
    }
  }
];

const formatProduct = (docId, data) => ({
  id: docId,
  name: data.title || "Product",
  title: data.title || "Product",
  price: data.price || 0,
  image: data.images && data.images.length > 0 ? data.images[0] : "",
  images: data.images || [],
  rating: data.rating || 0,
  reviews: data.reviewCount || 0,
  vendor: data.vendorName || "Verified Merchant",
  stock: data.stock || 0,
  URL: `/product/${docId}`,
  important_features: data.description ? data.description.substring(0, 100) + '...' : ""
});

/**
 * Handles the secure backend execution of a requested tool call.
 * @param {string} name
 * @param {Object} args
 * @param {string} uid
 * @param {string} openRouterKey
 * @returns {Promise<{result: string, products?: Array<Object>}>}
 */
async function executeTool(name, args, uid, openRouterKey) {
  const db = admin.firestore();
  let toolResult = "";
  let toolProducts = [];

  switch (name) {
    case "searchVendoraProducts": {
      // Direct validation
      const limit = Math.min(10, Math.max(1, parseInt(args.limit) || 5));
      const keyword = args.keyword ? String(args.keyword).substring(0, 100) : "";
      const category = args.category ? String(args.category).substring(0, 50) : "";
      const minPrice = typeof args.minPrice === 'number' ? args.minPrice : null;
      const maxPrice = typeof args.maxPrice === 'number' ? args.maxPrice : null;
      const vendorId = args.vendorId ? String(args.vendorId).substring(0, 50) : "";
      
      // TELEMETRY: track AI query searches
      await trackMarketplaceEvent({
        userId: uid,
        eventType: "AI_SEARCH",
        metadata: { keyword, category, minPrice, maxPrice, vendorId }
      }).catch(err => console.warn("Failed logging AI_SEARCH event:", err.message));

      const searchRes = await getSearchModule().searchProducts({
        query: keyword || category,
        filters: { category, minPrice, maxPrice, vendorId },
        limit,
        userId: uid
      });

      toolProducts = searchRes.results.map(p => formatProduct(p.id, p));
      toolResult = JSON.stringify(toolProducts);
      break;
    }

    case "getVendoraProduct": {
      const productId = String(args.productId || "").trim();
      if (!productId) {
        toolResult = JSON.stringify({ error: "Product ID is required." });
        break;
      }
      const doc = await db.collection("products").doc(productId).get();
      if (doc.exists) {
        const p = formatProduct(doc.id, doc.data());
        toolProducts.push(p);
        toolResult = JSON.stringify(p);
      } else {
        toolResult = JSON.stringify({ error: "Product not found." });
      }
      break;
    }

    case "searchVendoraCategories": {
      const snap = await db.collection("categories").get();
      const cats = [];
      snap.forEach(d => cats.push({ slug: d.id, name: d.data().name }));
      toolResult = JSON.stringify(cats);
      break;
    }

    case "getVendoraVendor": {
      const vendorId = String(args.vendorId || "").trim();
      if (!vendorId) {
        toolResult = JSON.stringify({ error: "Vendor ID is required." });
        break;
      }
      const doc = await db.collection("vendors").doc(vendorId).get();
      if (doc.exists) {
        const d = doc.data();
        toolResult = JSON.stringify({
          vendorId: doc.id,
          businessName: d.businessName,
          description: d.description,
          city: d.city,
          rating: d.rating
        });
      } else {
        toolResult = JSON.stringify({ error: "Vendor not found." });
      }
      break;
    }

    case "getVendoraReviews": {
      const productId = String(args.productId || "").trim();
      if (!productId) {
        toolResult = JSON.stringify({ error: "Product ID is required." });
        break;
      }
      const snap = await db.collection("reviews").where("productId", "==", productId).limit(10).get();
      const revs = [];
      snap.forEach(d => {
        const rd = d.data();
        revs.push({
          buyerName: rd.buyerName,
          rating: rd.rating,
          comment: rd.comment
        });
      });
      toolResult = JSON.stringify(revs);
      break;
    }

    case "checkVendoraInventory": {
      const productId = String(args.productId || "").trim();
      if (!productId) {
        toolResult = JSON.stringify({ error: "Product ID is required." });
        break;
      }
      const doc = await db.collection("products").doc(productId).get();
      if (doc.exists) {
        toolResult = JSON.stringify({ stock: doc.data().stock, available: doc.data().stock > 0 });
      } else {
        toolResult = JSON.stringify({ error: "Product not found." });
      }
      break;
    }

    case "getUserOrders": {
      if (!uid || uid === "anonymous") {
        toolResult = JSON.stringify({ error: "User is not logged in. Please ask them to log in to view their orders." });
      } else {
        await trackMarketplaceEvent({
          userId: uid,
          eventType: "AI_ORDER_QUERY",
          metadata: { action: "list" }
        }).catch(err => console.warn("Failed logging AI_ORDER_QUERY event:", err.message));

        const ordersSnap = await db.collection("orders").where("buyerId", "==", uid).orderBy("createdAt", "desc").limit(10).get();
        const orders = [];
        ordersSnap.forEach(doc => {
          const d = doc.data();
          orders.push({
            orderId: doc.id,
            status: d.status,
            total: d.total,
            shippingCost: d.shippingCost,
            paymentMethod: d.paymentMethod,
            createdAt: d.createdAt,
            items: d.items,
            vendorName: d.vendorName
          });
        });
        toolResult = JSON.stringify(orders);
      }
      break;
    }

    case "searchVendoraKnowledgeBase": {
      const query = String(args.query || "").trim();
      const limit = Math.min(5, Math.max(1, parseInt(args.limit) || 3));
      if (!query) {
        toolResult = JSON.stringify({ error: "Search query is required." });
        break;
      }
      const results = await searchKnowledgeBase(query, limit, openRouterKey);
      const cleanedResults = results.map(r => ({
        id: r.id,
        source: r.source,
        text: r.text,
        score: r.score
      }));
      toolResult = JSON.stringify(cleanedResults);
      break;
    }

    case "getVendoraRecommendations": {
      const limit = Math.min(10, Math.max(1, parseInt(args.limit) || 5));

      // TELEMETRY: track AI recommendation triggers
      await trackMarketplaceEvent({
        userId: uid,
        eventType: "AI_RECOMMENDATION",
        metadata: { context: "HOME", limit }
      }).catch(err => console.warn("Failed logging AI_RECOMMENDATION event:", err.message));

      const recs = await generateRecommendations({
        userId: uid,
        context: "HOME",
        limit
      });

      toolProducts = (recs.items || []).map(p => ({
        id: p.productId,
        name: p.title,
        title: p.title,
        price: p.price,
        image: p.images && p.images.length > 0 ? p.images[0] : "",
        images: p.images || [],
        rating: p.rating,
        reviews: p.reviewsCount || 0,
        vendor: p.vendorName || "Verified Merchant",
        stock: p.stock || 0,
        URL: `/product/${p.productId}`,
        important_features: `Recommended based on your shopping interests.`
      }));
      toolResult = JSON.stringify(toolProducts);
      break;
    }

    case "getSimilarVendoraProducts": {
      const productId = String(args.productId || "").trim();
      const limit = Math.min(10, Math.max(1, parseInt(args.limit) || 5));
      if (!productId) {
        toolResult = JSON.stringify({ error: "productId parameter is required." });
        break;
      }

      await trackMarketplaceEvent({
        userId: uid,
        eventType: "AI_RECOMMENDATION",
        productId,
        metadata: { context: "PRODUCT_PAGE", limit }
      }).catch(err => console.warn("Failed logging AI_RECOMMENDATION event:", err.message));

      const recs = await generateRecommendations({
        userId: uid,
        context: "PRODUCT_PAGE",
        seedProductId: productId,
        limit
      });

      toolProducts = (recs.items || []).map(p => ({
        id: p.productId,
        name: p.title,
        title: p.title,
        price: p.price,
        image: p.images && p.images.length > 0 ? p.images[0] : "",
        images: p.images || [],
        rating: p.rating,
        reviews: p.reviewsCount || 0,
        vendor: p.vendorName || "Verified Merchant",
        stock: p.stock || 0,
        URL: `/product/${p.productId}`,
        important_features: `Similar to the product you are currently viewing.`
      }));
      toolResult = JSON.stringify(toolProducts);
      break;
    }

    case "getTrendingVendoraProducts": {
      const limit = Math.min(10, Math.max(1, parseInt(args.limit) || 5));

      await trackMarketplaceEvent({
        userId: uid,
        eventType: "AI_RECOMMENDATION",
        metadata: { context: "TRENDING", limit }
      }).catch(err => console.warn("Failed logging AI_RECOMMENDATION event:", err.message));

      const recs = await generateRecommendations({
        userId: uid,
        context: "HOME",
        limit
      });

      toolProducts = (recs.items || []).map(p => ({
        id: p.productId,
        name: p.title,
        title: p.title,
        price: p.price,
        image: p.images && p.images.length > 0 ? p.images[0] : "",
        images: p.images || [],
        rating: p.rating,
        reviews: p.reviewsCount || 0,
        vendor: p.vendorName || "Verified Merchant",
        stock: p.stock || 0,
        URL: `/product/${p.productId}`,
        important_features: `Trending on Vendora right now.`
      }));
      toolResult = JSON.stringify(toolProducts);
      break;
    }

    case "compareVendoraProducts": {
      const productIds = args.productIds || [];
      if (!Array.isArray(productIds) || productIds.length === 0) {
        toolResult = JSON.stringify({ error: "productIds array is required." });
        break;
      }

      await trackMarketplaceEvent({
        userId: uid,
        eventType: "AI_COMPARISON",
        metadata: { productIds }
      }).catch(err => console.warn("Failed logging AI_COMPARISON event:", err.message));

      const comparedList = [];
      for (const pid of productIds.slice(0, 4)) {
        try {
          const doc = await db.collection("products").doc(pid).get();
          if (doc.exists) {
            const data = doc.data();
            
            // Optional: retrieve vendor trust score
            let trustScore = null;
            if (data.vendorId) {
              try {
                const tsDoc = await db.collection("trust_scores").doc(data.vendorId).get();
                if (tsDoc.exists) {
                  trustScore = tsDoc.data().score || null;
                }
              } catch (e) {}
            }

            comparedList.push({
              id: doc.id,
              name: data.title || "Product",
              title: data.title || "Product",
              price: data.price || 0,
              rating: data.rating || 0,
              reviews: data.reviewCount || 0,
              vendor: data.vendorName || "Verified Merchant",
              vendorTrustScore: trustScore,
              qualityScore: data.qualityAudit?.overallScore || null,
              category: data.category || "",
              subcategory: data.subcategory || "",
              stock: data.stock || 0,
              specifications: data.specifications || {},
              description: data.description ? data.description.substring(0, 200) + "..." : ""
            });

            // Populate toolProducts for chat card rendering
            toolProducts.push(formatProduct(doc.id, data));
          }
        } catch (err) {}
      }

      // Fetch user preferences for personalization if available
      let userPref = null;
      if (uid && uid !== "anonymous") {
        try {
          const prefDoc = await db.collection("user_preferences").doc(uid).get();
          if (prefDoc.exists) userPref = prefDoc.data();
        } catch (e) {}
      }

      const comparisonAnalysis = analyzeProductComparison(comparedList, userPref);
      const unifiedSpecs = extractUnifiedSpecifications(comparedList);

      toolResult = JSON.stringify({
        products: comparedList,
        specificationsMatrix: unifiedSpecs,
        aiVerdict: comparisonAnalysis
      });
      break;
    }

    case "getVendoraOrderDetails": {
      const orderId = String(args.orderId || "").trim();
      if (!orderId) {
        toolResult = JSON.stringify({ error: "orderId is required." });
        break;
      }
      if (!uid || uid === "anonymous") {
        toolResult = JSON.stringify({ error: "User is not logged in. Please ask them to log in to view order details." });
        break;
      }

      await trackMarketplaceEvent({
        userId: uid,
        eventType: "AI_ORDER_QUERY",
        metadata: { action: "details", orderId }
      }).catch(err => console.warn("Failed logging AI_ORDER_QUERY event:", err.message));

      const doc = await db.collection("orders").doc(orderId).get();
      if (doc.exists) {
        const d = doc.data();
        
        // SECURITY CHECK: must own order or be platform admin
        if (d.buyerId !== uid) {
          const userSnap = await db.collection("users").doc(uid).get();
          const isAdmin = userSnap.exists && userSnap.data().role === 'admin';
          if (!isAdmin) {
            toolResult = JSON.stringify({ error: "Unauthorized access: You do not have permission to view this order." });
            break;
          }
        }

        toolResult = JSON.stringify({
          orderId: doc.id,
          status: d.status,
          total: d.total,
          shippingCost: d.shippingCost,
          paymentMethod: d.paymentMethod,
          createdAt: d.createdAt,
          items: d.items,
          vendorName: d.vendorName,
          shippingAddress: {
            fullName: d.shippingAddress?.fullName || "",
            city: d.shippingAddress?.city || ""
          }
        });
      } else {
        toolResult = JSON.stringify({ error: "Order not found." });
      }
      break;
    }

    default:
      toolResult = JSON.stringify({ error: "Unknown tool" });
  }

  return { result: toolResult, products: toolProducts };
}

module.exports = {
  tools,
  executeTool,
  formatProduct
};
