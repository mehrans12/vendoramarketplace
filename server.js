import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

// Verified In-Stock Marketplace Catalog for Grounding
const VENDORA_CATALOG = [
  {
    id: 'prod-1',
    name: 'Authentic Multani Hand-Painted Blue Pottery Vase',
    category: 'handicrafts',
    price: 3450,
    stock: 8,
    vendor: 'Multani Blue Crafts',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
    description: 'Handcrafted Multani blue pottery vase made with clay and traditional cobalt glaze.'
  },
  {
    id: 'prod-2',
    name: 'Hand-Embroidered Sindhi Ajrak Shawl',
    category: 'fashion',
    price: 2800,
    stock: 15,
    vendor: 'Sindh Heritage Crafts',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=400&q=80',
    description: 'Traditional block-printed Sindhi Ajrak natural dye shawl made from pure breathable cotton.'
  },
  {
    id: 'prod-3',
    name: 'Premium Leather Peshawari Chappal',
    category: 'fashion',
    price: 4200,
    stock: 10,
    vendor: 'Khan Peshawari Shoe',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
    description: 'Authentic double-stitched leather Peshawari chappal with durable tyre sole.'
  },
  {
    id: 'prod-4',
    name: 'Hand-Carved Chiniot Sheesham Wood Jewelry Box',
    category: 'handicrafts',
    price: 3100,
    stock: 6,
    vendor: 'Chiniot Wood Arts',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80',
    description: 'Brass-inlaid wooden jewelry box hand-carved by Chiniot artisans with velvet interior lining.'
  },
  {
    id: 'prod-5',
    name: 'Pure Himalayan Organic Saffron (Zafran 5g)',
    category: 'spices',
    price: 2500,
    stock: 20,
    vendor: 'Northern Spice Co.',
    rating: 5.0,
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
    description: 'Grade-A pure organic saffron harvested from the valleys of Gilgit-Baltistan.'
  },
  {
    id: 'prod-6',
    name: 'Traditional Kundan & Pearl Choker Set',
    category: 'jewelry',
    price: 5800,
    stock: 5,
    vendor: 'Zeenat Jewelers',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
    description: 'Handcrafted 22K gold-plated Kundan choker necklace set with matching earrings.'
  },
  {
    id: 'prod-7',
    name: 'Hand-Knotted Balochi Woolen Rug (4x6 ft)',
    category: 'home-decor',
    price: 14500,
    stock: 3,
    vendor: 'Baloch Weavers Co.',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=400&q=80',
    description: 'Authentic Balochi geometric tribal pattern rug hand-woven with 100% natural wool.'
  },
  {
    id: 'prod-8',
    name: 'Traditional Karahi & Biryani Gourmet Spice Blend',
    category: 'spices',
    price: 1400,
    stock: 25,
    vendor: 'Karachi Spice Bazaar',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
    description: 'Gourmet freshly ground artisan spices for authentic Pakistani curries and biryani.'
  },
  {
    id: 'prod-9',
    name: 'Hand-Embroidered Pashmina Wool Stole',
    category: 'fashion',
    price: 7200,
    stock: 7,
    vendor: 'Kashmir Handloom Guild',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=400&q=80',
    description: 'Ultra-soft genuine Kashmiri wool shawl with intricate hand Tilla embroidery.'
  },
  {
    id: 'prod-10',
    name: 'Himalayan Pink Rock Salt Crystal Lamp',
    category: 'home-decor',
    price: 1850,
    stock: 18,
    vendor: 'Khewra Craft Works',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=400&q=80',
    description: 'Natural ionizing rock salt lamp with wooden base and warm adjustable dimmer switch.'
  },
  {
    id: 'prod-11',
    name: 'Handmade Velvet Zardozi Khussa Shoes',
    category: 'fashion',
    price: 3600,
    stock: 12,
    vendor: 'Lahore Heritage Footwear',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=400&q=80',
    description: 'Traditional wedding and festive velvet khussa embellished with gold thread work.'
  },
  {
    id: 'prod-12',
    name: 'Handmade Clay Chai Matka Cups (Set of 6)',
    category: 'handicrafts',
    price: 1200,
    stock: 30,
    vendor: 'Sindh Clay Studios',
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
    description: 'Earthy unglazed terracotta tea cups for authentic Pakistani Karak chai experience.'
  },
  {
    id: 'prod-13',
    name: 'Vendora Fast-Charge Braided Type-C Cable',
    category: 'electronics',
    price: 850,
    stock: 40,
    vendor: 'TechVolt Pakistan',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80',
    description: 'Durable nylon braided 65W fast charging cable with reinforced alloy connectors.'
  },
  {
    id: 'prod-14',
    name: 'Wireless Bluetooth Noise-Cancelling Earbuds',
    category: 'electronics',
    price: 3950,
    stock: 14,
    vendor: 'TechVolt Pakistan',
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
    description: 'True wireless stereo earbuds with HD microphone and 28-hour total battery life.'
  }
];

