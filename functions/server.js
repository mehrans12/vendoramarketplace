const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin (safe to do once)
if (admin.apps.length === 0) {
  try {
    const fs = require('fs');
    const path = require('path');
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
      });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.warn("Firebase Admin init notice:", e.message);
  }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Railway injects $PORT (default 5001 or 8080)
const PORT = process.env.PORT || 5001;

// Root / Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Vendora Marketplace API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Import AI service modules
const { handleAssistantRequest } = require('./ai/assistant');
const { searchProducts } = require('./ai/search');
const { generateRecommendations } = require('./recommendations/generate');
const { handleCreateOrGetConversation, handleSendChatMessage, handleAdminManageChat } = require('./chat/index');

// 1. AI Assistant Chat Endpoint
app.post('/api/ai/chat', (req, res) => {
  return handleAssistantRequest(req, res);
});

// 2. AI Product Search Endpoint
app.post('/api/ai/search', async (req, res) => {
  try {
    const { query, category, limit } = req.body || {};
    const results = await searchProducts({ query, category, limit: limit || 10 });
    res.json({ success: true, results });
  } catch (err) {
    console.error('Search endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. AI Recommendations Endpoint
app.post('/api/recommendations', async (req, res) => {
  try {
    const { userId, context, limit } = req.body || {};
    const recs = await generateRecommendations({ userId, context, limit: limit || 8 });
    res.json({ success: true, recommendations: recs });
  } catch (err) {
    console.error('Recommendations endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Chat Endpoints
app.post('/api/chat/conversation', async (req, res) => {
  try {
    const result = await handleCreateOrGetConversation(req.body, { auth: req.body.auth || null });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vendora Backend Server listening on 0.0.0.0:${PORT}`);
});

module.exports = app;
