import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

// ============================================================
// VERIFIED VENDORA MARKETPLACE CATALOG — single source of truth
// ============================================================
const VENDORA_CATALOG = [
  {
    id: 'prod-1',
    name: 'Authentic Multani Hand-Painted Blue Pottery Vase',
    category: 'handicrafts',
    keywords: ['pottery','vase','blue','multani','ceramic','clay','craft','handmade','artisan','decorative'],
    price: 3450, stock: 8, rating: 4.9,
    vendor: 'Multani Blue Crafts',
    images: ['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80'],
    description: 'Handcrafted Multani blue pottery vase with traditional cobalt glaze.'
  },
  {
    id: 'prod-2',
    name: 'Hand-Embroidered Sindhi Ajrak Shawl',
    category: 'fashion',
    keywords: ['shawl','ajrak','sindhi','cotton','scarf','wrap','fabric','textile','embroidered','cloth','dupatta'],
    price: 2800, stock: 15, rating: 4.8,
    vendor: 'Sindh Heritage Crafts',
    images: ['https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=400&q=80'],
    description: 'Traditional block-printed Sindhi Ajrak natural dye shawl from breathable cotton.'
  },
  {
    id: 'prod-3',
    name: 'Premium Leather Peshawari Chappal',
    category: 'fashion',
    keywords: ['chappal','peshawari','sandal','leather','footwear','shoe','slipper','kpk','pashtun','mens'],
    price: 4200, stock: 10, rating: 4.7,
    vendor: 'Khan Peshawari Shoe',
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80'],
    description: 'Double-stitched leather Peshawari chappal with durable tyre sole.'
  },
  {
    id: 'prod-4',
    name: 'Hand-Carved Chiniot Sheesham Wood Jewelry Box',
    category: 'handicrafts',
    keywords: ['jewelry box','wood','wooden','carved','chiniot','sheesham','storage','gift','box','chest'],
    price: 3100, stock: 6, rating: 4.9,
    vendor: 'Chiniot Wood Arts',
    images: ['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80'],
    description: 'Brass-inlaid wooden jewelry box hand-carved by Chiniot artisans.'
  },
  {
    id: 'prod-5',
    name: 'Pure Himalayan Organic Saffron (Zafran 5g)',
    category: 'spices',
    keywords: ['saffron','zafran','spice','organic','himalayan','premium','cooking','ingredient','kesar'],
    price: 2500, stock: 20, rating: 5.0,
    vendor: 'Northern Spice Co.',
    images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'],
    description: 'Grade-A organic saffron from Gilgit-Baltistan valleys.'
  },
  {
    id: 'prod-6',
    name: 'Traditional Kundan & Pearl Choker Set',
    category: 'jewelry',
    keywords: ['kundan','choker','necklace','jewelry','jewellery','pearl','gold','earring','set','bridal','wedding','haar'],
    price: 5800, stock: 5, rating: 4.8,
    vendor: 'Zeenat Jewelers',
    images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80'],
    description: '22K gold-plated Kundan choker necklace set with matching earrings.'
  },
  {
    id: 'prod-7',
    name: 'Hand-Knotted Balochi Woolen Rug (4x6 ft)',
    category: 'home-decor',
    keywords: ['rug','carpet','balochi','wool','handknotted','tribal','floor','mat','home','decor','farshi'],
    price: 14500, stock: 3, rating: 4.9,
    vendor: 'Baloch Weavers Co.',
    images: ['https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=400&q=80'],
    description: 'Balochi geometric tribal pattern rug hand-woven with 100% natural wool.'
  },
  {
    id: 'prod-8',
    name: 'Traditional Karahi & Biryani Gourmet Spice Blend',
    category: 'spices',
    keywords: ['spice','masala','biryani','karahi','blend','cooking','food','seasoning','curry','garam','mix'],
    price: 1400, stock: 25, rating: 4.7,
    vendor: 'Karachi Spice Bazaar',
    images: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'],
    description: 'Freshly ground artisan spices for authentic Pakistani curries and biryani.'
  },
  {
    id: 'prod-9',
    name: 'Hand-Embroidered Pashmina Wool Stole',
    category: 'fashion',
    keywords: ['pashmina','wool','stole','shawl','kashmir','embroidery','tilla','luxury','wrap','soft','warm'],
    price: 7200, stock: 7, rating: 4.9,
    vendor: 'Kashmir Handloom Guild',
    images: ['https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=400&q=80'],
    description: 'Genuine Kashmiri pashmina wool shawl with hand Tilla embroidery.'
  },
  {
    id: 'prod-10',
    name: 'Himalayan Pink Rock Salt Crystal Lamp',
    category: 'home-decor',
    keywords: ['salt lamp','himalayan','pink','crystal','lamp','home','decor','lighting','ionizer','khewra','night light'],
    price: 1850, stock: 18, rating: 4.8,
    vendor: 'Khewra Craft Works',
    images: ['https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=400&q=80'],
    description: 'Natural ionizing rock salt lamp with wooden base and dimmer switch.'
  },
  {
    id: 'prod-11',
    name: 'Handmade Velvet Zardozi Khussa Shoes',
    category: 'fashion',
    keywords: ['khussa','zardozi','velvet','shoes','footwear','punjabi','wedding','traditional','embroidered','ladies'],
    price: 3600, stock: 12, rating: 4.8,
    vendor: 'Lahore Heritage Footwear',
    images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=400&q=80'],
    description: 'Festive velvet khussa with gold thread embroidery work.'
  },
  {
    id: 'prod-12',
    name: 'Handmade Clay Chai Matka Cups (Set of 6)',
    category: 'handicrafts',
    keywords: ['chai','tea','cup','matka','clay','terracotta','earthen','pottery','karak','set','mitti'],
    price: 1200, stock: 30, rating: 4.6,
    vendor: 'Sindh Clay Studios',
    images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80'],
    description: 'Unglazed terracotta tea cups for authentic Pakistani Karak chai.'
  },
  {
    id: 'prod-13',
    name: 'Vendora Fast-Charge Braided Type-C Cable',
    category: 'electronics',
    keywords: ['cable','type-c','usb','charging','fast charge','braided','charger','data','tech','wire'],
    price: 850, stock: 40, rating: 4.7,
    vendor: 'TechVolt Pakistan',
    images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80'],
    description: 'Nylon braided 65W fast charging Type-C cable with alloy connectors.'
  },
  {
    id: 'prod-14',
    name: 'Wireless Bluetooth Noise-Cancelling Earbuds',
    category: 'electronics',
    keywords: ['earbuds','earphone','bluetooth','wireless','noise cancelling','audio','music','tws','headphone','earpiece'],
    price: 3950, stock: 14, rating: 4.6,
    vendor: 'TechVolt Pakistan',
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'],
    description: 'True wireless earbuds with HD microphone and 28-hour battery life.'
  }
];