// Helper to find matching products in catalog
function searchCatalog(queryText) {
  if (!queryText) return VENDORA_CATALOG.slice(0, 4);
  const q = queryText.toLowerCase();
  
  const matches = VENDORA_CATALOG.filter(p => {
    return p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      (q.includes('pottery') && p.category === 'handicrafts') ||
      (q.includes('vase') && p.id === 'prod-1') ||
      (q.includes('ajrak') && p.id === 'prod-2') ||
      (q.includes('shawl') && (p.id === 'prod-2' || p.id === 'prod-9')) ||
      (q.includes('chappal') && p.id === 'prod-3') ||
      (q.includes('shoe') && (p.id === 'prod-3' || p.id === 'prod-11')) ||
      (q.includes('khussa') && p.id === 'prod-11') ||
      (q.includes('jewelry') && (p.id === 'prod-4' || p.id === 'prod-6')) ||
      (q.includes('box') && p.id === 'prod-4') ||
      (q.includes('saffron') && p.id === 'prod-5') ||
      (q.includes('spice') && (p.id === 'prod-5' || p.id === 'prod-8')) ||
      (q.includes('masala') && p.id === 'prod-8') ||
      (q.includes('kundan') && p.id === 'prod-6') ||
      (q.includes('necklace') && p.id === 'prod-6') ||
      (q.includes('rug') && p.id === 'prod-7') ||
      (q.includes('carpet') && p.id === 'prod-7') ||
      (q.includes('lamp') && p.id === 'prod-10') ||
      (q.includes('salt') && p.id === 'prod-10') ||
      (q.includes('tea') && p.id === 'prod-12') ||
      (q.includes('cup') && p.id === 'prod-12') ||
      (q.includes('cable') && p.id === 'prod-13') ||
      (q.includes('charger') && p.id === 'prod-13') ||
      (q.includes('earbud') && p.id === 'prod-14') ||
      (q.includes('headphone') && p.id === 'prod-14');
  });

  return matches.length > 0 ? matches : VENDORA_CATALOG.slice(0, 4);
}

// 1. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// 2. Grounded AI Shopping Assistant Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, mode, language = 'en' } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: 'messages' array is required." });
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const matchedProducts = searchCatalog(lastUserMsg);

    // Build grounded catalog prompt
    const catalogPrompt = `
CURRENT VERIFIED VENDORA PRODUCT CATALOG (ONLY USE THESE ITEMS):
${VENDORA_CATALOG.map(p => `- ID: ${p.id} | Name: "${p.name}" | Category: ${p.category} | Price: Rs. ${p.price.toLocaleString()} | Vendor: ${p.vendor} | Stock: ${p.stock} | Link: [${p.name}](/product/${p.id}) | Description: ${p.description}`).join('\n')}

STRICT RULES:
1. ONLY recommend and discuss products that exist in the Vendora catalog above. NEVER invent or recommend external products or brands not in Vendora.
2. Whenever you mention or recommend any product, ALWAYS include its exact markdown link in the format [Product Name](/product/prod-id) and state its price in Rs.
3. If the user asks for a product or category not available in Vendora, politely explain that Vendora does not carry that item, and recommend the closest available Vendora products.
4. Support English, Urdu (اردو), Sindhi (سنڌي), and Roman Urdu/Sindhi automatically based on the user's language.
5. Marketplace policies: Nationwide delivery takes 3-5 business days. Cash on Delivery (COD) and Online Payment are available. 7-day hassle-free return policy.
`;

    const langHint = `Target reply language: ${language === 'ur' ? 'Urdu' : language === 'sd' ? 'Sindhi' : 'English'}. If the user writes in Roman Urdu/Sindhi, reply in that style.`;

    const formattedMessages = [
      { role: 'system', content: catalogPrompt },
      { role: 'system', content: langHint },
      ...messages.slice(-6)
    ];

    let replyContent = "";
    let returnedProducts = [];

    if (GEMINI_KEY) {
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GEMINI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gemini-3.6-flash",
            messages: formattedMessages,
            temperature: 0.2,
            max_tokens: 600
          })
        });

        if (response.ok) {
          const data = await response.json();
          replyContent = data.choices?.[0]?.message?.content || "";
        } else {
          const errText = await response.text();
          console.warn("Gemini API call warning:", response.status, errText);
        }
      } catch (geminiErr) {
        console.warn("Gemini fetch error:", geminiErr.message);
      }
    }

    // Determine relevant products for UI cards
    if (replyContent) {
      // Find which products were mentioned in the reply
      returnedProducts = VENDORA_CATALOG.filter(p => {
        return replyContent.includes(p.id) || 
               replyContent.toLowerCase().includes(p.name.toLowerCase()) ||
               lastUserMsg.toLowerCase().includes(p.category.toLowerCase());
      });
      if (returnedProducts.length === 0 && matchedProducts.length > 0) {
        returnedProducts = matchedProducts.slice(0, 3);
      }
    } else {
      // Fallback deterministic response
      if (matchedProducts.length > 0) {
        const listStr = matchedProducts
          .slice(0, 4)
          .map(p => `* [**${p.name}**](/product/${p.id}) - **Rs. ${p.price.toLocaleString()}** (By ${p.vendor})`)
          .join('\n');
        replyContent = `Here are available items matching your request in the Vendora marketplace:\n\n${listStr}\n\nClick on any product above to see complete details and order with Cash on Delivery! 🛍️`;
        returnedProducts = matchedProducts.slice(0, 4);
      } else {
        replyContent = `Welcome to Vendora! We offer verified local Pakistani handicrafts, fashion, spices, and decor. What items would you like to explore today? 🛍️`;
      }
    }

    // Format returned products for frontend cards
    const formattedProducts = returnedProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      images: [p.image],
      rating: p.rating,
      reviews: 15,
      vendor: p.vendor,
      stock: p.stock
    }));

    return res.json({
      content: replyContent,
      mode: mode || 'product_discovery',
      products: formattedProducts
    });

  } catch (err) {
    console.error("AI Chat handler error:", err);
    return res.json({
      content: "I am ready to help you discover authentic items across Vendora. What products are you looking for today? 🛍️",
      mode: 'product_discovery',
      products: []
    });
  }
});

// 3. Serve static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Fallback to index.html for SPA client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vendora Frontend & Grounded AI API serving on http://0.0.0.0:${PORT}`);
});
