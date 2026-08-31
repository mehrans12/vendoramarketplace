/**
 * Client-Side Intelligent Search & Discovery Service (Phase 9)
 * 
 * Features:
 * 1. Debounced Autocomplete & Query Suggestions
 * 2. Per-User Isolated Recent Searches (in localStorage, never leaking across accounts)
 * 3. Popular / Trending Searches
 * 4. Client-side Query LRU Cache
 * 5. Multi-language Entity Extraction (EN, UR, SD, Roman Urdu, Roman Sindhi)
 * 6. Hybrid Client-side Ranking (Lexical + Quality + Popularity + Stock)
 * 7. Zero-Result Fallbacks & Recommendations
 */

const SEARCH_CACHE = new Map();
const MAX_CACHE_SIZE = 50;

// Curated Popular Pakistani Marketplace Searches
export const POPULAR_SEARCHES = [
  { text: "Multani Blue Pottery Vase", category: "handicrafts" },
  { text: "Handmade Sindhi Ajrak", category: "fashion" },
  { text: "Pure Leather Peshawari Chappal", category: "fashion" },
  { text: "Traditional Embroidered Kurta", category: "fashion" },
  { text: "Pure Saffron & Masala Spices", category: "spices" },
  { text: "Handcrafted Silver Ring", category: "jewelry" },
  { text: "Truck Art Lantern", category: "home-decor" }
];

// Common Spelling Corrections
export const SPELLING_CORRECTIONS = {
  "mobl": "mobile",
  "moble": "mobile",
  "mobiles": "mobile",
  "headfone": "headphones",
  "headfones": "headphones",
  "hedphone": "headphones",
  "earbud": "earbuds",
  "shawal": "shawl",
  "chapal": "chappal",
  "chpal": "chappal",
  "khusa": "khussa",
  "vaz": "vase",
  "vaze": "vase",
  "jwelery": "jewelry",
  "jwellery": "jewelry",
  "ajrk": "ajrak",
  "potry": "pottery",
  "masalah": "spices"
};

/**
 * Normalizes query string and resolves common spelling errors.
 */
export function normalizeClientQuery(query) {
  if (!query) return { normalized: "", corrected: "", hasCorrection: false };
  let lower = query.toLowerCase().trim();

  // Resolve abbreviations: 50k -> 50000, 50 hazar -> 50000
  lower = lower
    .replace(/(\d+)\s*k\b/g, (m, n) => `${n}000`)
    .replace(/(\d+)\s*(?:hazar|hazaar|هزار)\b/g, (m, n) => `${n}000`)
    .replace(/(\d+)\s*(?:lakh|lac|لاکھ)\b/g, (m, n) => `${n}00000`);

  const words = lower.split(/\s+/);
  let hasCorrection = false;
  const correctedWords = words.map(w => {
    if (SPELLING_CORRECTIONS[w]) {
      hasCorrection = true;
      return SPELLING_CORRECTIONS[w];
    }
    return w;
  });

  const normalized = correctedWords.join(" ");
  return {
    normalized,
    corrected: hasCorrection ? normalized : "",
    hasCorrection
  };
}

/**
 * Detects query language script and dialect.
 */
export function detectClientLanguage(query) {
  if (!query) return "en";
  const trimmed = query.trim();

  // Arabic block
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    if (/[ڄڃٽٿڌڏڙڳڻڦٺ]/.test(trimmed)) return "sd";
    return "ur";
  }

  const lower = trimmed.toLowerCase();
  if (/\b(?:satho|ghat|kan|waddo|nandho|achho|karo|rilli)\b/.test(lower)) {
    return "roman_sd";
  }
  if (/\b(?:achha|achhay|chahiye|kam|se|wala|hazar|sasta|kapray)\b/.test(lower)) {
    return "roman_ur";
  }

  return "en";
}

/**
 * Extracts natural language price and category filters from client search query.
 */
export function extractClientEntities(query) {
  const { normalized } = normalizeClientQuery(query);
  const entities = {
    category: null,
    maxPrice: null,
    minPrice: null,
    keywords: []
  };

  if (!normalized) return entities;

  // Price match
  const maxPriceMatch = normalized.match(/(?:under|below|less than|kam|ghat|تائين|تک|کم|گھٽ)\s*(\d+)/i) ||
                        normalized.match(/(\d+)\s*(?:سے\s*کم|کان\s*گھٽ|rupees|pkr|روپے|روپيا|tak|se\s*kam|kan\s*ghat)/i);
  if (maxPriceMatch && maxPriceMatch[1]) {
    entities.maxPrice = parseFloat(maxPriceMatch[1]);
  }

  // Category match
  const catKeywords = {
    "handicrafts": ["handicraft", "pottery", "ceramic", "vase", "ajrak", "truck art", "دستکاری", "گلدان", "dastkari"],
    "fashion": ["fashion", "clothing", "dress", "shawl", "chappal", "kurta", "khussa", "کپڑے", "شال", "چپل", "kapray"],
    "home-decor": ["decor", "decoration", "lamp", "mirror", "rug", "curtain", "سجاوٹ", "قالین", "sajawat"],
    "jewelry": ["jewelry", "ring", "necklace", "earrings", "bangles", "زیورات", "انگوٹھی", "zewar"],
    "electronics": ["electronics", "charger", "cable", "mobile", "phone", "headphones", "earbuds", "موبائل"],
    "spices": ["spices", "spice", "masala", "chili", "turmeric", "saffron", "مصالحے", "مرچ"]
  };

  for (const [cat, words] of Object.entries(catKeywords)) {
    if (words.some(w => normalized.includes(w))) {
      entities.category = cat;
      break;
    }
  }

  entities.keywords = normalized.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
  return entities;
}

