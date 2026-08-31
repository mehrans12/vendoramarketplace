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
// VERIFIED VENDORA MARKETPLACE CATALOG
// Only these products exist in the website.
// ============================================================
const VENDORA_CATALOG = [
  {
    id: 'prod-1',
    name: 'Authentic Multani Hand-Painted Blue Pottery Vase',
    category: 'handicrafts',
    keywords: ['pottery','vase','blue','multani','ceramic','clay','craft','handmade','artisan'],
    price: 3450, stock: 8, rating: 4.9,
    vendor: 'Multani Blue Crafts',
    images: ['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80'],
    description: 'Handcrafted Multani blue pottery vase with traditional cobalt glaze.'
  },
  {
    id: 'prod-2',
    name: 'Hand-Embroidered Sindhi Ajrak Shawl',
    category: 'fashion',
    keywords: ['shawl','ajrak','sindhi','cotton','scarf','wrap','fabric','textile','embroidered','cloth'],
    price: 2800, stock: 15, rating: 4.8,
    vendor: 'Sindh Heritage Crafts',
    images: ['https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=400&q=80'],
    description: 'Traditional block-printed Sindhi Ajrak natural dye shawl from pure breathable cotton.'
  },
  {
    id: 'prod-3',
    name: 'Premium Leather Peshawari Chappal',
    category: 'fashion',
    keywords: ['chappal','peshawari','sandal','leather','footwear','shoe','slipper','kpk','pashtun'],
    price: 4200, stock: 10, rating: 4.7,
    vendor: 'Khan Peshawari Shoe',
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80'],
    description: 'Double-stitched leather Peshawari chappal with durable tyre sole.'
  },
  {
    id: 'prod-4',
    name: 'Hand-Carved Chiniot Sheesham Wood Jewelry Box',
    category: 'handicrafts',
    keywords: ['jewelry box','wood','wooden','carved','chiniot','sheesham','storage','craft','gift'],
    price: 3100, stock: 6, rating: 4.9,
    vendor: 'Chiniot Wood Arts',
    images: ['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80'],
    description: 'Brass-inlaid wooden jewelry box hand-carved by Chiniot artisans.'
  },
  {
    id: 'prod-5',
    name: 'Pure Himalayan Organic Saffron (Zafran 5g)',
    category: 'spices',
    keywords: ['saffron','zafran','spice','organic','himalayan','premium','cooking','ingredient'],
    price: 2500, stock: 20, rating: 5.0,
    vendor: 'Northern Spice Co.',
    images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'],
    description: 'Grade-A organic saffron from Gilgit-Baltistan valleys.'
  },
  {
    id: 'prod-6',
    name: 'Traditional Kundan & Pearl Choker Set',
    category: 'jewelry',
    keywords: ['kundan','choker','necklace','jewelry','pearl','gold','earring','set','bridal','wedding'],
    price: 5800, stock: 5, rating: 4.8,
    vendor: 'Zeenat Jewelers',
    images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80'],
    description: '22K gold-plated Kundan choker necklace set with matching earrings.'
  },
  {
    id: 'prod-7',
    name: 'Hand-Knotted Balochi Woolen Rug (4x6 ft)',
    category: 'home-decor',
    keywords: ['rug','carpet','balochi','wool','handknotted','tribal','floor','mat','home','decor'],
    price: 14500, stock: 3, rating: 4.9,
    vendor: 'Baloch Weavers Co.',
    images: ['https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=400&q=80'],
    description: 'Balochi geometric tribal pattern rug hand-woven with 100% natural wool.'
  },
  {
    id: 'prod-8',
    name: 'Traditional Karahi & Biryani Gourmet Spice Blend',
    category: 'spices',
    keywords: ['spice','masala','biryani','karahi','blend','cooking','food','seasoning','curry','garam'],
    price: 1400, stock: 25, rating: 4.7,
    vendor: 'Karachi Spice Bazaar',
    images: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'],
    description: 'Freshly ground artisan spices for authentic Pakistani curries and biryani.'
  },
  {
    id: 'prod-9',
    name: 'Hand-Embroidered Pashmina Wool Stole',
    category: 'fashion',
    keywords: ['pashmina','wool','stole','shawl','kashmir','embroidery','tilla','luxury','wrap','soft'],
    price: 7200, stock: 7, rating: 4.9,
    vendor: 'Kashmir Handloom Guild',
    images: ['https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=400&q=80'],
    description: 'Genuine Kashmiri pashmina wool shawl with hand Tilla embroidery.'
  },
  {
    id: 'prod-10',
    name: 'Himalayan Pink Rock Salt Crystal Lamp',
    category: 'home-decor',
    keywords: ['salt lamp','himalayan','pink','crystal','lamp','home','decor','lighting','ionizer','khewra'],
    price: 1850, stock: 18, rating: 4.8,
    vendor: 'Khewra Craft Works',
    images: ['https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=400&q=80'],
    description: 'Natural ionizing rock salt lamp with wooden base and dimmer switch.'
  },
  {
    id: 'prod-11',
    name: 'Handmade Velvet Zardozi Khussa Shoes',
    category: 'fashion',
    keywords: ['khussa','zardozi','velvet','shoes','footwear','punjabi','wedding','traditional','embroidered'],
    price: 3600, stock: 12, rating: 4.8,
    vendor: 'Lahore Heritage Footwear',
    images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=400&q=80'],
    description: 'Festive velvet khussa with gold thread embroidery work.'
  },
  {
    id: 'prod-12',
    name: 'Handmade Clay Chai Matka Cups (Set of 6)',
    category: 'handicrafts',
    keywords: ['chai','tea','cup','matka','clay','terracotta','earthen','pottery','karak','set'],
    price: 1200, stock: 30, rating: 4.6,
    vendor: 'Sindh Clay Studios',
    images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80'],
    description: 'Unglazed terracotta tea cups for authentic Pakistani Karak chai.'
  },
  {
    id: 'prod-13',
    name: 'Vendora Fast-Charge Braided Type-C Cable',
    category: 'electronics',
    keywords: ['cable','type-c','usb','charging','fast charge','braided','charger','data','tech'],
    price: 850, stock: 40, rating: 4.7,
    vendor: 'TechVolt Pakistan',
    images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80'],
    description: 'Nylon braided 65W fast charging Type-C cable with alloy connectors.'
  },
  {
    id: 'prod-14',
    name: 'Wireless Bluetooth Noise-Cancelling Earbuds',
    category: 'electronics',
    keywords: ['earbuds','earphone','bluetooth','wireless','noise cancelling','audio','music','tws','headphone'],
    price: 3950, stock: 14, rating: 4.6,
    vendor: 'TechVolt Pakistan',
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'],
    description: 'True wireless earbuds with HD microphone and 28-hour battery life.'
  }
];