// ── Price query detector ──
function extractPriceFilter(query) {
  const q = query.toLowerCase();
  let minPrice = null;
  let maxPrice = null;

  // "under 5000" / "below 5000" / "less than 5000" / "upto 5000" / "up to 5000"
  const underMatch = q.match(/(?:under|below|less\s+than|upto|up\s+to|max|maximum|within)\s*(?:rs\.?\s*|pkr\s*)?(\d[\d,]*)/i);
  if (underMatch) maxPrice = parseInt(underMatch[1].replace(/,/g, ''));

  // "above 2000" / "over 2000" / "more than 2000" / "minimum 2000"
  const overMatch = q.match(/(?:above|over|more\s+than|minimum|min|from|starting)\s*(?:rs\.?\s*|pkr\s*)?(\d[\d,]*)/i);
  if (overMatch) minPrice = parseInt(overMatch[1].replace(/,/g, ''));

  // "between 1000 and 5000" / "1000 to 5000"
  const betweenMatch = q.match(/(\d[\d,]*)\s*(?:to|and|-)\s*(\d[\d,]*)/);
  if (betweenMatch) {
    minPrice = parseInt(betweenMatch[1].replace(/,/g, ''));
    maxPrice = parseInt(betweenMatch[2].replace(/,/g, ''));
  }

  // bare number like "5000" with "under/budget" nearby
  if (!maxPrice && !minPrice) {
    const budgetMatch = q.match(/(?:budget|price|rs\.?|pkr)\s*(\d[\d,]+)/i);
    if (budgetMatch) maxPrice = parseInt(budgetMatch[1].replace(/,/g, ''));
  }

  return { minPrice, maxPrice };
}