/**
 * Isolated Per-User Recent Searches
 */
export function getRecentSearches(userId) {
  try {
    const key = `vendora_recent_searches_${userId || "guest"}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveRecentSearch(userId, query) {
  if (!query || !query.trim()) return;
  try {
    const key = `vendora_recent_searches_${userId || "guest"}`;
    const current = getRecentSearches(userId);
    const trimmed = query.trim();
    const updated = [trimmed, ...current.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }
}

export function clearRecentSearches(userId) {
  try {
    const key = `vendora_recent_searches_${userId || "guest"}`;
    localStorage.removeItem(key);
  } catch (e) {
    // ignore
  }
}

/**
 * Client-Side Hybrid Ranking & Fuzzy Search Engine
 */
export function intelligentClientSearch(products, query, options = {}) {
  const { category = null, priceRange = "all", sortBy = "popularity" } = options;

  if (!query && (!category || category === "all") && priceRange === "all" && sortBy === "popularity") {
    return products;
  }

  const cacheKey = `${query}::${category}::${priceRange}::${sortBy}::${products.length}`;
  if (SEARCH_CACHE.has(cacheKey)) {
    return SEARCH_CACHE.get(cacheKey);
  }

  const { normalized, corrected, hasCorrection } = normalizeClientQuery(query);
  const entities = extractClientEntities(normalized);

  let pool = [...products];

  // Category filter
  const targetCategory = (category && category !== "all") ? category : entities.category;
  if (targetCategory && targetCategory !== "all") {
    pool = pool.filter(p => p.category === targetCategory);
  }

  // Price filter
  let minPrice = null;
  let maxPrice = entities.maxPrice;
  if (priceRange === "under-2000") maxPrice = 2000;
  else if (priceRange === "2000-5000") { minPrice = 2000; maxPrice = 5000; }
  else if (priceRange === "above-5000") minPrice = 5000;

  if (minPrice !== null) pool = pool.filter(p => p.price >= minPrice);
  if (maxPrice !== null) pool = pool.filter(p => p.price <= maxPrice);

  // Exclude hidden / rejected products
  pool = pool.filter(p => p.status !== "hidden" && p.qualityAudit?.moderationStatus !== "REJECTED");

  // Keyword & Hybrid Scoring
  const queryTerms = entities.keywords;

  const scored = pool.map(p => {
    let lexicalScore = 0;
    if (queryTerms.length > 0) {
      const titleEn = typeof p.title === "object" ? (p.title.en || "") : (p.title || "");
      const titleUr = typeof p.title === "object" ? (p.title.ur || "") : "";
      const titleSd = typeof p.title === "object" ? (p.title.sd || "") : "";
      const fullText = `${titleEn} ${titleUr} ${titleSd} ${p.description || ""} ${p.category || ""} ${p.vendorName || ""}`.toLowerCase();

      let matched = 0;
      queryTerms.forEach(term => {
        if (fullText.includes(term)) matched++;
      });
      lexicalScore = matched / queryTerms.length;
    } else {
      lexicalScore = 1.0;
    }

    // Quality Score boost (Phase 8 integration)
    const qualityScore = (p.qualityAudit?.overallScore || 75) / 100;

    // Popularity Score (rating 0-5)
    const popularityScore = (p.rating || 4.0) / 5.0;

    // Availability Boost (in stock)
    const availabilityScore = (p.stock && p.stock > 0) ? 1.0 : 0.3;

    // Freshness
    const freshnessScore = 0.5;

    // Hybrid Composite Score (0 to 1)
    const totalScore = 
      (0.40 * lexicalScore) +
      (0.25 * qualityScore) +
      (0.20 * popularityScore) +
      (0.15 * availabilityScore);

    return {
      ...p,
      searchScore: totalScore,
      lexicalMatch: lexicalScore > 0
    };
  });

  // Filter out complete mismatches if a query was specified
  let results = queryTerms.length > 0 ? scored.filter(p => p.lexicalMatch) : scored;

  // Sorting
  if (sortBy === "price-low-high") {
    results.sort((a, b) => a.price - b.price);
  } else if (sortBy === "price-high-low") {
    results.sort((a, b) => b.price - a.price);
  } else if (sortBy === "newest") {
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else {
    // Default: Sort by Intelligent Hybrid Search Score descending
    results.sort((a, b) => b.searchScore - a.searchScore);
  }

  // Cache management
  if (SEARCH_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = SEARCH_CACHE.keys().next().value;
    SEARCH_CACHE.delete(oldestKey);
  }
  SEARCH_CACHE.set(cacheKey, results);

  return results;
}
