/**
 * VENDORA PHASE 9: INTELLIGENT SEARCH & DISCOVERY ENGINE
 * 
 * Implements:
 * 1. Multi-language Detection (English, Urdu, Sindhi, Roman Urdu, Roman Sindhi)
 * 2. Normalization & Spelling Correction ("Did you mean?")
 * 3. Deep Query Understanding & Entity Extraction (Category, Brand, Price range, Color, Size, Specs, Purpose, Availability)
 * 4. Candidate Retrieval & Filtering
 * 5. Semantic Vector Search (utilizing existing embeddings from Phase 7/Phase 2)
 * 6. Hybrid Weighted Ranking (Lexical + Semantic + Popularity + Product Quality + Availability + Freshness + Personalization)
 * 7. Zero-Result Intelligence & Fallback Recommendations
 * 8. Search Analytics Logging (Zero-result tracking, result count, language)
 */

const admin = require("firebase-admin");
const { getEmbedding } = require("./embeddings");
const { calculateSimilarity } = require("../recommendations/similarity");
const { withTimeout } = require("./utils");

// Approved Category Taxonomy Synonyms
const CATEGORY_TAXONOMY = {
  "handicrafts": {
    en: ["handicraft", "handicrafts", "pottery", "craft", "wood", "handmade", "hand-painted", "vase", "ceramic", "ajrak", "truck art", "rilli"],
    ur: ["دستکاری", "ہاتھ", "بلوچی", "ملتانی", "مٹی", "برتن", "گلدان", "اجرک", "رلی"],
    sd: ["دستڪاري", "هٿ جو ڪم", "مٽي جا برتن", "ثقافت", "ڪاريگري", "اجرڪ", "رلي"],
    roman_ur: ["dastkari", "hath ka kam", "mitti k bartan", "guldan", "handmade", "multani mitti", "ajrak", "rilli"],
    roman_sd: ["dastkari", "hath jo kam", "mitti ja bartan", "ajrak", "sindhi topi", "rilli"]
  },
  "fashion": {
    en: ["fashion", "clothing", "dress", "shawl", "chappal", "wear", "shoes", "kurta", "khussa", "pashmina", "apparel"],
    ur: ["کپڑے", "شال", "چپل", "جوتوں", "اجرک", "کرتا", "لباس", "کھسہ"],
    sd: ["ڪپڙا", "شال", "چپلون", "اجرڪ", "شوز", "ڪرتا", "سندري", "کسي"],
    roman_ur: ["kapray", "kapde", "chappal", "chappar", "jootay", "kurta", "khussa", "peshawari chappal", "lawn", "suit"],
    roman_sd: ["kapra", "chappal", "khussa", "kurto", "jota"]
  },
  "home-decor": {
    en: ["decor", "home", "decoration", "lamp", "mirror", "vase", "cushion", "rug", "curtain", "table", "candle"],
    ur: ["سجاوٹ", "گھر", "گلدان", "قالین", "چراغ", "پردے"],
    sd: ["سجاوٽ", "گهر", "گلدان", "سجاڳي", "آئنو", "قالين"],
    roman_ur: ["sajawat", "ghar ki sajawat", "qaleen", "lamp", "chragh", "parda"],
    roman_sd: ["sajawat", "ghar ji sajawat", "qaleen", "aino"]
  },
  "jewelry": {
    en: ["jewelry", "jewellery", "ring", "necklace", "earrings", "bangles", "silver", "gold", "ornament", "choker"],
    ur: ["زیورات", "انگوٹھی", "ہار", "جھومر", "چوڑیاں", "سونے", "چاندی"],
    sd: ["زیور", "انگوٺي", "هار", "چوڙيون", "سون", "چاندي"],
    roman_ur: ["zewar", "zevarat", "angoothi", "churian", "haar", "jhumkay", "chandi", "sona"],
    roman_sd: ["zewar", "angothi", "churiyon", "har", "son"]
  },
  "electronics": {
    en: ["electronics", "charger", "cable", "accessory", "device", "plug", "mobile", "phone", "laptop", "earbuds", "headphones"],
    ur: ["الیکٹرانکس", "موبائل", "فون", "ہیڈ فون", "چارجر", "کیبل"],
    sd: ["اليڪٽرانڪس", "موبائل", "فون", "هيڊفون", "چارجر"],
    roman_ur: ["mobile", "phone", "headphone", "earphone", "charger", "cable", "bijli"],
    roman_sd: ["mobile", "phone", "headphone", "charger"]
  },
  "spices": {
    en: ["spices", "spice", "masala", "chili", "turmeric", "saffron", "cardamom", "clove", "herbs"],
    ur: ["مصالحے", "مرچ", "ہلدی", "زعفران", "مسالہ", "الائچی"],
    sd: ["مصالحا", "مرچون", "هارڊي", "زعفران", "مسالو", "ڦوٽا"],
    roman_ur: ["masalay", "masala", "haldi", "mirch", "zafran", "ilaichi"],
    roman_sd: ["masalo", "masala", "mirchoon", "zafran"]
  }
};

