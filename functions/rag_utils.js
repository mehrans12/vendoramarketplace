const fs = require('fs');
const path = require('path');

// Load vector store (array of {id, content, metadata, embedding})
function loadVectorStore() {
  const storePath = path.join(__dirname, 'knowledge', 'vector_store.json');
  if (!fs.existsSync(storePath)) {
    throw new Error('Vector store not found at ' + storePath);
  }
  const raw = fs.readFileSync(storePath, 'utf-8');
  return JSON.parse(raw);
}

const { getEmbedding, cosineSimilarity } = require('./ai/embeddings');

// Search knowledge base
async function searchKnowledgeBase(query, limit = 3, apiKey) {
  const store = loadVectorStore();
  const queryEmbedding = await getEmbedding(query, apiKey);
  const scored = store.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = {
  loadVectorStore,
  getEmbedding,
  cosineSimilarity,
  searchKnowledgeBase
};
