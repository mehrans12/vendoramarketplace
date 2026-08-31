const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { SYSTEM_PROMPT } = require("./prompts");
const { tools, executeTool } = require("./tools");
const { trackMarketplaceEvent } = require("../analytics/events");

let searchModule = null;
const getSearchModule = () => {
  if (!searchModule) searchModule = require("./search");
  return searchModule;
};

/**
 * Base Rate Limiter Interface to support future persistent rate limiters.
 */
class BaseRateLimiter {
  async isRateLimited(identifier) {
    throw new Error("isRateLimited not implemented");
  }
}

/**
 * In-Memory Rate Limiter Implementation (default for Phase 1).
 */
class InMemoryRateLimiter extends BaseRateLimiter {
  constructor(windowMs = 60000, maxRequests = 10) {
    super();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.limits = new Map();
  }

  async isRateLimited(ip) {
    const now = Date.now();
    if (!this.limits.has(ip)) {
      this.limits.set(ip, []);
    }
    const timestamps = this.limits.get(ip).filter(t => now - t < this.windowMs);
    if (timestamps.length >= this.maxRequests) {
      return true;
    }
    timestamps.push(now);
    this.limits.set(ip, timestamps);
    return false;
  }
}

// Instantiate rate limiter
const rateLimiter = new InMemoryRateLimiter(60000, 10);

/**
 * Main AI Chat Assistant Handler
 */