// ── Keyword search ──
function searchByKeywords(query, catalog) {
  if (!query || query.trim().length < 2) return [];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  
  // Skip generic filler words
  const STOP_WORDS = new Set(['find','show','get','give','looking','want','need','for','the','and',
    'or','is','are','me','my','please','products','items','something','anything','best','good',
    'product','item','buy','purchase','order','under','above','between','below','price','rs','pkr',
    'rupees','rupee','5000','1000','2000','3000','4000','6000','7000','8000','10000']);

  const meaningful = words.filter(w => !STOP_WORDS.has(w) && isNaN(w));
  if (meaningful.length === 0) return [];

  const scored = catalog.map(p => {
    let score = 0;
    const pName = (p.name || '').toLowerCase();
    const pCat = (p.category || '').toLowerCase();
    const pDesc = (p.description || '').toLowerCase();
    const pKw = (p.keywords || []).join(' ').toLowerCase();

    for (const word of meaningful) {
      if (pName.includes(word)) score += 10;
      if (pKw.includes(word)) score += 8;
      if (pCat.includes(word)) score += 6;
      if (pDesc.includes(word)) score += 3;
    }
    return { product: p, score };
  });

  return scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.product);
}

// ── Build the final product response 100% from code (no AI product hallucination) ──
function buildProductResponse(products, label, language) {
  if (products.length === 0) return null;
  const lines = products.map(p =>
    `* [**${p.name}**](/product/${p.id}) — **Rs. ${p.price.toLocaleString()}** | ⭐ ${p.rating} | by ${p.vendor}`
  );
  const intro = language === 'ur'
    ? `وینڈورا پر دستیاب ${label}:\n\n`
    : `Here are available Vendora products ${label}:\n\n`;
  return intro + lines.join('\n') + '\n\nClick any product to view details and order with Cash on Delivery! 🛍️';
}

