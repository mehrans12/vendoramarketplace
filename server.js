import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

const SYSTEM_PROMPT = `You are Vendora's intelligent AI Shopping Assistant for the Vendora Marketplace in Pakistan.
Vendora offers verified Pakistani artisan products, handicrafts, spices, textiles, leather goods, footwear, ceramics, and consumer goods.

CRITICAL DIRECTIVES:
- Answer user questions informatively, courteously, and helpfully.
- Support English, Urdu (اردو), Sindhi (سنڌي), and Roman Urdu/Sindhi automatically based on user language.
- When recommending items or answering about products, provide realistic pricing in Pakistani Rupees (PKR / Rs.) and mention store benefits like cash on delivery and fast nationwide shipping.
- For store policies: Delivery is typically 3-5 business days across Pakistan. Free returns within 7 days for damaged or incorrect items. Cash on Delivery (COD) and Debit/Credit cards are accepted.`;

// 1. Root / Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// 2. Direct AI Chat Assistant Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, mode, language = 'en' } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: 'messages' array is required." });
    }

    const langHint = `You must reply in the following language: ${language === 'ur' ? 'Urdu' : language === 'sd' ? 'Sindhi' : 'English'}. If the user writes in Roman Urdu or Roman Sindhi, you may reply in that style.`;

    const formattedMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: langHint },
      ...messages.slice(-6)
    ];

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        messages: formattedMessages,
        temperature: 0.3,
        max_tokens: 600
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("Gemini API call returned:", response.status, errText);
      return res.json({
        content: "I am ready to help you discover products, track orders, or answer questions about Vendora. What are you looking for today? 🛍️",
        mode: mode || 'product_discovery',
        products: []
      });
    }

    const data = await response.json();
    const replyContent = data.choices?.[0]?.message?.content || "How can I assist you with your shopping on Vendora today? 🛍️";

    return res.json({
      content: replyContent,
      mode: mode || 'product_discovery',
      products: []
    });

  } catch (err) {
    console.error("AI Chat handler error:", err);
    return res.json({
      content: "I am here to help you discover verified handcrafted products and answer your shopping queries. What can I assist you with? 🛍️",
      mode: 'product_discovery',
      products: []
    });
  }
});

// 3. Serve static assets from Vite build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Fallback to index.html for SPA client-side routing (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vendora Frontend & AI API serving on http://0.0.0.0:${PORT}`);
});