// Category alias map for natural language search
const CATEGORY_ALIASES = {
  'handicraft': 'handicrafts', 'craft': 'handicrafts', 'pottery': 'handicrafts', 'ceramic': 'handicrafts',
  'fashion': 'fashion', 'clothing': 'fashion', 'clothes': 'fashion', 'dress': 'fashion', 'apparel': 'fashion',
  'shoe': 'fashion', 'shoes': 'fashion', 'footwear': 'fashion', 'sandal': 'fashion',
  'spice': 'spices', 'spices': 'spices', 'masala': 'spices', 'food': 'spices', 'ingredient': 'spices',
  'jewelry': 'jewelry', 'jewellery': 'jewelry', 'necklace': 'jewelry', 'ring': 'jewelry', 'earring': 'jewelry',
  'home': 'home-decor', 'decor': 'home-decor', 'decoration': 'home-decor', 'rug': 'home-decor', 'carpet': 'home-decor', 'lamp': 'home-decor',
  'electronic': 'electronics', 'electronics': 'electronics', 'tech': 'electronics', 'gadget': 'electronics',
  'cable': 'electronics', 'charger': 'electronics', 'earphone': 'electronics', 'earbud': 'electronics'
};

/**
 * Smart keyword search across the Vendora catalog.
 * Returns matched products sorted by relevance score.
 */
function searchCatalog(query, clientCatalog) {
  const catalog = (clientCatalog && clientCatalog.length > 0) ? clientCatalog : VENDORA_CATALOG;
  if (!query || query.trim().length < 2) return catalog.slice(0, 4);

  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(w => w.length > 1);

  const scored = catalog.map(p => {
    let score = 0;
    const pName = (p.name || p.title || '').toLowerCase();
    const pCat = (p.category || '').toLowerCase();
    const pDesc = (p.description || '').toLowerCase();
    const pKw = (p.keywords || []).join(' ').toLowerCase();

    for (const word of words) {
      // Direct name match = highest weight
      if (pName.includes(word)) score += 10;
      // Keyword match
      if (pKw.includes(word)) score += 8;
      // Description match
      if (pDesc.includes(word)) score += 4;
      // Category match
      if (pCat.includes(word)) score += 6;
      // Category alias match
      if (CATEGORY_ALIASES[word] && CATEGORY_ALIASES[word] === pCat) score += 7;
    }
    return { product: p, score };
  });

  const matches = scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return matches.map(x => x.product);
}

