/**
 * Module for calling the embedding model and calculating cosine similarities.
 */

/**
 * Fetches the embedding vector for a given text from OpenRouter.
 * @param {string} text
 * @param {string} apiKey OpenRouter API key
 * @returns {Promise<Array<number>>} The vector representation
 */
async function getEmbedding(text, apiKey) {
  if (!apiKey) {
    throw new Error("API key is required to get embeddings.");
  }
  if (!text || typeof text !== 'string') {
    throw new Error("Input text must be a valid string.");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: {
        parts: [{
          text: text
        }]
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Embedding API failed: ' + err);
  }

  const data = await response.json();
  if (!data.embedding || !data.embedding.values) {
    throw new Error("Invalid response format from embeddings API.");
  }
  
  return data.embedding.values;
}

/**
 * Calculates cosine similarity between two numeric vectors.
 * @param {Array<number>} a
 * @param {Array<number>} b
 * @returns {number} The similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Determines whether a product's embedding needs regeneration.
 * Avoids regenerating embeddings when unrelated fields (stock, price, status, views) change.
 * @param {Object} oldProduct
 * @param {Object} newProduct
 * @returns {boolean}
 */
function shouldRegenerateEmbedding(oldProduct, newProduct) {
  if (!oldProduct || !oldProduct.embedding) return true;

  const titleChanged = (oldProduct.title || "") !== (newProduct.title || "");
  const descChanged = (oldProduct.description || "") !== (newProduct.description || "");
  const catChanged = (oldProduct.category || "") !== (newProduct.category || "");
  
  const oldTags = JSON.stringify(oldProduct.tags || []);
  const newTags = JSON.stringify(newProduct.tags || []);
  const tagsChanged = oldTags !== newTags;

  return titleChanged || descChanged || catChanged || tagsChanged;
}

/**
 * Builds canonical text representation for embedding a product.
 * @param {Object} product
 * @returns {string}
 */
function generateProductEmbeddingText(product) {
  const title = typeof product.title === "object" ? (product.title.en || Object.values(product.title)[0] || "") : (product.title || "");
  const desc = typeof product.description === "object" ? (product.description.en || Object.values(product.description)[0] || "") : (product.description || "");
  const cat = product.category || "";
  const tags = Array.isArray(product.tags) ? product.tags.join(", ") : "";

  return `${title} | Category: ${cat} | Description: ${desc} ${tags ? "| Tags: " + tags : ""}`.trim();
}

module.exports = {
  getEmbedding,
  cosineSimilarity,
  shouldRegenerateEmbedding,
  generateProductEmbeddingText
};
