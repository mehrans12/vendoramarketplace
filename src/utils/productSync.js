import { db, hasFirebaseKeys } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export const MOCK_MARKETPLACE_PRODUCTS = [
  {
    id: 'prod-1',
    productId: 'prod-1',
    title: 'Authentic Multani Hand-Painted Blue Pottery Vase',
    name: 'Authentic Multani Hand-Painted Blue Pottery Vase',
    category: 'handicrafts',
    price: 3450,
    stock: 8,
    vendorId: 'vendor-multan-1',
    vendorName: 'Multani Blue Crafts',
    vendorVerified: true,
    rating: 4.9,
    reviewsCount: 24,
    images: ['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
    description: 'Handcrafted Multani blue pottery vase made with clay and traditional cobalt glaze by artisan masters in Multan.',
    createdAt: new Date(Date.now() - 10000000).toISOString()
  },
  {
    id: 'prod-2',
    productId: 'prod-2',
    title: 'Hand-Embroidered Sindhi Ajrak Shawl',
    name: 'Hand-Embroidered Sindhi Ajrak Shawl',
    category: 'fashion',
    price: 2800,
    stock: 15,
    vendorId: 'vendor-sindh-1',
    vendorName: 'Sindh Heritage Crafts',
    vendorVerified: true,
    rating: 4.8,
    reviewsCount: 31,
    images: ['https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=400&q=80',
    description: 'Traditional block-printed Sindhi Ajrak natural dye shawl made from pure breathable cotton.',
    createdAt: new Date(Date.now() - 9000000).toISOString()
  },
  {
    id: 'prod-3',
    productId: 'prod-3',
    title: 'Premium Leather Peshawari Chappal',
    name: 'Premium Leather Peshawari Chappal',
    category: 'fashion',
    price: 4200,
    stock: 10,
    vendorId: 'vendor-kpk-1',
    vendorName: 'Khan Peshawari Shoe',
    vendorVerified: true,
    rating: 4.7,
    reviewsCount: 19,
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
    description: 'Authentic double-stitched leather Peshawari chappal with durable tyre sole.',
    createdAt: new Date(Date.now() - 8000000).toISOString()
  },
  {
    id: 'prod-4',
    productId: 'prod-4',
    title: 'Hand-Carved Chiniot Sheesham Wood Jewelry Box',
    name: 'Hand-Carved Chiniot Sheesham Wood Jewelry Box',
    category: 'handicrafts',
    price: 3100,
    stock: 6,
    vendorId: 'vendor-punjab-1',
    vendorName: 'Chiniot Wood Arts',
    vendorVerified: true,
    rating: 4.9,
    reviewsCount: 12,
    images: ['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80',
    description: 'Brass-inlaid wooden jewelry box hand-carved by Chiniot artisans with velvet interior lining.',
    createdAt: new Date(Date.now() - 7000000).toISOString()
  },
  {
    id: 'prod-5',
    productId: 'prod-5',
    title: 'Pure Himalayan Organic Saffron (Zafran 5g)',
    name: 'Pure Himalayan Organic Saffron (Zafran 5g)',
    category: 'spices',
    price: 2500,
    stock: 20,
    vendorId: 'vendor-north-1',
    vendorName: 'Northern Spice Co.',
    vendorVerified: true,
    rating: 5.0,
    reviewsCount: 42,
    images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
    description: 'Grade-A pure organic saffron harvested from the valleys of Gilgit-Baltistan.',
    createdAt: new Date(Date.now() - 6000000).toISOString()
  },
  {
    id: 'prod-6',
    productId: 'prod-6',
    title: 'Traditional Kundan & Pearl Choker Set',
    name: 'Traditional Kundan & Pearl Choker Set',
    category: 'jewelry',
    price: 5800,
    stock: 5,
    vendorId: 'vendor-lahore-1',
    vendorName: 'Zeenat Jewelers',
    vendorVerified: true,
    rating: 4.8,
    reviewsCount: 16,
    images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
    description: 'Handcrafted 22K gold-plated Kundan choker necklace set with matching earrings.',
    createdAt: new Date(Date.now() - 5000000).toISOString()
  },
  {
    id: 'prod-7',
    productId: 'prod-7',
    title: 'Hand-Knotted Balochi Woolen Rug (4x6 ft)',
    name: 'Hand-Knotted Balochi Woolen Rug (4x6 ft)',
    category: 'home-decor',
    price: 14500,
    stock: 3,
    vendorId: 'vendor-quetta-1',
    vendorName: 'Baloch Weavers Co.',
    vendorVerified: true,
    rating: 4.9,
    reviewsCount: 9,
    images: ['https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=400&q=80',
    description: 'Authentic Balochi geometric tribal pattern rug hand-woven with 100% natural wool.',
    createdAt: new Date(Date.now() - 4000000).toISOString()
  },
  {
    id: 'prod-8',
    productId: 'prod-8',
    title: 'Traditional Karahi & Biryani Gourmet Spice Blend',
    name: 'Traditional Karahi & Biryani Gourmet Spice Blend',
    category: 'spices',
    price: 1400,
    stock: 25,
    vendorId: 'vendor-karachi-1',
    vendorName: 'Karachi Spice Bazaar',
    vendorVerified: true,
    rating: 4.7,
    reviewsCount: 38,
    images: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
    description: 'Gourmet freshly ground artisan spices for authentic Pakistani curries and biryani.',
    createdAt: new Date(Date.now() - 3000000).toISOString()
  },
  {
    id: 'prod-9',
    productId: 'prod-9',
    title: 'Hand-Embroidered Pashmina Wool Stole',
    name: 'Hand-Embroidered Pashmina Wool Stole',
    category: 'fashion',
    price: 7200,
    stock: 7,
    vendorId: 'vendor-kashmir-1',
    vendorName: 'Kashmir Handloom Guild',
    vendorVerified: true,
    rating: 4.9,
    reviewsCount: 14,
    images: ['https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=400&q=80',
    description: 'Ultra-soft genuine Kashmiri wool shawl with intricate hand Tilla embroidery.',
    createdAt: new Date(Date.now() - 2000000).toISOString()
  },
  {
    id: 'prod-10',
    productId: 'prod-10',
    title: 'Himalayan Pink Rock Salt Crystal Lamp',
    name: 'Himalayan Pink Rock Salt Crystal Lamp',
    category: 'home-decor',
    price: 1850,
    stock: 18,
    vendorId: 'vendor-khewra-1',
    vendorName: 'Khewra Craft Works',
    vendorVerified: true,
    rating: 4.8,
    reviewsCount: 52,
    images: ['https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=400&q=80',
    description: 'Natural ionizing rock salt lamp with wooden base and warm adjustable dimmer switch.',
    createdAt: new Date(Date.now() - 1500000).toISOString()
  },
  {
    id: 'prod-11',
    productId: 'prod-11',
    title: 'Handmade Velvet Zardozi Khussa Shoes',
    name: 'Handmade Velvet Zardozi Khussa Shoes',
    category: 'fashion',
    price: 3600,
    stock: 12,
    vendorId: 'vendor-lahore-2',
    vendorName: 'Lahore Heritage Footwear',
    vendorVerified: true,
    rating: 4.8,
    reviewsCount: 22,
    images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=400&q=80',
    description: 'Traditional wedding and festive velvet khussa embellished with gold thread work.',
    createdAt: new Date(Date.now() - 1000000).toISOString()
  },
  {
    id: 'prod-12',
    productId: 'prod-12',
    title: 'Handmade Clay Chai Matka Cups (Set of 6)',
    name: 'Handmade Clay Chai Matka Cups (Set of 6)',
    category: 'handicrafts',
    price: 1200,
    stock: 30,
    vendorId: 'vendor-sindh-2',
    vendorName: 'Sindh Clay Studios',
    vendorVerified: true,
    rating: 4.6,
    reviewsCount: 17,
    images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
    description: 'Earthy unglazed terracotta tea cups for authentic Pakistani Karak chai experience.',
    createdAt: new Date(Date.now() - 500000).toISOString()
  },
  {
    id: 'prod-13',
    productId: 'prod-13',
    title: 'Vendora Fast-Charge Braided Type-C Cable',
    name: 'Vendora Fast-Charge Braided Type-C Cable',
    category: 'electronics',
    price: 850,
    stock: 40,
    vendorId: 'vendor-tech-1',
    vendorName: 'TechVolt Pakistan',
    vendorVerified: true,
    rating: 4.7,
    reviewsCount: 35,
    images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80',
    description: 'Durable nylon braided 65W fast charging cable with reinforced alloy connectors.',
    createdAt: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: 'prod-14',
    productId: 'prod-14',
    title: 'Wireless Bluetooth Noise-Cancelling Earbuds',
    name: 'Wireless Bluetooth Noise-Cancelling Earbuds',
    category: 'electronics',
    price: 3950,
    stock: 14,
    vendorId: 'vendor-tech-1',
    vendorName: 'TechVolt Pakistan',
    vendorVerified: true,
    rating: 4.6,
    reviewsCount: 28,
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'],
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
    description: 'True wireless stereo earbuds with HD microphone and 28-hour total battery life.',
    createdAt: new Date().toISOString()
  }
];

/**
 * Reads all products stored in LocalStorage for any vendor key matching vendora_products_*
 */
export const getLocalStorageVendorProducts = () => {
  const localProds = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vendora_products_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localProds.push(...parsed);
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to read local vendor products:", e);
  }
  return localProds;
};

/**
 * Returns merged list of all marketplace products (Firestore + LocalStorage + Mock)
 */
export const getMarketplaceProducts = async () => {
  const map = new Map();

  // 1. Add mock products
  MOCK_MARKETPLACE_PRODUCTS.forEach(p => map.set(p.id || p.productId, p));

  // 2. Add local storage vendor products
  const localProds = getLocalStorageVendorProducts();
  localProds.forEach(p => {
    const key = p.id || p.productId;
    if (key) map.set(key, p);
  });

  // 3. Add Firestore products if keys exist
  if (hasFirebaseKeys) {
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const key = docSnap.id || data.productId;
        if (key) {
          map.set(key, { id: docSnap.id, ...data });
        }
      });
    } catch (err) {
      console.warn("Firestore products fetch skipped/failed, using local & mock fallback:", err);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
};