// Common Spelling Corrections Dictionary
const COMMON_SPELLING_CORRECTIONS = {
  "mobl": "mobile",
  "moble": "mobile",
  "mobiles": "mobile",
  "headfone": "headphones",
  "headfones": "headphones",
  "hedphone": "headphones",
  "hedfones": "headphones",
  "earbud": "earbuds",
  "earpod": "earbuds",
  "shawal": "shawl",
  "shal": "shawl",
  "chapal": "chappal",
  "chpal": "chappal",
  "khusa": "khussa",
  "vaz": "vase",
  "vaze": "vase",
  "jwelery": "jewelry",
  "jwellery": "jewelry",
  "jewelery": "jewelry",
  "ajrk": "ajrak",
  "electonics": "electronics",
  "electonic": "electronics",
  "masalah": "spices",
  "potry": "pottery",
  "potri": "pottery"
};

// Known Color Dictionary
const KNOWN_COLORS = {
  "blue": ["blue", "neela", "نیلا", "نيرو"],
  "red": ["red", "surkh", "laal", "lal", "لال", "ڳاڙهو"],
  "black": ["black", "karo", "kala", "کالا", "ڪارو"],
  "white": ["white", "safaid", "chitta", "achho", "سفید", "اڇو"],
  "green": ["green", "hara", "sabz", "ساوا", "سبز", "ساو"],
  "pink": ["pink", "gulabi", "گلابی", "گلابي"],
  "gold": ["gold", "golden", "sona", "سنہرا", "سونھري"]
};

// Known Size Indicators
const KNOWN_SIZES = {
  "small": ["small", "chhota", "nandho", "چھوٹا", "ننڍو", "s"],
  "medium": ["medium", "darmiyana", "درمیانہ", "m"],
  "large": ["large", "bara", "bada", "waddo", "بڑا", "وڏو", "l", "xl"]
};

// Configurable Hybrid Ranking Weights
const DEFAULT_RANKING_WEIGHTS = {
  lexical: 0.25,
  semantic: 0.25,
  personalization: 0.15,
  popularity: 0.15,
  productQuality: 0.10,
  availability: 0.05,
  freshness: 0.05
};

/**
 * 1. Language Detection: Detects en, ur, sd, roman_ur, roman_sd.
 */
function detectLanguage(query) {
  if (!query) return "en";
  const trimmed = query.trim();

  // Arabic Unicode Block matches Urdu/Sindhi Arabic script
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(trimmed)) {
    // Distinctive Sindhi characters: ڄ ڃ ٽ ٿ ڌ ڏ ڙ ڳ ڻ ڦ ٺ
    const sindhiChars = /[ڄڃٽٿڌڏڙڳڻڦٺ]/;
    if (sindhiChars.test(trimmed)) {
      return "sd";
    }
    return "ur";
  }

  // Roman Urdu vs Roman Sindhi vs English heuristics
  const lower = trimmed.toLowerCase();
  const romanSindhiTokens = ["satho", "ghat", "kan", "waddo", "nandho", "achho", "karo", "chaye", "rilli", "mitho", "tokhe"];
  if (romanSindhiTokens.some(token => new RegExp(`\\b${token}\\b`).test(lower))) {
    return "roman_sd";
  }

  const romanUrduTokens = ["achha", "achhay", "chahiye", "kam", "se", "wala", "wali", "wale", "hazar", "lakh", "sasta", "sasti", "kapray", "jootay"];
  if (romanUrduTokens.some(token => new RegExp(`\\b${token}\\b`).test(lower))) {
    return "roman_ur";
  }

  return "en";
}

/**
 * 2. Normalization & Spelling Correction
 */