/**
 * Build a plain-text description of a product for the AI to describe.
 * AI cannot pick products — only describe the ones we pre-select.
 */
function buildProductContext(products) {
  return products.map(p =>
    `• [${p.name || p.title}](/product/${p.id}) - Rs. ${(p.price || 0).toLocaleString()} | Category: ${p.category} | Vendor: ${p.vendorName || p.vendor} | Stock: ${p.stock} in stock`
  ).join('\n');
}

// 1. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// 2. AI Shopping Assistant — Product-First Architecture
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, catalog: clientCatalog, mode, language = 'en' } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: 'messages' array is required." });
    }

    const lastUserMsg = (messages[messages.length - 1]?.content || '').trim();

    // ── STEP 1: Match products from catalog using code, not AI ──
    const matchedProducts = searchCatalog(lastUserMsg, clientCatalog);
    const hasMatches = matchedProducts.length > 0;

    // ── STEP 2: Build the system prompt AFTER products are selected ──
    // The AI is only told about matching products, so it cannot mention anything outside.
    let systemPrompt;

    if (hasMatches) {
      const productList = buildProductContext(matchedProducts.slice(0, 5));
      systemPrompt = `You are Vendora's shopping assistant. A user asked: "${lastUserMsg}".

The following products from Vendora's catalog match the user's request. YOU MUST ONLY MENTION THESE PRODUCTS. DO NOT suggest, mention, or invent any other products:

${productList}

Write a helpful, friendly 2-3 sentence response describing these products and invite the user to click a link to view details. Format each product as a markdown link exactly as shown above. Reply in ${language === 'ur' ? 'Urdu' : language === 'sd' ? 'Sindhi' : 'English'}.`;
    } else {
      // No product match — tell AI to apologize and show popular items instead
      const popularProducts = buildProductContext(VENDORA_CATALOG.slice(0, 4));
      systemPrompt = `You are Vendora's shopping assistant. A user asked: "${lastUserMsg}".

Vendora does not carry the item the user asked for. Tell the user politely that this item is not available on Vendora.

Then suggest these popular Vendora products instead (ONLY MENTION THESE, NO OTHER PRODUCTS):
${popularProducts}

Keep your response under 3 sentences. Format each as a markdown link. Reply in ${language === 'ur' ? 'Urdu' : language === 'sd' ? 'Sindhi' : 'English'}.`;
    }

    // ── STEP 3: Call Gemini for conversational language only ──
    let replyContent = '';

    if (GEMINI_KEY) {
      try {
        const geminiRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${GEMINI_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gemini-3.6-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: lastUserMsg }
              ],
              temperature: 0.0,
              max_tokens: 400
            })
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          replyContent = data.choices?.[0]?.message?.content || '';
        } else {
          const errText = await geminiRes.text();
          console.warn('Gemini API warning:', geminiRes.status, errText);
        }
      } catch (err) {
        console.warn('Gemini fetch error:', err.message);
      }
    }

    // ── STEP 4: If Gemini failed, generate response deterministically ──
    if (!replyContent) {
      if (hasMatches) {
        const listStr = matchedProducts
          .slice(0, 4)
          .map(p => `* [**${p.name || p.title}**](/product/${p.id}) — Rs. ${(p.price || 0).toLocaleString()}`)
          .join('\n');
        replyContent = `Here are available products matching your search on Vendora:\n\n${listStr}\n\nClick any item above to view full details and order! 🛍️`;
      } else {
        replyContent = `We currently don't carry that item on Vendora. Browse our popular categories: [Handicrafts](/category/handicrafts), [Fashion](/category/fashion), [Spices](/category/spices), and [Jewelry](/category/jewelry). How else can I help? 🛍️`;
      }
    }

    // ── STEP 5: Return matched products for UI cards ──
    const displayProducts = hasMatches ? matchedProducts.slice(0, 4) : VENDORA_CATALOG.slice(0, 4);
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
      content: 'Welcome to Vendora! We carry authentic Pakistani handicrafts, fashion, spices, and home decor. What are you looking for today? 🛍️',
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