async function handleAssistantRequest(req, res) {
  // 1. CORS Headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // 2. Validate Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 3. Rate Limiting Check
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const isLimited = await rateLimiter.isRateLimited(clientIp);
  if (isLimited) {
    console.warn(`Rate limit triggered for IP: ${clientIp}`);
    return res.status(429).json({ error: "Too many requests. Please wait before trying again." });
  }

  // 4. Auth Validation
  let uid = "anonymous";
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (error) {
      console.warn("Auth token validation failed:", error.message);
    }
  }

  // 5. Input Validation
  const { messages, mode, language = "en" } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request: 'messages' array is required." });
  }

  // Basic Prompt Injection Mitigation: limit length and sanitize control characters
  for (let m of messages) {
    if (m.content && typeof m.content === "string") {
      m.content = m.content.substring(0, 1000).replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    }
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    console.error("Gemini API key is missing in environment variables.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const userQuery = messages[messages.length - 1]?.content || "";

  try {
    // TELEMETRY: log AI Query event
    await trackMarketplaceEvent({
      userId: uid,
      eventType: "AI_QUERY",
      metadata: {
        queryCount: messages.length,
        lastQuery: userQuery,
        language
      }
    }).catch(err => console.warn("Failed logging AI_QUERY event:", err.message));

    const systemHint = `You must reply in the following language: ${language === 'ur' ? 'Urdu' : language === 'sd' ? 'Sindhi' : 'English'}. If the user uses Roman Urdu or Roman Sindhi, you may reply in Roman Urdu/Roman Sindhi or standard script.`;

    const formattedMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: systemHint },
      ...messages.slice(-6) // Maintain last 6 messages context
    ];

    let toolProducts = [];

    const callGemini = async (msgs) => {
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GEMINI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gemini-3.6-flash",
            messages: msgs,
            tools: tools,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 400
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Gemini API returned HTTP ${response.status}: ${errorText.substring(0, 300)}`);
          return null;
        }
        return await response.json();
      } catch (err) {
        console.warn("Gemini API request failed:", err.message);
        return null;
      }
    };

    let data = await callGemini(formattedMessages);
    let responseMessage = data?.choices?.[0]?.message;

    // Multi-turn resolution (max 3 turns)
    let turns = 0;
    while (responseMessage && responseMessage.tool_calls && turns < 3) {
      formattedMessages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch (e) {
          console.warn("Could not parse tool call arguments:", e);
        }

        // Execute tool using backend logic
        const { result, products = [] } = await executeTool(functionName, args, uid, GEMINI_KEY);

        if (products && products.length > 0) {
          toolProducts = [...toolProducts, ...products];
        }

        formattedMessages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: result
        });
      }

      const turnData = await callGemini(formattedMessages);
      if (!turnData || !turnData.choices || !turnData.choices[0]) {
        // Break loop if turn call failed, we will synthesize response using toolProducts
        responseMessage = null;
        break;
      }
      responseMessage = turnData.choices[0].message;
      turns++;
    }

    // Deduplicate collected products
    const uniqueProducts = Array.from(new Map(toolProducts.map(item => [item.id, item])).values());

    let finalContent = responseMessage?.content || "";

    // RESILIENT FALLBACK: If Gemini call failed or didn't return content
    if (!finalContent) {
      if (uniqueProducts.length > 0) {
        const productListStr = uniqueProducts
          .map(p => `* [**${p.title}**](${p.URL || ('/product/' + p.id)}) - Rs. ${(p.price || 0).toLocaleString()} (Stock: ${p.stock || 0})`)
          .join('\n');
        finalContent = `I found these products in the Vendora catalog for your query:\n\n${productListStr}\n\nPlease click on any item above to view its full details or place an order! 🛍️`;
      } else {
        // Perform direct database search fallback
        try {
          const directSearch = await getSearchModule().searchProducts({
            query: userQuery,
            limit: 5,
            userId: uid
          });
          const searchResults = directSearch.results || [];
          if (searchResults.length > 0) {
            const foundItems = searchResults.map(p => {
              const title = typeof p.title === "object" ? (p.title.en || Object.values(p.title)[0]) : (p.title || "Product");
              return `* [**${title}**](/product/${p.id}) - Rs. ${(p.price || 0).toLocaleString()}`;
            }).join('\n');
            finalContent = `Here are available items matching your query in Vendora:\n\n${foundItems}\n\nFeel free to ask for more details!`;
          } else {
            finalContent = `I searched our catalog for "${userQuery}", but no matching items are currently listed on Vendora. Vendora specializes in verified local Pakistani products such as handicrafts, spices, fashion, and home decor. Please let me know if you would like recommendations in these categories! 🛍️`;
          }
        } catch (searchErr) {
          finalContent = `I searched our catalog for "${userQuery}", but couldn't find matching items available on Vendora at this time. Please feel free to ask about our other available categories! 🛍️`;
        }
      }
    }

    // Sanitize URLs to prevent linking to unauthorized external resources
    const sanitizedContent = finalContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      if (url.includes("vendora.pk/product/") || url.startsWith("/product/")) {
        return match;
      }
      return text; // Strip markdown URL format if it's external, leaving text
    });

    // Write internal log of conversation to database (without exposing it to client)
    if (uid !== "anonymous") {
      try {
        const conversationId = `conv-${uid}-${Date.now()}`;
        await admin.firestore().collection("ai_conversations").doc(conversationId).set({
          conversationId,
          userId: uid,
          mode: mode || "product_discovery",
          createdAt: FieldValue.serverTimestamp()
        });

        await admin.firestore().collection("ai_messages").add({
          conversationId,
          userId: uid,
          messages: messages.slice(-2), // save user query and assistant response
          createdAt: FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.warn("Skipped logging AI conversation to firestore:", logErr.message);
      }
    }

    return res.status(200).json({
      content: sanitizedContent,
      mode: mode || "product_discovery",
      products: uniqueProducts
    });

  } catch (error) {
    // TELEMETRY: log AI Error event
    await trackMarketplaceEvent({
      userId: uid,
      eventType: "AI_ERROR",
      metadata: {
        errorMessage: error.message,
        stackTrace: error.stack ? error.stack.substring(0, 500) : ""
      }
    }).catch(err => console.warn("Failed logging AI_ERROR event:", err.message));

    // Fallback response instead of 500 error
    return res.status(200).json({
      content: `I searched our store for "${userQuery}", but could not find matching available items on Vendora right now. Please let me know if you would like assistance with other categories! 🛍️`,
      mode: mode || "product_discovery",
      products: []
    });
  }
}

module.exports = {
  InMemoryRateLimiter,
  handleAssistantRequest
};