function normalizeQueryText(query) {
  if (!query) return { normalized: "", corrected: "", hasCorrection: false };
  let original = query.toLowerCase().trim();
  let correctedWords = [];
  let hasCorrection = false;

  // Resolve romanized numbers: e.g. "50k" -> "50000", "50 hazar" -> "50000"
  let preprocessed = original
    .replace(/(\d+)\s*k\b/g, (m, n) => `${n}000`)
    .replace(/(\d+)\s*(?:hazar|hazaar|hazar|هزار)\b/g, (m, n) => `${n}000`)
    .replace(/(\d+)\s*(?:lakh|lac|لاکھ)\b/g, (m, n) => `${n}00000`);

  const words = preprocessed.split(/\s+/);
  for (const word of words) {
    if (COMMON_SPELLING_CORRECTIONS[word]) {
      correctedWords.push(COMMON_SPELLING_CORRECTIONS[word]);
      hasCorrection = true;
    } else {
      correctedWords.push(word);
    }
  }

  const normalized = correctedWords.join(" ");
  return {
    normalized,
    corrected: hasCorrection ? normalized : "",
    hasCorrection
  };
}

/**
 * 3. Query Understanding & Entity Extraction
 */
function extractQueryEntities(query, detectedLang) {
  const entities = {
    category: null,
    brand: null,
    minPrice: null,
    maxPrice: null,
    color: null,
    size: null,
    purpose: null,
    inStockOnly: false,
    keywords: []
  };

  if (!query) return entities;
  const { normalized } = normalizeQueryText(query);

  // Price Extraction
  // Range: "between 2000 and 5000", "2000 se 5000 tak", "2000 کان 5000 تائين"
  const rangeMatch = normalized.match(/(?:between|منجھ)\s*(\d+)\s*(?:and|to|se|کان)\s*(\d+)/i) ||
                     normalized.match(/(\d+)\s*(?:se|to|-)\s*(\d+)\s*(?:tak|تک|تائين)/i);
  if (rangeMatch) {
    entities.minPrice = parseFloat(rangeMatch[1]);
    entities.maxPrice = parseFloat(rangeMatch[2]);
  } else {
    // Upper bound: "under 5000", "below 50000", "50000 se kam", "50000 kan ghat", "50000 روپے سے کم"
    const maxMatch = normalized.match(/(?:under|below|less than|kam|ghat|تائين|تک|کم|گھٽ)\s*(\d+)/i) ||
                     normalized.match(/(\d+)\s*(?:سے\s*کم|کان\s*گھٽ|rupees|pkr|روپے|روپيا|tak|تائين|se\s*kam|kan\s*ghat)/i);
    if (maxMatch && maxMatch[1]) {
      entities.maxPrice = parseFloat(maxMatch[1]);
    }

    // Lower bound: "above 2000", "over 2000", "2000 se zyada"
    const minMatch = normalized.match(/(?:above|over|more than|zyada|وڌيڪ|زیادہ)\s*(\d+)/i) ||
                     normalized.match(/(\d+)\s*(?:se\s*zyada|کان\s*وڌيڪ)/i);
    if (minMatch && minMatch[1]) {
      entities.minPrice = parseFloat(minMatch[1]);
    }
  }

  // Category Extraction
  for (const [catSlug, langMap] of Object.entries(CATEGORY_TAXONOMY)) {
    const allSynonyms = Object.values(langMap).flat();
    if (allSynonyms.some(syn => normalized.includes(syn))) {
      entities.category = catSlug;
      break;
    }
  }

  // Color Extraction
  for (const [colorName, colorSynonyms] of Object.entries(KNOWN_COLORS)) {
    if (colorSynonyms.some(syn => new RegExp(`\\b${syn}\\b`, 'i').test(normalized))) {
      entities.color = colorName;
      break;
    }
  }

  // Size Extraction
  for (const [sizeName, sizeSynonyms] of Object.entries(KNOWN_SIZES)) {
    if (sizeSynonyms.some(syn => new RegExp(`\\b${syn}\\b`, 'i').test(normalized))) {
      entities.size = sizeName;
      break;
    }
  }

  // Purpose Extraction
  if (/wedding|shaadi|شادی|شادي/i.test(normalized)) entities.purpose = "wedding";
  else if (/gift|tehfa|تحفہ|تحفو/i.test(normalized)) entities.purpose = "gift";
  else if (/daily|casual|روزمرہ/i.test(normalized)) entities.purpose = "daily-wear";

  // Availability
  if (/in stock|ready|available|dastiyab|دستياب|موجود/i.test(normalized)) {
    entities.inStockOnly = true;
  }

  // Extract clean keywords (filter out numbers and stop words)
  const stopWords = new Set(["a", "an", "the", "in", "under", "for", "with", "and", "or", "se", "kam", "ka", "ki", "ke", "kan", "ghat", "tak", "main"]);
  entities.keywords = normalized
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w) && !/^\d+$/.test(w));

  return entities;
}

/**
 * 4. Calculates Lexical Relevance Score (0 to 1)
 */
