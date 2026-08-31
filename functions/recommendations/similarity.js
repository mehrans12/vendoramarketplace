/**
 * Similarity Engine — Phase 2
 *
 * Calculates semantic similarity between products using:
 *   1. Cached embedding vectors stored on product documents
 *   2. Fresh embeddings via the existing OpenRouter embedding API
 *   3. Cosine similarity for ranking
 *
 * Embeddings are lazily computed and cached on the Firestore product document
 * under the field `_embedding` to avoid repeated API calls.
 */

const admin = require("firebase-admin");
const { getEmbedding, cosineSimilarity } = require("../ai/embeddings");

/**
 * Builds the text representation used for embedding a product.
 * @param {Object} product
 * @returns {string}
 */
function buildProductText(product) {
  const parts = [
    product.title || "",
    product.description || "",
    product.category || "",
    (product.tags || []).join(" "),
    product.vendorName || ""
  ];
  return parts.filter(Boolean).join(". ").substring(0, 2000);
}

/**
 * Gets (or lazily generates + caches) the embedding for a product.
 * @param {Object} product  Full product document with `id` field
 * @param {string} apiKey   OpenRouter API key
 * @returns {Promise<Array<number>|null>}
 */
async function getProductEmbedding(product, apiKey) {
  if (!apiKey) return null;

  // Return cached embedding if present
  if (Array.isArray(product._embedding) && product._embedding.length === 768) {
    return product._embedding;
  }

  // Generate fresh embedding
  const text = buildProductText(product);
  if (!text.trim()) return null;

  try {
    const embedding = await getEmbedding(text, apiKey);

    // Cache it back on the product document (fire-and-forget)
    const db = admin.firestore();
    db.collection("products")
      .doc(product.id)
      .update({ _embedding: embedding, _embeddingUpdatedAt: new Date().toISOString() })
      .catch((err) => console.warn("Failed to cache embedding for", product.id, err.message));

    return embedding;
  } catch (err) {
    console.warn(`Failed to generate embedding for product ${product.id}:`, err.message);
    return null;
  }
}

/**
 * Scores each candidate product by semantic similarity to a seed product.
 * Products without computable embeddings receive a similarity score of 0.
 *
 * @param {Object} seedProduct          The anchor product
 * @param {Array<Object>} candidates    Candidate products
 * @param {string} apiKey               OpenRouter API key
 * @returns {Promise<Map<string,number>>} Map of productId → similarity [0,1]
 */
async function scoreSimilarity(seedProduct, candidates, apiKey) {
  const scores = new Map();

  if (!seedProduct || !apiKey) {
    candidates.forEach((p) => scores.set(p.id, 0));
    return scores;
  }

  const seedEmbedding = await getProductEmbedding(seedProduct, apiKey);
  if (!seedEmbedding) {
    candidates.forEach((p) => scores.set(p.id, 0));
    return scores;
  }

  await Promise.allSettled(
    candidates.map(async (candidate) => {
      try {
        const candidateEmbedding = await getProductEmbedding(candidate, apiKey);
        if (candidateEmbedding) {
          const raw = cosineSimilarity(seedEmbedding, candidateEmbedding);
          // Normalise from [-1,1] to [0,1]
          scores.set(candidate.id, (raw + 1) / 2);
        } else {
          scores.set(candidate.id, 0);
        }
      } catch (e) {
        scores.set(candidate.id, 0);
      }
    })
  );

  return scores;
}

/**
 * Computes category similarity between a seed product and a candidate
 * using a simple deterministic overlap score (no embeddings needed).
 *
 * @param {Object} seedProduct
 * @param {Object} candidate
 * @returns {number} 0–1
 */
function categorySimilarity(seedProduct, candidate) {
  if (!seedProduct || !candidate) return 0;
  if (seedProduct.category && candidate.category) {
    return seedProduct.category === candidate.category ? 1.0 : 0.0;
  }
  return 0;
}

module.exports = { scoreSimilarity, categorySimilarity, getProductEmbedding, buildProductText };