// 1. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// 2. AI Shopping Assistant Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, catalog: clientCatalog, mode, language = 'en' } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: 'messages' array is required." });
    }

    const lastUserMsg = (messages[messages.length - 1]?.content || '').trim();
    
    // Merge client catalog with default (client catalog has Firestore/localStorage products)
    const activeCatalog = (clientCatalog && Array.isArray(clientCatalog) && clientCatalog.length > 0)
      ? clientCatalog
      : VENDORA_CATALOG;

    // ── Step 1: Detect price filter ──
    const { minPrice, maxPrice } = extractPriceFilter(lastUserMsg);
    const hasPriceFilter = minPrice !== null || maxPrice !== null;

    // ── Step 2: Keyword search ──
    const keywordMatches = searchByKeywords(lastUserMsg, activeCatalog);

    // ── Step 3: Apply price filter ──
    let finalProducts = keywordMatches.length > 0 ? keywordMatches : (hasPriceFilter ? activeCatalog : []);
    if (hasPriceFilter) {
      finalProducts = finalProducts.filter(p => {
        if (minPrice !== null && p.price < minPrice) return false;
        if (maxPrice !== null && p.price > maxPrice) return false;
        return true;
      });
    }

    const hasMatches = finalProducts.length > 0;

    // ── Step 4: Build 100% code-generated product response ──
    let productResponseText = null;
    if (hasMatches) {
      let label = 'matching your request';
      if (hasPriceFilter) {
        if (minPrice !== null && maxPrice !== null) label = `between Rs. ${minPrice.toLocaleString()} – Rs. ${maxPrice.toLocaleString()}`;
        else if (maxPrice !== null) label = `under Rs. ${maxPrice.toLocaleString()}`;
        else if (minPrice !== null) label = `above Rs. ${minPrice.toLocaleString()}`;
      }
      productResponseText = buildProductResponse(finalProducts.slice(0, 6), label, language);
    }

    // ── Step 5: Use Gemini ONLY for non-product questions (policy, shipping, help, greetings) ──
    // Detect if this is a conversational/policy question (not a product request)
    const isPolicyQuestion = /\b(deliver|shipping|return|refund|policy|payment|cod|how|when|where|track|cancel|contact|help|support|account|sign|login|register|about|vendora|what is)\b/i.test(lastUserMsg);
    const isGreeting = /^(hi|hello|salam|hey|assalam|assalamualaikum|good|helo|greetings)\b/i.test(lastUserMsg.trim());

    let replyContent = productResponseText;

    if (!replyContent) {
      // This is a non-product query — let Gemini handle policy/greetings/etc.
      if (isPolicyQuestion || isGreeting) {
        if (GEMINI_KEY) {
          try {
            const sysPrompt = `You are Vendora's customer support assistant for a Pakistani online marketplace.
You ONLY answer questions about Vendora's services, policies, and how to use the platform.
Vendora policies:
- Delivery: 3-5 business days nationwide Pakistan
- Returns: 7-day return for damaged/incorrect items
- Payment: Cash on Delivery (COD) and online card payment
- Customer support: Available 9am-9pm daily
DO NOT mention or recommend any external products, brands, or stores.
Reply in ${language === 'ur' ? 'Urdu' : 'English'}. Keep it under 3 sentences.`;

            const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${GEMINI_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'gemini-3.6-flash',
                messages: [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: lastUserMsg }
                ],
                temperature: 0.2,
                max_tokens: 200
              })
            });

            if (geminiRes.ok) {
              const data = await geminiRes.json();
              replyContent = data.choices?.[0]?.message?.content || '';
            }
          } catch (e) {
            console.warn('Gemini error:', e.message);
          }
        }
      }

      // Final fallback for product requests with no match
      if (!replyContent) {
        if (hasPriceFilter && !hasMatches) {
          const rangeLabel = maxPrice ? `under Rs. ${maxPrice.toLocaleString()}` : `above Rs. ${minPrice.toLocaleString()}`;
          replyContent = `Sorry, we don't have any products currently available ${rangeLabel} on Vendora. Here are some of our popular items:\n\n` +
            VENDORA_CATALOG.slice(0, 4).map(p =>
              `* [**${p.name}**](/product/${p.id}) — **Rs. ${p.price.toLocaleString()}**`
            ).join('\n') +
            '\n\nExplore our full catalog for more options! 🛍️';
        } else if (!hasMatches) {
          replyContent = `We currently don't have that specific item on Vendora. Here are our available categories:\n\n` +
            `* 🎨 [Handicrafts](/category/handicrafts) — pottery, woodwork, clay crafts\n` +
            `* 👗 [Fashion](/category/fashion) — chappals, shawls, khussa shoes\n` +
            `* 💍 [Jewelry](/category/jewelry) — kundan sets, traditional jewelry\n` +
            `* 🌶️ [Spices](/category/spices) — saffron, biryani masala\n` +
            `* 🏠 [Home Decor](/category/home-decor) — rugs, salt lamps\n` +
            `* 📱 [Electronics](/category/electronics) — cables, earbuds\n\n` +
            `What are you looking for? I'll find it for you! 🛍️`;
        } else {
          replyContent = `Welcome to Vendora! Ask me to find products, explore categories, or ask about our delivery and return policy. 🛍️`;
        }
      }
    }

    // ── Step 6: Return products for UI cards — ONLY from our catalog ──
    const displayProducts = hasMatches
      ? finalProducts.slice(0, 4)
      : (hasPriceFilter ? [] : VENDORA_CATALOG.slice(0, 4));

    const formattedProducts = displayProducts.map(p => ({
      id: p.id || p.productId,
      name: p.name || p.title,
      price: p.price,
      images: p.images || [p.image || ''],
      rating: p.rating || 4.8,
      reviews: p.reviewsCount || 15,
      vendor: p.vendorName || p.vendor || 'Artisan Merchant',
      stock: p.stock || 10
    }));

    return res.json({
      content: replyContent,
      mode: mode || 'product_discovery',
      products: formattedProducts
    });

  } catch (err) {
    console.error('AI Chat handler error:', err);
    return res.json({
      content: 'Welcome to Vendora! What products are you looking for today? 🛍️',
      mode: 'product_discovery',
      products: []
    });
  }
});

// 3. Serve static frontend
app.use(express.static(path.join(__dirname, 'dist')));

// 4. SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vendora server running on http://0.0.0.0:${PORT}`);
});