function calculateLexicalScore(product, queryTerms) {
  if (!queryTerms || queryTerms.length === 0) return 1.0;

  const titleEn = typeof product.title === "object" ? (product.title.en || "") : (product.title || "");
  const titleUr = typeof product.title === "object" ? (product.title.ur || "") : "";
  const titleSd = typeof product.title === "object" ? (product.title.sd || "") : "";
  const titleString = `${titleEn} ${titleUr} ${titleSd}`.toLowerCase();

  const descEn = typeof product.description === "object" ? (product.description.en || "") : (product.description || "");
  const descUr = typeof product.description === "object" ? (product.description.ur || "") : "";
  const descSd = typeof product.description === "object" ? (product.description.sd || "") : "";
  const descString = `${descEn} ${descUr} ${descSd}`.toLowerCase();

  const category = (product.category || "").toLowerCase();
  const tags = Array.isArray(product.tags) ? product.tags.join(" ").toLowerCase() : "";

  let matchedTitleCount = 0;
  let matchedOtherCount = 0;

  for (const term of queryTerms) {
    if (titleString.includes(term)) {
      matchedTitleCount++;
    } else if (descString.includes(term) || category.includes(term) || tags.includes(term)) {
      matchedOtherCount++;
    }
  }

  // Title matches given higher weight
  const score = (matchedTitleCount * 1.5 + matchedOtherCount * 0.5) / (queryTerms.length * 1.5);
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * 5. Intelligent Hybrid Ranking Engine
 */
function rankSearchResults(products, {
  queryTerms = [],
  queryEmbedding = null,
  userPreferences = null,
  weights = DEFAULT_RANKING_WEIGHTS
}) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return products.map(product => {
    // 1. Lexical Score
    const lexicalScore = calculateLexicalScore(product, queryTerms);

    // 2. Semantic Score (cosine similarity of embeddings if available)
    let semanticScore = lexicalScore; // fallback
    if (queryEmbedding && Array.isArray(product.embedding) && product.embedding.length === queryEmbedding.length) {
      try {
        const sim = cosineSimilarity(queryEmbedding, product.embedding);
        // Normalize similarity [-1, 1] to [0, 1]
        semanticScore = Math.max(0, (sim + 1) / 2);
      } catch (e) {
        semanticScore = lexicalScore;
      }
    }

    // 3. Popularity Score (rating 0-5 + views)
    const ratingNorm = (product.rating || 4.0) / 5.0; // 0 to 1
    const popularityScore = ratingNorm;

    // 4. Product Quality Score (from Phase 8 qualityAudit)
    const rawQuality = product.qualityAudit?.overallScore || 75;
    const qualityScore = rawQuality / 100.0;

    // 5. Availability Score
    const availabilityScore = (product.stock && product.stock > 0) ? 1.0 : 0.2;

    // 6. Freshness Score
    let freshnessScore = 0.5;
    if (product.createdAt) {
      const createdTime = new Date(product.createdAt?.seconds ? product.createdAt.seconds * 1000 : product.createdAt).getTime();
      if (!isNaN(createdTime)) {
        const ageMs = now - createdTime;
        freshnessScore = Math.max(0, 1.0 - (ageMs / thirtyDaysMs));
      }
    }

    // 7. Personalization Score
    let personalizationScore = 0.5;
    if (userPreferences && userPreferences.preferredCategories) {
      if (userPreferences.preferredCategories.includes(product.category)) {
        personalizationScore = 1.0;
      }
    }

    // Composite Weighted Hybrid Score
    const finalScore = 
      (weights.lexical * lexicalScore) +
      (weights.semantic * semanticScore) +
      (weights.popularity * popularityScore) +
      (weights.productQuality * qualityScore) +
      (weights.availability * availabilityScore) +
      (weights.freshness * freshnessScore) +
      (weights.personalization * personalizationScore);

    return {
      ...product,
      searchScore: parseFloat(finalScore.toFixed(4)),
      scoreBreakdown: {
        lexical: parseFloat(lexicalScore.toFixed(2)),
        semantic: parseFloat(semanticScore.toFixed(2)),
        quality: parseFloat(qualityScore.toFixed(2)),
        popularity: parseFloat(popularityScore.toFixed(2))
      }
    };
  }).sort((a, b) => b.searchScore - a.searchScore);
}

/**
 * 6. Main Intelligent Search Pipeline Function
 */
async function searchProducts({
  query,
  language,
  filters = {},
  limit = 20,
  userId = null,
  apiKey = null
}) {
  const startTime = Date.now();
  const db = admin.firestore();

  const detectedLang = language || detectLanguage(query);
  const { normalized, corrected, hasCorrection } = normalizeQueryText(query || "");
  const extractedEntities = extractQueryEntities(normalized, detectedLang);

  // Merge explicit filters with extracted entities
  const finalCategory = filters.category || extractedEntities.category;
  const finalMinPrice = filters.minPrice !== undefined ? filters.minPrice : extractedEntities.minPrice;
  const finalMaxPrice = filters.maxPrice !== undefined ? filters.maxPrice : extractedEntities.maxPrice;
  const inStockOnly = filters.inStockOnly || extractedEntities.inStockOnly;

  // Retrieve candidate pool
  let productsRef = db.collection("products");
  if (finalCategory && finalCategory !== "all") {
    productsRef = productsRef.where("category", "==", finalCategory);
  }

  let snapshot;
  try {
    snapshot = await withTimeout(productsRef.limit(500).get(), 3000, null);
  } catch (e) {
    console.warn("Firestore search fetch error, fallback to unindexed fetch:", e.message);
    snapshot = await withTimeout(db.collection("products").limit(500).get(), 3000, null);
  }

  let candidates = [];
  if (snapshot && typeof snapshot.forEach === "function") {
    snapshot.forEach(doc => {
      const data = doc.data();
      // Exclude hidden or rejected products
      if (data.status === "hidden" || data.qualityAudit?.moderationStatus === "REJECTED") {
        return;
      }

      let passes = true;
      if (finalMinPrice !== null && finalMinPrice !== undefined && data.price < finalMinPrice) {
        passes = false;
      }
      if (finalMaxPrice !== null && finalMaxPrice !== undefined && data.price > finalMaxPrice) {
        passes = false;
      }
      if (inStockOnly && (!data.stock || data.stock <= 0)) {
        passes = false;
      }

      if (passes) {
        candidates.push({ id: doc.id, ...data });
      }
    });
  }

  // Calculate semantic query embedding if API key is provided and query is non-empty
  let queryEmbedding = null;
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (effectiveApiKey && normalized && normalized.length > 2) {
    try {
      queryEmbedding = await withTimeout(getEmbedding(normalized, effectiveApiKey), 3000, null);
    } catch (embErr) {
      // Graceful fallback to lexical ranking
      console.warn("Query embedding failed, falling back to lexical ranking:", embErr.message);
    }
  }

  // Retrieve user personalization preferences if available
  let userPreferences = null;
  if (userId) {
    try {
      const prefDoc = await withTimeout(db.collection("user_preferences").doc(userId).get(), 2000, null);
      if (prefDoc && prefDoc.exists) {
        userPreferences = prefDoc.data();
      }
    } catch (e) {
      // Non-blocking
    }
  }

  // Execute Hybrid Ranking
  const ranked = rankSearchResults(candidates, {
    queryTerms: extractedEntities.keywords,
    queryEmbedding,
    userPreferences
  });

  const results = ranked.slice(0, limit);
  const executionTimeMs = Date.now() - startTime;
  const isZeroResult = results.length === 0;

  // Zero-result recommendations if empty
  let zeroResultSuggestions = null;
  if (isZeroResult) {
    // Fetch top 4 fallback products
    const fallbackSnap = await db.collection("products").limit(4).get();
    const fallbackProducts = [];
    fallbackSnap.forEach(d => fallbackProducts.push({ id: d.id, ...d.data() }));

    zeroResultSuggestions = {
      didYouMean: hasCorrection ? corrected : null,
      relatedCategories: ["handicrafts", "fashion", "home-decor", "jewelry"],
      recommendedProducts: fallbackProducts
    };
  }

  // Asynchronous Search Analytics Logging
  if (query && query.trim()) {
    try {
      const searchEventId = `sch-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      db.collection("search_events").doc(searchEventId).set({
        eventId: searchEventId,
        userId: userId || "guest",
        rawQuery: query,
        normalizedQuery: normalized,
        language: detectedLang,
        entities: extractedEntities,
        resultCount: results.length,
        isZeroResult,
        executionTimeMs,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(err => console.warn("Search analytics log failed:", err.message));
    } catch (e) {
      // non-blocking
    }
  }

  return {
    results,
    totalCount: ranked.length,
    detectedLanguage: detectedLang,
    entities: extractedEntities,
    didYouMean: hasCorrection ? corrected : null,
    zeroResultSuggestions: isZeroResult ? zeroResultSuggestions : null,
    executionTimeMs
  };
}

module.exports = {
  detectLanguage,
  normalizeQueryText,
  extractQueryEntities,
  calculateLexicalScore,
  rankSearchResults,
  searchProducts,
  DEFAULT_RANKING_WEIGHTS,
  CATEGORY_TAXONOMY,
  COMMON_SPELLING_CORRECTIONS
};
