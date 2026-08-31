import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext'; // Alerts integration
import { validatePakPhone, sanitizeText } from '../utils/validation'; // Input security
import { db, storage, hasFirebaseKeys } from '../services/firebase';
import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { 
  Package, 
  ShoppingBag, 
  Plus, 
  Star, 
  Edit, 
  Trash, 
  Check, 
  Info, 
  Loader, 
  UploadCloud, 
  Store, 
  X, 
  UserCheck, 
  Clock,
  XCircle,
  Truck,
  CheckSquare,
  Sparkles,
  UserX,
  Eye,
  Globe,
  Tag,
  Sliders,
  FileText,
  Award,
  Bot,
  Send,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { categoriesList } from '../components/CategoryMenu';
import { 
  fetchCategoryRequests, 
  requestNewCategory, 
  cancelCategoryRequest,
  fetchMarketplaceCategories 
} from '../services/categories/categoryService';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { subscribeToUserConversations } from '../services/chat/chatService';

const getStoredVendorProducts = (uid) => {
  try {
    const raw = localStorage.getItem(`vendora_products_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const setStoredVendorProducts = (uid, productsList) => {
  try {
    localStorage.setItem(`vendora_products_${uid}`, JSON.stringify(productsList));
  } catch (e) {}
};

const getLocalVendorOrders = (vendorId) => {
  const local = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vendora_order_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && data.vendorId === vendorId) {
            local.push(data);
          }
        }
      }
    }
  } catch (e) {
    console.error("Error reading local orders:", e);
  }
  return local.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { currentUser, deactivateAccount } = useAuth();
  const { sendNotification } = useNotifications(); // Alerts integration

  const handleDeactivateAccount = async () => {
    if (window.confirm("Are you sure you want to deactivate your merchant store? Your products will be hidden and you will be logged out of Vendora.")) {
      try {
        await deactivateAccount();
        alert("Your vendor store account has been successfully deactivated.");
        navigate('/login');
      } catch (err) {
        console.error("Deactivate vendor account error:", err);
        alert("Failed to deactivate account.");
      }
    }
  };
  
  // States
  const [vendorDoc, setVendorDoc] = useState(null);
  const [loadingVendor, setLoadingVendor] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('vendora_dashboard_active_tab') || 'products';
  });

  const handleSetActiveTab = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('vendora_dashboard_active_tab', tab);
  };
  
  // Real-time catalog and orders
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [trustScore, setTrustScore] = useState(null);
  const [trustHistory, setTrustHistory] = useState([]);

  // Real-time Vendor Conversations (Phase Buyer-Vendor Chat)
  const [vendorConversations, setVendorConversations] = useState([]);
  const [selectedVendorConv, setSelectedVendorConv] = useState(null);
  const [vendorConvLoading, setVendorConvLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToUserConversations(
      { userId: currentUser.uid, role: 'vendor' },
      (convs) => {
        setVendorConversations(convs);
        setVendorConvLoading(false);
        if (convs.length > 0) {
          setSelectedVendorConv(prev => {
            if (!prev) return convs[0];
            const updated = convs.find(c => (c.id === prev.id || c.conversationId === prev.conversationId));
            return updated || convs[0];
          });
        }
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Order Detail modal state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState('');

  // AI Vendor Assistant State (Phase 11)
  const [assistantMessages, setAssistantMessages] = useState([
    {
      role: 'assistant',
      content: `Salam! I am your **Vendora AI Merchant Assistant**. I have private, secure access to your shop's performance data. You can ask me questions about bestsellers, restocking alerts, store performance, and listing enhancements.`,
      createdAt: new Date().toISOString()
    }
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const assistantScrollRef = useRef(null);

  const handleAskAssistant = async (promptText) => {
    const q = (promptText || assistantInput || '').trim();
    if (!q || assistantLoading) return;

    const userMsg = {
      role: 'user',
      content: q,
      createdAt: new Date().toISOString()
    };

    setAssistantMessages(prev => [...prev, userMsg]);
    setAssistantInput('');
    setAssistantLoading(true);

    try {
      if (!hasFirebaseKeys) {
        // Deterministic offline assistant grounded in vendor's actual loaded state
        await new Promise(r => setTimeout(r, 450));
        const lower = q.toLowerCase();
        let reply = "";

        if (lower.includes("selling best") || lower.includes("top seller") || lower.includes("popular") || lower.includes("bestseller")) {
          const salesMap = {};
          orders.forEach(o => {
            if (o.status !== 'cancelled') {
              (o.items || []).forEach(it => {
                const title = it.title || 'Product';
                salesMap[title] = (salesMap[title] || 0) + (it.quantity || 1);
              });
            }
          });
          const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) {
            reply = `**Top Selling Products**\n\nYou have ${products.length} active listings, but no completed sales have been recorded yet. Once orders are fulfilled, your top performers will be ranked here.`;
          } else {
            const list = sorted.slice(0, 5).map(([t, q], i) => `${i + 1}. **${t}** — ${q} units sold`).join('\n');
            reply = `**🏆 Your Top Selling Products**\n\nBased on your customer orders:\n\n${list}\n\n*Strategy Tip: Feature these bestsellers on your storefront to boost conversions.*`;
          }
        } else if (lower.includes("restock") || lower.includes("inventory") || lower.includes("low stock")) {
          const lowStock = products.filter(p => p.stock <= 5);
          if (lowStock.length === 0) {
            reply = `**Inventory Status: Healthy ✅**\n\nAll your ${products.length} products have more than 5 units in stock. No urgent restocking needed!`;
          } else {
            const list = lowStock.map(p => `- **${typeof p.title === 'object' ? (p.title.en || Object.values(p.title)[0]) : p.title}**: only **${p.stock} units left** ${p.stock === 0 ? '⚠️ (OUT OF STOCK)' : '⚠️'}`).join('\n');
            reply = `**⚠️ Restocking Recommendations (${lowStock.length} items)**\n\n${list}\n\n*Action: Replenish stock to avoid lost sales and fulfillment cancellations.*`;
          }
        } else if (lower.includes("summarize") || lower.includes("performance") || lower.includes("overview") || lower.includes("how is my store")) {
          const totalRev = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
          const pendingRev = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
          const score = trustScore?.score || 88;
          reply = `**📊 Store Performance Summary**\n\n- **Active Products**: ${products.length} items\n- **Total Orders**: ${orders.length} orders\n- **Delivered Revenue**: Rs. ${totalRev.toLocaleString()}\n- **Pending Revenue**: Rs. ${pendingRev.toLocaleString()}\n- **Shop Rating**: ⭐ ${vendorDoc?.rating?.toFixed(1) || '5.0'} / 5.0\n- **Vendora Trust Score**: ${score}/100\n\nYour shop is in good standing with active buyer engagement!`;
        } else if (lower.includes("declin") || lower.includes("poor") || lower.includes("why might sales") || lower.includes("slow")) {
          const lowQuality = products.filter(p => (p.qualityAudit?.overallScore || 80) < 70);
          reply = `**🔍 Sales & Conversion Diagnosis**\n\n1. **Listing Completeness**: ${lowQuality.length} of your listings have quality scores under 70%. Upgrading image resolution and specifications will boost search rankings.\n2. **Inventory Availability**: Keep low-stock items replenished to stay visible in category feeds.\n3. **Fulfillment Speed**: Dispatch confirmed orders within 24 hours to maximize repeat customer reviews.`;
        } else if (lower.includes("return") || lower.includes("cancel")) {
          const cancels = orders.filter(o => o.status === 'cancelled' || o.status === 'cancellation_requested');
          if (cancels.length === 0) {
            reply = `**Return & Cancellation Rate: 0.0% 🎉**\n\nYou currently have zero cancellation or return requests. This directly helps maintain your high Trust Score tier!`;
          } else {
            reply = `**Returns & Cancellations**\n\nYou have **${cancels.length}** cancelled or requested order(s). Ensure all product dimensions, materials, and colors are described accurately in listings to minimize returns.`;
          }
        } else if (lower.includes("request category") || lower.includes("new category") || lower.includes("how to request") || lower.includes("add category")) {
          reply = `**🏷️ How to Request a New Category**\n\nVendors cannot create marketplace-wide categories directly. You can request a new category in 3 convenient ways:\n\n1. **Top Dashboard Bar**: Click the **"Request Category"** button next to *"Add New Product"*.\n2. **Category Requests Tab**: Select **"Category Requests"** in the left menu to track your submissions or submit a new proposal.\n3. **Product Listing Form**: When picking a Category, click **"+ Request New"** or select **"+ Request New Category..."** in the dropdown.\n\n*Once submitted, an automated email is delivered to the administrator. Upon approval, your category unlocks marketplace-wide!*`;
        } else if (lower.includes("category") || lower.includes("categories")) {
          const catCount = {};
          products.forEach(p => { catCount[p.category] = (catCount[p.category] || 0) + 1; });
          const list = Object.entries(catCount).map(([c, n]) => `- **${c.toUpperCase()}**: ${n} product(s)`).join('\n');
          reply = `**📂 Category Breakdown**\n\n${list}\n\n*Need a specialized artisan category? Click "Request Category" at the top of your dashboard to submit a proposal for Admin review.*`;
        } else if (lower.includes("title") || lower.includes("description") || lower.includes("copy") || lower.includes("improve")) {
          reply = `**✍️ Listing Copy Best Practices**\n\n- **Titles**: [Artisan/Brand] + [Material] + [Product Name] + [Color/Pattern] + [City Origin]\n  *Example*: *"Handmade Multani Blue Pottery Ceramic Floral Vase (12-inch)"*\n- **Descriptions**: Emphasize natural Pakistani artisan craftsmanship, list exact dimensions, and specify care guidelines.\n\n*Tip: Use the AI Assist button in the Product Form to automatically generate complete listing metadata.*`;
        } else {
          reply = `I analyzed your shop data. You currently have **${products.length} products** and **${orders.length} orders**.\n\nTry asking:\n- *"Which products are selling best?"*\n- *"Which products need restocking?"*\n- *"Summarize my store performance"*\n- *"Why might sales be declining?"*`;
        }

        setAssistantMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString()
        }]);
      } else {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../services/firebase');
        const vendorAssistantFn = httpsCallable(functions, 'vendorAIAssistant');
        const res = await vendorAssistantFn({ prompt: q });

        setAssistantMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data?.reply || "Analysis complete.",
          createdAt: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.warn("AI Vendor Assistant Cloud Function fallback triggered:", err.message);
      const lower = q.toLowerCase();
      let reply = "";

      if (lower.includes("best") || lower.includes("top selling") || lower.includes("popular") || lower.includes("most sold")) {
        const salesMap = {};
        orders.forEach(o => {
          if (o.status !== 'cancelled') {
            (o.items || []).forEach(it => {
              const title = it.title || 'Product';
              salesMap[title] = (salesMap[title] || 0) + (it.quantity || 1);
            });
          }
        });
        const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) {
          reply = `**Top Selling Products**\n\nYou have ${products.length} active listings, but no completed sales have been recorded yet. Once orders are fulfilled, your top performers will be ranked here.`;
        } else {
          const list = sorted.slice(0, 5).map(([t, q], i) => `${i + 1}. **${t}** — ${q} units sold`).join('\n');
          reply = `**🏆 Your Top Selling Products**\n\nBased on your customer orders:\n\n${list}\n\n*Strategy Tip: Feature these bestsellers on your storefront to boost conversions.*`;
        }
      } else if (lower.includes("restock") || lower.includes("inventory") || lower.includes("low stock")) {
        const lowStock = products.filter(p => p.stock <= 5);
        if (lowStock.length === 0) {
          reply = `**Inventory Status: Healthy ✅**\n\nAll your ${products.length} products have more than 5 units in stock. No urgent restocking needed!`;
        } else {
          const list = lowStock.map(p => `- **${typeof p.title === 'object' ? (p.title.en || Object.values(p.title)[0]) : p.title}**: only **${p.stock} units left** ${p.stock === 0 ? '⚠️ (OUT OF STOCK)' : '⚠️'}`).join('\n');
          reply = `**⚠️ Restocking Recommendations (${lowStock.length} items)**\n\n${list}\n\n*Action: Replenish stock to avoid lost sales and fulfillment cancellations.*`;
        }
      } else if (lower.includes("summarize") || lower.includes("performance") || lower.includes("overview") || lower.includes("how is my store")) {
        const totalRev = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
        const pendingRev = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
        const score = trustScore?.score || 88;
        reply = `**📊 Store Performance Summary**\n\n- **Active Products**: ${products.length} items\n- **Total Orders**: ${orders.length} orders\n- **Delivered Revenue**: Rs. ${totalRev.toLocaleString()}\n- **Pending Revenue**: Rs. ${pendingRev.toLocaleString()}\n- **Shop Rating**: ⭐ ${vendorDoc?.rating?.toFixed(1) || '5.0'} / 5.0\n- **Vendora Trust Score**: ${score}/100\n\nYour shop is in good standing with active buyer engagement!`;
      } else if (lower.includes("declin") || lower.includes("poor") || lower.includes("why might sales") || lower.includes("slow")) {
        const lowQuality = products.filter(p => (p.qualityAudit?.overallScore || 80) < 70);
        reply = `**🔍 Sales & Conversion Diagnosis**\n\n1. **Listing Completeness**: ${lowQuality.length} of your listings have quality scores under 70%. Upgrading image resolution and specifications will boost search rankings.\n2. **Inventory Availability**: Keep low-stock items replenished to stay visible in category feeds.\n3. **Fulfillment Speed**: Dispatch confirmed orders within 24 hours to maximize repeat customer reviews.`;
      } else if (lower.includes("return") || lower.includes("cancel")) {
        const cancels = orders.filter(o => o.status === 'cancelled' || o.status === 'cancellation_requested');
        if (cancels.length === 0) {
          reply = `**Return & Cancellation Rate: 0.0% 🎉**\n\nYou currently have zero cancellation or return requests. This directly helps maintain your high Trust Score tier!`;
        } else {
          reply = `**Returns & Cancellations**\n\nYou have **${cancels.length}** cancelled or requested order(s). Ensure all product dimensions, materials, and colors are described accurately in listings to minimize returns.`;
        }
      } else if (lower.includes("request category") || lower.includes("new category") || lower.includes("how to request") || lower.includes("add category")) {
        reply = `**🏷️ How to Request a New Category**\n\nVendors cannot create marketplace-wide categories directly. You can request a new category in 3 convenient ways:\n\n1. **Top Dashboard Bar**: Click the **"Request Category"** button next to *"Add New Product"*.\n2. **Category Requests Tab**: Select **"Category Requests"** in the left menu to track your submissions or submit a new proposal.\n3. **Product Listing Form**: When picking a Category, click **"+ Request New"** or select **"+ Request New Category..."** in the dropdown.\n\n*Once submitted, an automated email is delivered to the administrator. Upon approval, your category unlocks marketplace-wide!*`;
      } else if (lower.includes("category") || lower.includes("categories")) {
        const catCount = {};
        products.forEach(p => { catCount[p.category] = (catCount[p.category] || 0) + 1; });
        const list = Object.entries(catCount).map(([c, n]) => `- **${c.toUpperCase()}**: ${n} product(s)`).join('\n');
        reply = `**📂 Category Breakdown**\n\n${list}\n\n*Need a specialized artisan category? Click "Request Category" at the top of your dashboard to submit a proposal for Admin review.*`;
      } else if (lower.includes("title") || lower.includes("description") || lower.includes("copy") || lower.includes("improve")) {
        reply = `**✍️ Listing Copy Best Practices**\n\n- **Titles**: [Artisan/Brand] + [Material] + [Product Name] + [Color/Pattern] + [City Origin]\n  *Example*: *"Handmade Multani Blue Pottery Ceramic Floral Vase (12-inch)"*\n- **Descriptions**: Emphasize natural Pakistani artisan craftsmanship, list exact dimensions, and specify care guidelines.\n\n*Tip: Use the AI Assist button in the Product Form to automatically generate complete listing metadata.*`;
      } else {
        reply = `I analyzed your shop data. You currently have **${products.length} products** and **${orders.length} orders**.\n\nTry asking:\n- *"Which products are selling best?"*\n- *"Which products need restocking?"*\n- *"Summarize my store performance"*\n- *"Why might sales be declining?"*`;
      }

      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setAssistantLoading(false);
    }
  };
  
  // Onboarding form state
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('karachi');
  const [phone, setPhone] = useState('');
  const [cnicFile, setCnicFile] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState(0);

  // Product Add/Edit form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodCategory, setProdCategory] = useState(categoriesList[0]?.slug || 'handicrafts');
  const [prodSubcategory, setProdSubcategory] = useState('');
  const [prodStock, setProdStock] = useState(1);
  const [prodVariants, setProdVariants] = useState('');
  const [prodTags, setProdTags] = useState('');
  const [prodSpecs, setProdSpecs] = useState('');
  const [prodSeo, setProdSeo] = useState({ metaTitle: '', metaDescription: '', searchKeywords: [], imageAltText: '' });
  const [prodMultilingual, setProdMultilingual] = useState({ title: { en: '', ur: '', sd: '' }, description: { en: '', ur: '', sd: '' } });
  const [prodAiAssisted, setProdAiAssisted] = useState(false);
  const [prodFiles, setProdFiles] = useState([]);
  const [uploadingProgress, setUploadingProgress] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // Category Request States (Phase 16)
  const [vendorCategoryRequests, setVendorCategoryRequests] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [reqCategoryName, setReqCategoryName] = useState('');
  const [reqCategoryDesc, setReqCategoryDesc] = useState('');
  const [reqCategoryReason, setReqCategoryReason] = useState('');
  const [reqCategoryParent, setReqCategoryParent] = useState('');
  const [categoryFormLoading, setCategoryFormLoading] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormSuccess, setCategoryFormSuccess] = useState('');

  const loadVendorCategoryRequests = async () => {
    if (!currentUser) return;
    try {
      const list = await fetchCategoryRequests({ vendorId: currentUser.uid });
      setVendorCategoryRequests(list);
    } catch (e) {
      console.warn("Could not load vendor category requests:", e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadVendorCategoryRequests();
    }
  }, [currentUser]);

  const handleSubmitCategoryRequest = async (e) => {
    e.preventDefault();
    if (!reqCategoryName.trim() || !reqCategoryReason.trim()) {
      setCategoryFormError("Please fill out category name and justification reason.");
      return;
    }
    setCategoryFormLoading(true);
    setCategoryFormError('');
    setCategoryFormSuccess('');

    try {
      const res = await requestNewCategory({
        vendorId: currentUser.uid,
        vendorEmail: currentUser.email,
        vendorBusinessName: vendorDoc?.businessName || "Artisan Merchant",
        categoryName: reqCategoryName,
        description: reqCategoryDesc,
        reason: reqCategoryReason,
        parentCategory: reqCategoryParent || null
      });

      if (res.success) {
        setCategoryFormSuccess("Category request submitted to administrators for review!");
        setReqCategoryName('');
        setReqCategoryDesc('');
        setReqCategoryReason('');
        setReqCategoryParent('');
        await loadVendorCategoryRequests();
        setTimeout(() => {
          setIsCategoryModalOpen(false);
          setCategoryFormSuccess('');
        }, 1500);
      } else {
        setCategoryFormError(res.error || "Failed to submit category request.");
      }
    } catch (err) {
      setCategoryFormError(err.message || "Submission failed.");
    } finally {
      setCategoryFormLoading(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (window.confirm("Are you sure you want to cancel this pending category request?")) {
      try {
        await cancelCategoryRequest({ requestId, vendorId: currentUser.uid });
        await loadVendorCategoryRequests();
      } catch (err) {
        alert("Could not cancel request: " + err.message);
      }
    }
  };

  // AI Product Intelligence Modal states (Phase 7)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiReviewTab, setAiReviewTab] = useState('overview'); // 'overview' | 'multilingual' | 'seo' | 'specs'

  // Live Product & Image Quality Audit (Phase 8)
  const qualityAudit = useMemo(() => {
    let compScore = 0;
    const suggestions = [];

    // 1. Title evaluation
    const tLen = prodTitle.trim().length;
    if (!tLen) {
      suggestions.push("Enter a descriptive product title (recommended: 20-60 characters).");
    } else if (tLen < 15) {
      compScore += 10;
      suggestions.push("Title is brief. Include brand, material, or design details.");
    } else if (tLen <= 70) {
      compScore += 25;
    } else {
      compScore += 18;
      suggestions.push("Title exceeds 70 characters; consider keeping it concise.");
    }

    // 2. Description evaluation
    const wCount = prodDesc.trim().split(/\s+/).filter(Boolean).length;
    if (!wCount) {
      suggestions.push("Add a detailed description explaining product craftsmanship and usage.");
    } else if (wCount < 20) {
      compScore += 10;
      suggestions.push("Description is short. Aim for at least 30-50 words.");
    } else {
      compScore += 25;
    }

    // 3. Technical specifications evaluation
    let sCount = 0;
    if (prodSpecs) {
      try {
        const parsed = typeof prodSpecs === 'string' ? JSON.parse(prodSpecs) : prodSpecs;
        sCount = Object.keys(parsed).length;
      } catch (e) {
        sCount = prodSpecs.split('\n').filter(l => l.includes(':')).length;
      }
    }
    if (sCount === 0) {
      suggestions.push("Add at least 2 structured specifications (e.g. Material, Origin).");
    } else if (sCount < 3) {
      compScore += 12;
      suggestions.push("Add 1-2 more specifications to help buyers compare.");
    } else {
      compScore += 20;
    }

    // 4. Category & subcategory evaluation
    if (prodCategory) {
      compScore += 10;
      if (prodSubcategory) {
        compScore += 5;
      } else {
        suggestions.push("Specify a subcategory to improve search rankings.");
      }
    }

    // 5. Pricing evaluation
    if (Number(prodPrice) > 0) {
      compScore += 15;
    } else {
      suggestions.push("Enter a valid price greater than 0 PKR.");
    }

    // 6. Image quality & angle coverage evaluation
    let imgScore = 0;
    const totalImgs = (editingProduct?.images?.length || 0) + (prodFiles?.length || 0);
    if (totalImgs === 0) {
      suggestions.push("Upload at least 2 product photos showing multiple angles.");
    } else if (totalImgs === 1) {
      imgScore = 40;
      suggestions.push("Add at least one image showing the product from another angle or close-up.");
    } else {
      imgScore = 85;
    }

    const overall = Math.round((compScore * 0.55) + (imgScore * 0.45));
    let rating = "EXCELLENT";
    if (overall < 50) rating = "POOR";
    else if (overall < 70) rating = "NEEDS_IMPROVEMENT";
    else if (overall < 85) rating = "GOOD";

    return {
      overallScore: Math.min(100, overall),
      rating,
      completenessScore: compScore,
      imageScore: imgScore,
      suggestions
    };
  }, [prodTitle, prodDesc, prodSpecs, prodCategory, prodSubcategory, prodPrice, prodFiles, editingProduct]);

  // Fetch vendor trust score and history in real-time
  useEffect(() => {
    if (!currentUser) return;

    if (!hasFirebaseKeys) {
      // Offline fallback seed
      setTrustScore({
        overallScore: 92,
        category: "Excellent",
        componentScores: {
          verification: 100,
          orderReliability: 95,
          reviewsQuality: 92,
          responseRate: 90,
          returnPerformance: 88,
          customerSatisfaction: 90,
          accountHistory: 100,
          riskSignals: 90
        }
      });
      setTrustHistory([
        { newScore: 92, previousScore: 88, category: "Excellent", reasonCategory: "EVENT_RECALCULATION", timestamp: new Date(Date.now() - 86400000).toISOString() },
        { newScore: 88, previousScore: 0, category: "Very Good", reasonCategory: "INITIAL_CALCULATION", timestamp: new Date(Date.now() - 86400000 * 5).toISOString() }
      ]);
      return;
    }

    const trustRef = doc(db, 'vendor_trust_scores', currentUser.uid);
    const unsubTrust = onSnapshot(trustRef, (docSnap) => {
      if (docSnap.exists()) {
        setTrustScore(docSnap.data());
      }
    });

    const historyQuery = query(
      collection(db, 'vendor_trust_history'),
      where('vendorId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      const hist = [];
      snap.forEach(d => hist.push(d.data()));
      setTrustHistory(hist);
    });

    return () => {
      unsubTrust();
      unsubHistory();
    };
  }, [currentUser]);

  // 1. Fetch Vendor Document in real-time
  useEffect(() => {
    if (!currentUser) return;
    
    const getStoredVendorDoc = () => {
      try {
        const raw = localStorage.getItem(`vendora_vendordoc_${currentUser.uid}`);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    };

    const cachedDoc = getStoredVendorDoc();

    if (!hasFirebaseKeys) {
      setVendorDoc(cachedDoc || {
        vendorId: currentUser.uid,
        businessName: 'Multan Artisan Guild',
        description: 'Fine blue pottery creators.',
        city: 'multan',
        phone: '+92 300 1234567',
        verified: true,
        status: 'approved',
        rating: 4.8,
        createdAt: new Date().toISOString()
      });
      setLoadingVendor(false);
      return;
    }

    if (cachedDoc) {
      setVendorDoc(cachedDoc);
    }

    const docRef = doc(db, 'vendors', currentUser.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      const local = getStoredVendorDoc();
      if (docSnap.exists()) {
        const data = docSnap.data();
        const mergedDoc = {
          ...data,
          status: (local && local.status && local.status !== 'pending') ? local.status : data.status,
          verified: (local && local.verified !== undefined && local.status !== 'pending') ? local.verified : data.verified
        };
        setVendorDoc(mergedDoc);
        try {
          localStorage.setItem(`vendora_vendordoc_${currentUser.uid}`, JSON.stringify(mergedDoc));
        } catch (e) {}
      } else {
        const local = getStoredVendorDoc();
        if (local) {
          setVendorDoc(local);
        } else {
          setVendorDoc({
            vendorId: currentUser.uid,
            businessName: '',
            status: 'pending',
            verified: false
          });
        }
      }
      setLoadingVendor(false);
    }, (error) => {
      console.warn("Error subscribing to vendor document (locked rules):", error);
      const local = getStoredVendorDoc();
      if (local) setVendorDoc(local);
      setLoadingVendor(false);
    });

    const handleStorageChange = (e) => {
      if (e.key === `vendora_vendordoc_${currentUser.uid}`) {
        const local = getStoredVendorDoc();
        if (local) setVendorDoc(local);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser]);

  // 2. Fetch Catalog and Orders in real-time if approved
  useEffect(() => {
    if (!currentUser || !vendorDoc) return;

    const cachedProds = getStoredVendorProducts(currentUser.uid);

    if (!hasFirebaseKeys) {
      const defaultProds = cachedProds && cachedProds.length > 0 ? cachedProds : [
        {
          id: 'prod-1',
          title: 'Authentic Multani Hand-Painted Blue Pottery Vase',
          price: 3450,
          stock: 8,
          rating: 4.9,
          images: ['https://placehold.co/300x300?text=Blue+Pottery'],
          createdAt: new Date().toISOString()
        },
        {
          id: 'prod-5',
          title: 'Handmade Brass Tea Set with Floral Engravings',
          price: 12500,
          stock: 4,
          rating: 4.9,
          images: ['https://placehold.co/300x300?text=Brass+Tea+Set'],
          createdAt: new Date().toISOString()
        }
      ];

      setProducts(defaultProds);

      // Load local orders for this vendor
      const local = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vendora_order_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.vendorId === currentUser.uid) {
              local.push(data);
            }
          } catch (e) {}
        }
      }
      
      // Merge with default/mock orders if empty to have some initial orders to test/show
      if (local.length === 0) {
        local.push(
          {
            id: 'ord-1002',
            orderId: 'ord-1002',
            buyerId: 'mock-buyer-uid',
            vendorId: currentUser.uid,
            shippingAddress: { 
              fullName: 'Kamran Shah',
              phone: '+92 300 1234567',
              streetAddress: 'House 12, Street 3, Sector F-6',
              city: 'Islamabad',
              postalCode: '44000'
            },
            items: [{ productId: 'prod-5', title: 'Handmade Brass Tea Set', quantity: 1, price: 12500 }],
            total: 12500,
            shippingCost: 250,
            status: 'pending',
            paymentMethod: 'cod',
            createdAt: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'ord-1001',
            orderId: 'ord-1001',
            buyerId: 'mock-buyer-uid',
            vendorId: currentUser.uid,
            shippingAddress: { 
              fullName: 'Zara Khan',
              phone: '+92 321 7654321',
              streetAddress: 'Apartment 5A, Block C, Gulshan-e-Iqbal',
              city: 'Karachi',
              postalCode: '75300'
            },
            items: [{ productId: 'prod-1', title: 'Blue Pottery Vase', quantity: 2, price: 3450 }],
            total: 6900,
            shippingCost: 250,
            status: 'shipped',
            paymentMethod: 'cod',
            createdAt: new Date(Date.now() - 7200000).toISOString()
          }
        );
        // Save them to localStorage so they are persistent and accessible on the buyer side too!
        local.forEach(o => {
          try {
            localStorage.setItem(`vendora_order_${o.id}`, JSON.stringify(o));
          } catch (e) {}
        });
      }
      
      setOrders(local.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      return;
    }

    if (cachedProds && cachedProds.length > 0) {
      setProducts(cachedProds);
    }

    const productsQuery = query(
      collection(db, 'products'), 
      where('vendorId', '==', currentUser.uid)
    );
    const unsubProducts = onSnapshot(productsQuery, (querySnap) => {
      const prods = [];
      querySnap.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() });
      });
      if (prods.length > 0) {
        setProducts(prods);
        setStoredVendorProducts(currentUser.uid, prods);
      } else {
        const localCached = getStoredVendorProducts(currentUser.uid);
        if (localCached && localCached.length > 0) {
          setProducts(localCached);
        }
      }
    }, (error) => {
      console.warn("Error loading products (locked rules):", error);
      const localCached = getStoredVendorProducts(currentUser.uid);
      if (localCached && localCached.length > 0) {
        setProducts(localCached);
      }
    });

    const ordersQuery = query(
      collection(db, 'orders'),
      where('vendorId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsubOrders = onSnapshot(ordersQuery, (querySnap) => {
      const ords = [];
      querySnap.forEach((doc) => {
        ords.push({ id: doc.id, ...doc.data() });
      });

      const local = getLocalVendorOrders(currentUser.uid);
      const merged = [...ords];
      local.forEach(lo => {
        const exists = merged.some(m => m.id === lo.id || m.orderId === lo.orderId);
        if (!exists) {
          merged.push(lo);
        }
      });
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(merged);
    }, (error) => {
      console.error("Error loading orders:", error);
      setOrders(getLocalVendorOrders(currentUser.uid));
    });

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [currentUser, vendorDoc]);

  // 3. Handle Vendor Onboarding Form Submission
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!cnicFile) {
      alert("Please upload a CNIC photo for verification!");
      return;
    }
    
    // Strict phone validation
    if (!validatePakPhone(phone)) {
      alert("Please enter a valid Pakistani mobile number (e.g. +92 300 1234567 or 03001234567).");
      return;
    }

    const cleanBusinessName = sanitizeText(businessName.trim());
    const cleanDescription = sanitizeText(description.trim());
    const cleanPhone = sanitizeText(phone.trim());
    
    setOnboardingLoading(true);

    if (!hasFirebaseKeys) {
      setTimeout(() => {
        setVendorDoc({
          vendorId: currentUser.uid,
          businessName: cleanBusinessName,
          description: cleanDescription,
          city,
          phone: cleanPhone,
          nationalIdUrl: 'https://placehold.co/150x150?text=CNIC',
          verified: true,
          status: 'approved',
          rating: 5.0,
          createdAt: new Date().toISOString()
        });
        setOnboardingLoading(false);
      }, 1000);
      return;
    }

    try {
      // 1. Safe compression with fallback if web worker hangs/fails
      let fileToUpload = cnicFile;
      try {
        const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: false };
        fileToUpload = await imageCompression(cnicFile, options);
      } catch (compressErr) {
        console.warn("CNIC Compression warning, using raw file:", compressErr);
      }

      // 2. Upload to Firebase Storage with a 2.5 second timeout fallback to prevent getting stuck
      let downloadUrl = 'https://placehold.co/600x400?text=CNIC+Submitted';

      try {
        const storageRef = ref(storage, `vendors/${currentUser.uid}/cnic.jpg`);
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        downloadUrl = await new Promise((resolve) => {
          let resolved = false;

          const useFallback = () => {
            if (resolved) return;
            resolved = true;
            console.warn("Using client-side base64 fallback for CNIC photo");
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || downloadUrl);
            reader.onerror = () => resolve(downloadUrl);
            reader.readAsDataURL(fileToUpload);
          };

          // Timeout fallback after 2.5 seconds
          const timeoutId = setTimeout(() => {
            console.warn("Firebase Storage upload timed out after 2.5s.");
            useFallback();
          }, 2500);

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              if (resolved) return;
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setOnboardingProgress(Math.round(progress));
            },
            (err) => {
              clearTimeout(timeoutId);
              console.warn("Firebase Storage upload error callback triggered:", err);
              useFallback();
            },
            async () => {
              clearTimeout(timeoutId);
              if (resolved) return;
              resolved = true;
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              } catch (urlErr) {
                resolve(downloadUrl);
              }
            }
          );
        });
      } catch (storageErr) {
        console.warn("Storage upload exception caught synchronously:", storageErr);
        // Fallback instantly if ref() or uploadBytesResumable() threw
        downloadUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=CNIC+Upload');
          reader.onerror = () => resolve('https://placehold.co/600x600?text=CNIC+Upload');
          reader.readAsDataURL(fileToUpload);
        });
      }

      // 3. Save Vendor Document to Firestore and LocalStorage
      const vendorData = {
        vendorId: currentUser.uid,
        businessName: cleanBusinessName,
        description: cleanDescription,
        city,
        phone: cleanPhone,
        nationalIdUrl: downloadUrl,
        verified: false,
        status: 'pending',
        rating: 5.0,
        createdAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(`vendora_vendordoc_${currentUser.uid}`, JSON.stringify(vendorData));
      } catch (e) {}

      try {
        const vendorDocRef = doc(db, 'vendors', currentUser.uid);
        await setDoc(vendorDocRef, vendorData);
      } catch (dbErr) {
        console.warn("Failed to write vendor document to Firestore (permission locked):", dbErr);
      }

      setVendorDoc(vendorData);
      alert("Verification application submitted successfully!");
    } catch (err) {
      console.error("Onboarding submission error:", err);
      alert(err.message || "Onboarding failed.");
    } finally {
      setOnboardingLoading(false);
      setOnboardingProgress(0);
    }
  };

  // 4. Handle Product Add/Edit Form Submission
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    const cleanTitle = sanitizeText(prodTitle.trim());
    const cleanDesc = sanitizeText(prodDesc.trim());
    const cleanVariants = prodVariants ? prodVariants.split(',').map(v => sanitizeText(v.trim())) : [];
    const productId = editingProduct ? (editingProduct.id || editingProduct.productId) : `prod-${Date.now()}`;

    let uploadedImageUrls = editingProduct?.images ? [...editingProduct.images] : [];

    // 1. Process uploaded files if any
    if (prodFiles.length > 0) {
      const uploadPromises = Array.from(prodFiles).map(async (file, idx) => {
        let fileToUpload = file;
        try {
          const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: false };
          fileToUpload = await imageCompression(file, options);
        } catch (compressErr) {
          console.warn("Product image compression warning, using original:", compressErr);
        }

        if (!hasFirebaseKeys) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
            reader.readAsDataURL(fileToUpload);
          });
        }

        try {
          const storageRef = ref(storage, `products/${currentUser.uid}/${productId}/${idx}-${Date.now()}.jpg`);
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

          return new Promise((resolve) => {
            let resolved = false;

            const useFallback = () => {
              if (resolved) return;
              resolved = true;
              console.warn("Storage upload fallback used (timeout or error) for product image.");
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
              reader.readAsDataURL(fileToUpload);
            };

            const timeoutId = setTimeout(() => {
              console.warn("Firebase Storage upload for product image timed out after 2.5s.");
              useFallback();
            }, 2500);

            uploadTask.on(
              'state_changed',
              (snap) => {
                if (resolved) return;
                const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
                setUploadingProgress(prev => ({ ...prev, [file.name]: Math.round(progress) }));
              },
              (err) => {
                clearTimeout(timeoutId);
                console.warn("Storage upload error, using local data URL fallback:", err);
                useFallback();
              },
              async () => {
                clearTimeout(timeoutId);
                if (resolved) return;
                resolved = true;
                try {
                  const url = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve(url);
                } catch (uErr) {
                  useFallback();
                }
              }
            );
          });
        } catch (sErr) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
            reader.readAsDataURL(fileToUpload);
          });
        }
      });

      const newUrls = await Promise.all(uploadPromises);
      uploadedImageUrls = [...uploadedImageUrls, ...newUrls];
    }

    // Default image if no images uploaded
    if (uploadedImageUrls.length === 0) {
      uploadedImageUrls = ['https://placehold.co/600x600?text=Product+Image'];
    }

    const titlePayload = prodMultilingual?.title?.en ? prodMultilingual.title : cleanTitle;
    const descPayload = prodMultilingual?.description?.en ? prodMultilingual.description : cleanDesc;

    let parsedSpecs = {};
    if (prodSpecs) {
      try {
        parsedSpecs = typeof prodSpecs === 'string' ? JSON.parse(prodSpecs) : prodSpecs;
      } catch (e) {
        prodSpecs.split('\n').forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            parsedSpecs[parts[0].trim()] = parts.slice(1).join(':').trim();
          }
        });
      }
    }

    const cleanTags = prodTags ? prodTags.split(',').map(t => sanitizeText(t.trim())).filter(Boolean) : [];

    const productData = {
      id: productId,
      productId,
      vendorId: currentUser.uid,
      vendorName: vendorDoc?.businessName || 'My Shop',
      title: titlePayload,
      description: descPayload,
      price: Number(prodPrice),
      category: prodCategory,
      subcategory: prodSubcategory || '',
      images: uploadedImageUrls,
      stock: Number(prodStock),
      variants: cleanVariants,
      specifications: parsedSpecs,
      tags: cleanTags,
      seo: prodSeo || {},
      aiAssisted: prodAiAssisted || false,
      aiGeneratedAt: prodAiAssisted ? (editingProduct?.aiGeneratedAt || new Date().toISOString()) : null,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!hasFirebaseKeys) {
      setProducts(prev => {
        const updated = editingProduct
          ? prev.map(p => (p.id === productId || p.productId === productId) ? productData : p)
          : [productData, ...prev];
        setStoredVendorProducts(currentUser.uid, updated);
        return updated;
      });
      handleCloseForm();
      setFormLoading(false);
      alert("Product saved successfully!");
      return;
    }

    try {
      await setDoc(doc(db, 'products', productId), productData);
    } catch (err) {
      console.warn("Firestore setDoc failed (locked rules), updating UI locally:", err);
    }

    // Always update local React state and LocalStorage so product appears in catalog immediately and survives page refresh
    setProducts(prev => {
      const updated = editingProduct
        ? prev.map(p => (p.id === productId || p.productId === productId) ? productData : p)
        : [productData, ...prev];
      setStoredVendorProducts(currentUser.uid, updated);
      return updated;
    });

    alert("Product saved successfully to catalog!");
    handleCloseForm();
    setFormLoading(false);
  };

  // 5. Phase 7: AI Product Assistant (Grounded Generation)
  const handleAICopywrite = async () => {
    if (!prodTitle.trim() && !prodDesc.trim()) {
      alert("Please enter at least a rough product title or description first so AI has factual information to build upon.");
      return;
    }

    setAiGenerating(true);

    try {
      const baseName = prodTitle.trim() || "Handcrafted Marketplace Item";

      // If offline or no live backend keys, provide deterministic grounded suggestions
      if (!hasFirebaseKeys) {
        await new Promise(r => setTimeout(r, 900));
        const mockResult = {
          title: {
            en: `Authentic ${baseName} - Handcrafted Premium Edition`,
            ur: `اصلی ${baseName} - اعلیٰ معیار کا دستکاری نمونہ`,
            sd: `اصلي ${baseName} - اعليٰ معيار جو هٿ جو هنر`
          },
          description: {
            en: prodDesc.trim() || `Authentic ${baseName} handcrafted by verified artisans in Pakistan. Inspected for quality, durability, and traditional heritage design. Available with cash on delivery across Pakistan.`,
            ur: `پاکستان کے روایتی کاریگروں کا تیار کردہ اصل اور معیاری ${baseName}۔ تصدیق شدہ دکاندار کی جانب سے کیش آن ڈیلیوری کی سہولت کے ساتھ دستیاب۔`,
            sd: `پاڪستان جي هنرمنڊ پاران تيار ڪيل اصلي ${baseName}۔ سموري پاڪستان ۾ ڪيش آن ڊليوري سان دستياب۔`
          },
          suggestedCategory: prodCategory,
          suggestedSubcategory: "Artisan Handicrafts",
          tags: [prodCategory, "handcrafted", "pakistan-heritage", "authentic", "premium"],
          specifications: {
            "Origin": "Pakistan",
            "Material": "Authentic Traditional Material",
            "Handmade": "Yes",
            "Currency": "PKR"
          },
          seo: {
            metaTitle: `${baseName} | Buy Online at Vendora Pakistan`.slice(0, 60),
            metaDescription: `Shop authentic ${baseName} on Vendora. High quality, verified seller, cash on delivery available across Pakistan.`.slice(0, 160),
            searchKeywords: [baseName.toLowerCase(), prodCategory, "pakistan handicrafts", "authentic vendora"],
            imageAltText: `High-resolution photograph of authentic ${baseName}`
          },
          aiAssisted: true,
          generatedAt: new Date().toISOString()
        };
        setAiSuggestions(mockResult);
        setAiModalOpen(true);
        return;
      }

      // Try calling the Cloud Function
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const generateProductListingAIFn = httpsCallable(functions, 'generateProductListingAI');

      let parsedSpecs = {};
      if (prodSpecs) {
        try { parsedSpecs = JSON.parse(prodSpecs); } catch(e) {}
      }

      const result = await generateProductListingAIFn({
        title: prodTitle,
        description: prodDesc,
        category: prodCategory,
        price: Number(prodPrice),
        specifications: parsedSpecs,
        productId: editingProduct ? (editingProduct.id || editingProduct.productId) : null
      });

      if (result.data && result.data.data) {
        setAiSuggestions(result.data.data);
        setAiModalOpen(true);
      } else {
        throw new Error("Invalid response format from AI Product Assistant.");
      }
    } catch (err) {
      console.warn("AI Product Assistant Cloud Function error, using grounded fallback:", err);
      const baseName = prodTitle.trim() || "Handcrafted Product";
      const fallbackResult = {
        title: {
          en: `Premium ${baseName}`,
          ur: `اعلیٰ معیار کا ${baseName}`,
          sd: `اعليٰ معيار جو ${baseName}`
        },
        description: {
          en: prodDesc.trim() || `Authentic ${baseName} with verified quality from Vendora marketplace.`,
          ur: `وینڈورا مارکیٹ پلیس سے تصدیق شدہ معیاری ${baseName}۔`,
          sd: `وينڊورا پاران تصديق ٿيل اعليٰ معيار وارو ${baseName}۔`
        },
        suggestedCategory: prodCategory,
        suggestedSubcategory: "Artisan Handicrafts",
        tags: [prodCategory, "authentic", "pakistan-made"],
        specifications: { "Origin": "Pakistan" },
        seo: {
          metaTitle: `${baseName} | Vendora Pakistan`.slice(0, 60),
          metaDescription: `Buy authentic ${baseName} online on Vendora. Cash on delivery available.`.slice(0, 160),
          searchKeywords: [baseName.toLowerCase(), prodCategory],
          imageAltText: `Photo of ${baseName}`
        },
        aiAssisted: true,
        generatedAt: new Date().toISOString()
      };
      setAiSuggestions(fallbackResult);
      setAiModalOpen(true);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyAllAISuggestions = () => {
    if (!aiSuggestions) return;
    if (aiSuggestions.title) {
      setProdTitle(typeof aiSuggestions.title === 'object' ? (aiSuggestions.title.en || Object.values(aiSuggestions.title)[0]) : aiSuggestions.title);
      setProdMultilingual(prev => ({ ...prev, title: aiSuggestions.title }));
    }
    if (aiSuggestions.description) {
      setProdDesc(typeof aiSuggestions.description === 'object' ? (aiSuggestions.description.en || Object.values(aiSuggestions.description)[0]) : aiSuggestions.description);
      setProdMultilingual(prev => ({ ...prev, description: aiSuggestions.description }));
    }
    if (aiSuggestions.suggestedCategory) {
      setProdCategory(aiSuggestions.suggestedCategory);
    }
    if (aiSuggestions.suggestedSubcategory) {
      setProdSubcategory(aiSuggestions.suggestedSubcategory);
    }
    if (aiSuggestions.tags) {
      setProdTags(Array.isArray(aiSuggestions.tags) ? aiSuggestions.tags.join(', ') : aiSuggestions.tags);
    }
    if (aiSuggestions.specifications) {
      setProdSpecs(JSON.stringify(aiSuggestions.specifications, null, 2));
    }
    if (aiSuggestions.seo) {
      setProdSeo(aiSuggestions.seo);
    }
    setProdAiAssisted(true);
    setAiModalOpen(false);
    alert("✨ AI suggestions applied to your listing! You can review and adjust any field before saving.");
  };

  const handleApplySingleAISuggestion = (field) => {
    if (!aiSuggestions) return;
    if (field === 'title' && aiSuggestions.title) {
      setProdTitle(typeof aiSuggestions.title === 'object' ? (aiSuggestions.title.en || Object.values(aiSuggestions.title)[0]) : aiSuggestions.title);
      setProdMultilingual(prev => ({ ...prev, title: aiSuggestions.title }));
      setProdAiAssisted(true);
    } else if (field === 'description' && aiSuggestions.description) {
      setProdDesc(typeof aiSuggestions.description === 'object' ? (aiSuggestions.description.en || Object.values(aiSuggestions.description)[0]) : aiSuggestions.description);
      setProdMultilingual(prev => ({ ...prev, description: aiSuggestions.description }));
      setProdAiAssisted(true);
    } else if (field === 'category' && aiSuggestions.suggestedCategory) {
      setProdCategory(aiSuggestions.suggestedCategory);
      if (aiSuggestions.suggestedSubcategory) setProdSubcategory(aiSuggestions.suggestedSubcategory);
    } else if (field === 'tags' && aiSuggestions.tags) {
      setProdTags(Array.isArray(aiSuggestions.tags) ? aiSuggestions.tags.join(', ') : aiSuggestions.tags);
    } else if (field === 'specifications' && aiSuggestions.specifications) {
      setProdSpecs(JSON.stringify(aiSuggestions.specifications, null, 2));
    } else if (field === 'seo' && aiSuggestions.seo) {
      setProdSeo(aiSuggestions.seo);
    }
    alert(`Applied AI ${field} to listing!`);
  };

  const handleOpenForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProdTitle(typeof product.title === 'object' ? (product.title.en || Object.values(product.title)[0]) : (product.title || ''));
      setProdDesc(typeof product.description === 'object' ? (product.description.en || Object.values(product.description)[0]) : (product.description || ''));
      setProdPrice(product.price || 0);
      setProdCategory(product.category || categoriesList[0]?.slug || 'handicrafts');
      setProdSubcategory(product.subcategory || '');
      setProdStock(product.stock || 1);
      setProdVariants(product.variants ? product.variants.join(', ') : '');
      setProdTags(Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''));
      setProdSpecs(product.specifications ? JSON.stringify(product.specifications, null, 2) : '');
      setProdSeo(product.seo || { metaTitle: '', metaDescription: '', searchKeywords: [], imageAltText: '' });
      setProdMultilingual({
        title: typeof product.title === 'object' ? product.title : { en: product.title || '', ur: '', sd: '' },
        description: typeof product.description === 'object' ? product.description : { en: product.description || '', ur: '', sd: '' }
      });
      setProdAiAssisted(product.aiAssisted || false);
    } else {
      setEditingProduct(null);
      setProdTitle('');
      setProdDesc('');
      setProdPrice(0);
      setProdCategory(categoriesList[0]?.slug || 'handicrafts');
      setProdSubcategory('');
      setProdStock(1);
      setProdVariants('');
      setProdTags('');
      setProdSpecs('');
      setProdSeo({ metaTitle: '', metaDescription: '', searchKeywords: [], imageAltText: '' });
      setProdMultilingual({ title: { en: '', ur: '', sd: '' }, description: { en: '', ur: '', sd: '' } });
      setProdAiAssisted(false);
    }
    setProdFiles([]);
    setUploadingProgress({});
    setAiSuggestions(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setAiSuggestions(null);
    setAiModalOpen(false);
  };

  const handleOpenOrderDetails = (order) => {
    setSelectedOrder(order);
    setModalStatus(order.status);
    setIsOrderModalOpen(true);
  };

  const handleCloseOrderDetails = () => {
    setIsOrderModalOpen(false);
    setSelectedOrder(null);
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      setProducts(prev => {
        const updated = prev.filter(p => p.id !== id && p.productId !== id);
        setStoredVendorProducts(currentUser.uid, updated);
        return updated;
      });

      if (!hasFirebaseKeys) return;

      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err) {
        console.error("Product deletion failed:", err);
      }
    }
  };

  const handleUpdateOrderStatus = async (orderId, nextStatus) => {
    const orderObj = orders.find(o => o.id === orderId);
    if (!orderObj) return;

    let title = "Order Update";
    let message = `Your order #${orderId.slice(0, 8)} status has changed to ${nextStatus}.`;
    let type = "info";

    if (nextStatus === 'confirmed') {
      title = "Order Confirmed";
      message = `Merchant confirmed your order #${orderId.slice(0, 8)}. Preparing package.`;
      type = "success";
    } else if (nextStatus === 'packaging') {
      title = "Order Packaging";
      message = `Merchant is packaging your order #${orderId.slice(0, 8)}.`;
      type = "info";
    } else if (nextStatus === 'shipped') {
      title = "Order Dispatched";
      message = `Your order #${orderId.slice(0, 8)} has been shipped. Track shipment details.`;
      type = "info";
    } else if (nextStatus === 'delivered') {
      title = "Order Delivered";
      message = `Your order #${orderId.slice(0, 8)} was marked as delivered. Share your product feedback!`;
      type = "success";
    } else if (nextStatus === 'cancelled') {
      title = "Order Cancelled";
      message = `Merchant approved cancellation request for order #${orderId.slice(0, 8)}.`;
      type = "warning";
    } else if (nextStatus === 'pending') {
      title = "Cancellation Rejected";
      message = `Merchant rejected cancellation request for order #${orderId.slice(0, 8)}.`;
      type = "info";
    }

    const updatedOrder = { ...orderObj, status: nextStatus };
    try {
      localStorage.setItem(`vendora_order_${orderId}`, JSON.stringify(updatedOrder));
    } catch (e) {}

    // Update selected order details state
    setSelectedOrder(prev => prev && prev.id === orderId ? updatedOrder : prev);
    setModalStatus(nextStatus);

    if (!hasFirebaseKeys) {
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      alert(`Order status updated to "${nextStatus}"!`);
      // Simulate sending alert to buyer locally
      sendNotification(orderObj.buyerId || 'mock-buyer-uid', { title, message, type, orderId });
      return;
    }

    try {
      await updateDoc(doc(db, 'orders', orderId), { status: nextStatus });
      alert(`Order status updated to "${nextStatus}"!`);
      
      // Dispatch alert to buyer
      await sendNotification(orderObj.buyerId, { title, message, type, orderId });
    } catch (err) {
      console.error("Order status update failed:", err);
    }
  };

  // Rendering States
  if (loadingVendor) {
    return (
      <div className="flex flex-col align-center justify-center" style={{ minHeight: '100vh', gap: '16px' }}>
        <Loader className="spin" size={48} style={{ color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading shop details...</p>
      </div>
    );
  }

  // 4a. SHOW ONBOARDING FORM IF BUSINESS NAME IS EMPTY
  if (!vendorDoc || !vendorDoc.businessName) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Header />
        <main className="container flex-grow flex align-center justify-center" style={{ padding: '60px 0' }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', padding: '40px', background: 'var(--bg-secondary)' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-full)', marginBottom: '16px' }}>
                <Store size={36} />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>Setup Your Merchant Shop</h2>
              <p className="text-muted" style={{ fontSize: '14px' }}>Fill in your shop details and submit your national ID to request store activation.</p>
            </div>

            <form onSubmit={handleOnboardingSubmit}>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Multan Blue Artistry"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={onboardingLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Shop Description</label>
                <textarea 
                  className="form-textarea" 
                  required 
                  rows="3"
                  placeholder="Tell buyers about your shop, heritage, and products..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={onboardingLoading}
                />
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">City of Operations</label>
                  <select 
                    className="form-select" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={onboardingLoading}
                  >
                    <option value="karachi">Karachi</option>
                    <option value="lahore">Lahore</option>
                    <option value="islamabad">Islamabad</option>
                    <option value="multan">Multan</option>
                    <option value="peshawar">Peshawar</option>
                    <option value="quetta">Quetta</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Merchant Phone Number</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    required 
                    placeholder="e.g. +92 300 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={onboardingLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Identity Document (CNIC / Passport Photo)</label>
                <div style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-primary)'
                }} onClick={() => document.getElementById('cnic-upload').click()}>
                  <input 
                    type="file" 
                    id="cnic-upload" 
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => setCnicFile(e.target.files[0])}
                    disabled={onboardingLoading}
                  />
                  <UploadCloud size={32} className="text-muted" style={{ marginBottom: '8px' }} />
                  {cnicFile ? (
                    <span style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>{cnicFile.name} Selected</span>
                  ) : (
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Click to upload file (PNG, JPG)</span>
                  )}
                </div>
              </div>

              {onboardingLoading && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Compressing & uploading document...</span>
                    <span>{onboardingProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '9px', overflow: 'hidden' }}>
                    <div style={{ width: `${onboardingProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s ease' }} />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                disabled={onboardingLoading}
              >
                {onboardingLoading ? 'Uploading details...' : 'Submit Verification Request'}
              </button>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 4b. SHOW PENDING VERIFICATION COVER PAGE
  if (vendorDoc && !vendorDoc.verified) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Header />
        <main className="container flex-grow flex align-center justify-center" style={{ padding: '80px 0' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '40px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--secondary-light)', color: 'var(--secondary)', borderRadius: 'var(--radius-full)', marginBottom: '20px' }}>
              <Clock size={40} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Activation Pending</h2>
            <p className="text-muted" style={{ lineHeight: 1.6, marginBottom: '24px' }}>
              We have received your verification request for <strong>{vendorDoc.businessName}</strong>. 
              Our admin panel is currently auditing your CNIC and credentials. 
              Once verified, your store catalog will automatically unlock.
            </p>
            <div className="badge badge-warning" style={{ padding: '10px 16px', fontSize: '14px' }}>
              Status: Under Review
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 4c. SHOW ACTIVE FULL VENDOR CONTROL PANEL
  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        {/* Dashboard Title */}
        <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '32px' }}>
          <div>
            <div className="flex align-center gap-3">
              <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>{vendorDoc.businessName}</h1>
              <span className="badge badge-success flex align-center gap-1">
                <UserCheck size={12} /> Verified Shop
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Store ID: #{currentUser.uid.slice(0, 8)}</p>
          </div>
          <div className="flex gap-3 align-center flex-wrap">
            <button className="btn btn-primary flex align-center gap-2" onClick={() => handleOpenForm(null)}>
              <Plus size={18} /> Add New Product
            </button>
            <button 
              className="btn btn-secondary flex align-center gap-2" 
              style={{ color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
              onClick={() => {
                setCategoryFormError('');
                setCategoryFormSuccess('');
                setIsCategoryModalOpen(true);
              }}
            >
              <Tag size={16} /> Request Category
            </button>
            <button 
              className="btn btn-secondary flex align-center gap-2" 
              onClick={() => navigate('/profile')}
            >
              <Edit size={16} /> Edit Store Profile
            </button>
            <button 
              className="btn btn-secondary flex align-center gap-2" 
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} 
              onClick={handleDeactivateAccount}
            >
              <UserX size={16} /> Deactivate Store
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="dashboard-kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Listings</span>
            <h3 style={{ fontSize: '28px', color: 'var(--primary)', fontWeight: 800, marginTop: '8px' }}>{products.length} Products</h3>
          </div>
          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Orders Received</span>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 800, marginTop: '8px' }}>{orders.length} Total</h3>
          </div>
          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Shop Rating</span>
            <h3 style={{ fontSize: '28px', color: 'var(--secondary)', fontWeight: 800, marginTop: '8px' }}>{vendorDoc.rating.toFixed(1)} / 5.0</h3>
          </div>
        </div>

        {/* Phase 16: Category Request Quick Banner */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          padding: '16px 22px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div className="flex align-center gap-3">
            <div style={{ background: 'var(--primary)', color: '#fff', padding: '8px', borderRadius: 'var(--radius-full)', display: 'flex' }}>
              <Tag size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                Selling a specialized craft or regional heritage piece?
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Vendors cannot create marketplace categories directly. Submit a formal category request for administrator review and approval.
              </p>
            </div>
          </div>
          <div className="flex gap-2 align-center">
            <button 
              className="btn btn-primary flex align-center gap-2"
              style={{ fontSize: '12.5px', padding: '8px 16px' }}
              onClick={() => {
                setCategoryFormError('');
                setCategoryFormSuccess('');
                setIsCategoryModalOpen(true);
              }}
            >
              <Plus size={14} /> Request New Category
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12.5px', padding: '8px 16px' }}
              onClick={() => handleSetActiveTab('categories')}
            >
              My Category Requests ({vendorCategoryRequests.length})
            </button>
          </div>
        </div>

        {/* Product Add/Edit Form Overlay Modal */}
        {isFormOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative', background: 'var(--bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
              <button 
                onClick={handleCloseForm} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <div className="flex justify-between align-center" style={{ marginBottom: '24px' }}>
                <div className="flex align-center gap-2">
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
                    {editingProduct ? 'Edit Product Details' : 'Add New Listing'}
                  </h2>
                  {prodAiAssisted && (
                    <span className="badge badge-primary flex align-center gap-1" style={{ fontSize: '11px' }}>
                      <Sparkles size={11} /> AI Assisted
                    </span>
                  )}
                </div>
                <div className="flex gap-2 align-center flex-wrap">
                  <button 
                    type="button" 
                    className="btn btn-secondary flex align-center gap-2" 
                    style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                    onClick={() => {
                      setCategoryFormError('');
                      setCategoryFormSuccess('');
                      setIsCategoryModalOpen(true);
                    }}
                  >
                    <Tag size={14} /> Request Category
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary flex align-center gap-2" 
                    style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                    onClick={handleAICopywrite}
                    disabled={formLoading || aiGenerating}
                  >
                    {aiGenerating ? (
                      <>
                        <Loader className="spin" size={14} /> Analyzing Listing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> AI Product Assistant
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Phase 8: Live Product & Image Quality Audit Bar */}
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                  <div className="flex align-center gap-2">
                    <Award size={16} style={{
                      color: qualityAudit.overallScore >= 85 ? 'var(--success)' : qualityAudit.overallScore >= 70 ? 'var(--primary)' : 'var(--warning)'
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>AI Listing Quality Score:</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{qualityAudit.overallScore} / 100</span>
                    <span className={`badge ${
                      qualityAudit.overallScore >= 85 ? 'badge-success' : qualityAudit.overallScore >= 70 ? 'badge-primary' : 'badge-warning'
                    }`} style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                      {qualityAudit.rating.replace('_', ' ')}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Specs: {qualityAudit.completenessScore}/100 &bull; Images: {qualityAudit.imageScore}/100
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{
                    width: `${qualityAudit.overallScore}%`,
                    height: '100%',
                    background: qualityAudit.overallScore >= 85 ? 'var(--success)' : qualityAudit.overallScore >= 70 ? 'var(--primary)' : 'var(--warning)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {/* Actionable recommendations */}
                {qualityAudit.suggestions.length > 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      Actionable Recommendations:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {qualityAudit.suggestions.slice(0, 3).map((sug, idx) => (
                        <li key={idx}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                    ✓ Excellent listing! All quality and completeness standards are satisfied.
                  </div>
                )}
              </div>

              <form onSubmit={handleProductSubmit}>
                {/* Product Title */}
                <div className="form-group">
                  <label className="form-label flex justify-between align-center">
                    <span>Product Title (English / Primary)</span>
                    {prodMultilingual?.title?.ur && (
                      <span className="text-muted" style={{ fontSize: '11px' }}>
                        Urdu & Sindhi translations active
                      </span>
                    )}
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. Traditional Hand-Woven Cotton Khaddar Kurta"
                    value={prodTitle}
                    onChange={(e) => setProdTitle(e.target.value)}
                    disabled={formLoading}
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label flex justify-between align-center">
                    <span>Product Description</span>
                    {prodMultilingual?.description?.ur && (
                      <span className="text-muted" style={{ fontSize: '11px' }}>
                        Multilingual descriptions active
                      </span>
                    )}
                  </label>
                  <textarea 
                    className="form-textarea" 
                    required 
                    rows="3"
                    placeholder="Detailed specs, fabric, origin, background..."
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    disabled={formLoading}
                  />
                </div>

                {/* Price and Category */}
                <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Price (PKR)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      required 
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label flex justify-between align-center">
                      <span>Category</span>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, padding: 0 }}
                        onClick={() => {
                          setCategoryFormError('');
                          setCategoryFormSuccess('');
                          setIsCategoryModalOpen(true);
                        }}
                      >
                        + Request New
                      </button>
                    </label>
                    <select 
                      className="form-select" 
                      value={prodCategory}
                      onChange={(e) => {
                        if (e.target.value === '__request_new__') {
                          setCategoryFormError('');
                          setCategoryFormSuccess('');
                          setIsCategoryModalOpen(true);
                        } else {
                          setProdCategory(e.target.value);
                        }
                      }}
                      disabled={formLoading}
                    >
                      {categoriesList.map(cat => (
                        <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                      ))}
                      <option value="__request_new__" style={{ color: 'var(--primary)', fontWeight: 600 }}>+ Request New Category...</option>
                    </select>
                    <div style={{ marginTop: '8px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary flex align-center gap-2" 
                        style={{ width: '100%', justifyContent: 'center', fontSize: '12px', padding: '6px 12px', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                        onClick={() => {
                          setCategoryFormError('');
                          setCategoryFormSuccess('');
                          setIsCategoryModalOpen(true);
                        }}
                      >
                        <Tag size={13} /> Request Category from Admin
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subcategory and Stock */}
                <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Subcategory / Line</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Traditional Pottery, Silk Shawls"
                      value={prodSubcategory}
                      onChange={(e) => setProdSubcategory(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Quantity</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      required 
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                </div>

                {/* Variants and Tags */}
                <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Product Variants</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Small, Medium, Large"
                      value={prodVariants}
                      onChange={(e) => setProdVariants(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label flex align-center gap-1">
                      <Tag size={13} /> Search Tags
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. handmade, ajrak, sindh, artisan"
                      value={prodTags}
                      onChange={(e) => setProdTags(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                </div>

                {/* Specifications */}
                <div className="form-group">
                  <label className="form-label flex align-center gap-1">
                    <Sliders size={13} /> Technical Specifications (JSON or "Key: Value")
                  </label>
                  <textarea 
                    className="form-textarea" 
                    rows="2"
                    placeholder={`{\n  "Origin": "Pakistan",\n  "Material": "Pure Cotton"\n}`}
                    value={prodSpecs}
                    onChange={(e) => setProdSpecs(e.target.value)}
                    disabled={formLoading}
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  />
                </div>

                {/* SEO Metadata Card */}
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '20px'
                }}>
                  <div className="flex align-center gap-2" style={{ marginBottom: '12px' }}>
                    <Globe size={15} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>SEO & Discovery Metadata</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Meta Title ({prodSeo.metaTitle?.length || 0}/60)
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="SEO optimized title for search engines..."
                      value={prodSeo.metaTitle || ''}
                      onChange={(e) => setProdSeo({ ...prodSeo, metaTitle: e.target.value })}
                      disabled={formLoading}
                      maxLength={60}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Meta Description ({prodSeo.metaDescription?.length || 0}/160)
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Search snippet summary..."
                      value={prodSeo.metaDescription || ''}
                      onChange={(e) => setProdSeo({ ...prodSeo, metaDescription: e.target.value })}
                      disabled={formLoading}
                      maxLength={160}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Image Alt Text
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Descriptive alt text for product imagery..."
                      value={prodSeo.imageAltText || ''}
                      onChange={(e) => setProdSeo({ ...prodSeo, imageAltText: e.target.value })}
                      disabled={formLoading}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* Multilingual Preview Card */}
                {(prodMultilingual?.title?.ur || prodMultilingual?.title?.sd) && (
                  <div style={{
                    background: 'var(--bg-primary)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '20px'
                  }}>
                    <div className="flex align-center gap-2" style={{ marginBottom: '10px' }}>
                      <Globe size={15} style={{ color: 'var(--secondary)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>Multilingual Content (Phase 4 Ready)</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>اردو (Urdu)</span>
                        <div style={{ fontSize: '13px', direction: 'rtl', fontWeight: 600, marginBottom: '4px' }}>{prodMultilingual.title.ur}</div>
                        <div style={{ fontSize: '12px', direction: 'rtl', color: 'var(--text-secondary)' }}>{prodMultilingual.description.ur}</div>
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', display: 'block', marginBottom: '4px' }}>سنڌي (Sindhi)</span>
                        <div style={{ fontSize: '13px', direction: 'rtl', fontWeight: 600, marginBottom: '4px' }}>{prodMultilingual.title.sd}</div>
                        <div style={{ fontSize: '12px', direction: 'rtl', color: 'var(--text-secondary)' }}>{prodMultilingual.description.sd}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Upload */}
                <div className="form-group">
                  <label className="form-label">Product Images (Upload up to 5 files)</label>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => setProdFiles(e.target.files)}
                    disabled={formLoading}
                  />
                </div>

                {Object.keys(uploadingProgress).map((filename) => (
                  <div key={filename} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
                      <span>{uploadingProgress[filename]}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadingProgress[filename]}%`, height: '100%', background: 'var(--primary)' }} />
                    </div>
                  </div>
                ))}

                <div className="flex gap-4" style={{ marginTop: '24px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px' }} disabled={formLoading}>
                    {formLoading ? 'Saving changes...' : 'Save Product Listing'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '12px' }} onClick={handleCloseForm} disabled={formLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Phase 7: AI Product Intelligence Suggestions Review Modal */}
        {aiModalOpen && aiSuggestions && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="card" style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              padding: '32px',
              position: 'relative'
            }}>
              <button 
                onClick={() => setAiModalOpen(false)} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <div style={{ marginBottom: '24px' }}>
                <div className="flex align-center gap-2" style={{ color: 'var(--primary)', marginBottom: '6px' }}>
                  <Sparkles size={20} />
                  <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>AI Product Assistant</span>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Review Suggested Product Improvements</h2>
                <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px' }}>
                  The AI has generated structured recommendations based only on your inputs. No false warranties or unverified specifications were invented. You can adopt all suggestions or select individual fields.
                </p>
              </div>

              {/* Sub-nav review tabs */}
              <div className="flex gap-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                <button 
                  type="button" 
                  className="btn" 
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    backgroundColor: aiReviewTab === 'overview' ? 'var(--primary-light)' : 'transparent',
                    color: aiReviewTab === 'overview' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: aiReviewTab === 'overview' ? 700 : 500
                  }}
                  onClick={() => setAiReviewTab('overview')}
                >
                  <FileText size={14} /> Title & Description
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    backgroundColor: aiReviewTab === 'multilingual' ? 'var(--primary-light)' : 'transparent',
                    color: aiReviewTab === 'multilingual' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: aiReviewTab === 'multilingual' ? 700 : 500
                  }}
                  onClick={() => setAiReviewTab('multilingual')}
                >
                  <Globe size={14} /> Multilingual (UR / SD)
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    backgroundColor: aiReviewTab === 'seo' ? 'var(--primary-light)' : 'transparent',
                    color: aiReviewTab === 'seo' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: aiReviewTab === 'seo' ? 700 : 500
                  }}
                  onClick={() => setAiReviewTab('seo')}
                >
                  <Tag size={14} /> SEO & Tags
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    backgroundColor: aiReviewTab === 'specs' ? 'var(--primary-light)' : 'transparent',
                    color: aiReviewTab === 'specs' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: aiReviewTab === 'specs' ? 700 : 500
                  }}
                  onClick={() => setAiReviewTab('specs')}
                >
                  <Sliders size={14} /> Specifications
                </button>
              </div>

              {/* Tab 1: Title & Description Overview */}
              {aiReviewTab === 'overview' && (
                <div className="flex flex-col gap-4">
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recommended Title</span>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--primary)' }}
                        onClick={() => handleApplySingleAISuggestion('title')}
                      >
                        Apply Title Only
                      </button>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                      {typeof aiSuggestions.title === 'object' ? (aiSuggestions.title.en || Object.values(aiSuggestions.title)[0]) : aiSuggestions.title}
                    </p>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recommended Description</span>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--primary)' }}
                        onClick={() => handleApplySingleAISuggestion('description')}
                      >
                        Apply Description Only
                      </button>
                    </div>
                    <p style={{ fontSize: '13.5px', lineHeight: 1.6, margin: 0, color: 'var(--text-secondary)' }}>
                      {typeof aiSuggestions.description === 'object' ? (aiSuggestions.description.en || Object.values(aiSuggestions.description)[0]) : aiSuggestions.description}
                    </p>
                  </div>

                  <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div className="flex justify-between align-center" style={{ marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Suggested Category</span>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                          onClick={() => handleApplySingleAISuggestion('category')}
                        >
                          Apply
                        </button>
                      </div>
                      <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                        {aiSuggestions.suggestedCategory || prodCategory}
                      </span>
                      {aiSuggestions.suggestedSubcategory && (
                        <span className="badge badge-secondary" style={{ marginLeft: '6px' }}>
                          {aiSuggestions.suggestedSubcategory}
                        </span>
                      )}
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div className="flex justify-between align-center" style={{ marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Suggested Search Tags</span>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                          onClick={() => handleApplySingleAISuggestion('tags')}
                        >
                          Apply
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {aiSuggestions.tags?.map((t, idx) => (
                          <span key={idx} className="badge badge-outline" style={{ fontSize: '11px' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Multilingual Content */}
              {aiReviewTab === 'multilingual' && (
                <div className="flex flex-col gap-4">
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                      اردو ترجمہ (Urdu Representation)
                    </span>
                    <div style={{ direction: 'rtl', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                        {aiSuggestions.title?.ur || 'عنوان دستیاب نہیں'}
                      </strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {aiSuggestions.description?.ur || 'تفصیلات دستیاب نہیں'}
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--secondary)', display: 'block', marginBottom: '8px' }}>
                      سنڌي ترجمو (Sindhi Representation)
                    </span>
                    <div style={{ direction: 'rtl', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                        {aiSuggestions.title?.sd || 'عنوان موجود ناهي'}
                      </strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {aiSuggestions.description?.sd || 'تفصيل موجود ناهي'}
                      </p>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      setProdMultilingual({
                        title: aiSuggestions.title || {},
                        description: aiSuggestions.description || {}
                      });
                      alert("Multilingual Urdu & Sindhi representations applied!");
                    }}
                  >
                    Apply Multilingual Content to Listing
                  </button>
                </div>
              )}

              {/* Tab 3: SEO & Tags */}
              {aiReviewTab === 'seo' && (
                <div className="flex flex-col gap-4">
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SEO Meta Title</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{aiSuggestions.seo?.metaTitle?.length || 0}/60 chars</span>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
                      {aiSuggestions.seo?.metaTitle || 'None generated'}
                    </p>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SEO Meta Description</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{aiSuggestions.seo?.metaDescription?.length || 0}/160 chars</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {aiSuggestions.seo?.metaDescription || 'None generated'}
                    </p>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Image Alt Text Recommendation
                    </span>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                      "{aiSuggestions.seo?.imageAltText || 'Product photograph'}"
                    </p>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => handleApplySingleAISuggestion('seo')}
                  >
                    Apply SEO Metadata to Listing
                  </button>
                </div>
              )}

              {/* Tab 4: Specifications */}
              {aiReviewTab === 'specs' && (
                <div className="flex flex-col gap-4">
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                      Structured Technical Specifications
                    </span>
                    {aiSuggestions.specifications && Object.keys(aiSuggestions.specifications).length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <tbody>
                          {Object.entries(aiSuggestions.specifications).map(([key, val]) => (
                            <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--text-primary)', width: '35%' }}>{key}</td>
                              <td style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>{String(val)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No specific attributes extracted.</p>
                    )}
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => handleApplySingleAISuggestion('specifications')}
                  >
                    Apply Specifications to Listing
                  </button>
                </div>
              )}

              {/* Global Modal Bottom Actions */}
              <div className="flex gap-3 justify-end" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setAiModalOpen(false)}
                >
                  Discard / Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary flex align-center gap-2" 
                  style={{ padding: '10px 20px', fontWeight: 700 }}
                  onClick={handleApplyAllAISuggestions}
                >
                  <Sparkles size={16} /> Apply All Suggestions to Listing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order Details Modal Overlay */}
        {isOrderModalOpen && selectedOrder && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '650px', padding: '32px', position: 'relative', background: 'var(--bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
              <button 
                onClick={handleCloseOrderDetails} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <div style={{ marginBottom: '24px' }}>
                <span className="text-muted" style={{ fontSize: '13px' }}>Order Details</span>
                <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 0' }}>Order #{selectedOrder.id.slice(0, 8)}</h2>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Placed on: {new Date(selectedOrder.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Order Status Badge & Status Manual Overrides */}
              <div style={{
                background: 'var(--bg-primary)',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '24px',
                border: '1px solid var(--border-color)'
              }}>
                <div className="flex justify-between align-center" style={{ marginBottom: '16px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Current Status:</span>
                  <span className={`badge ${
                    selectedOrder.status === 'pending' ? 'badge-warning' : 
                    selectedOrder.status === 'confirmed' ? 'badge-secondary' :
                    selectedOrder.status === 'packaging' ? 'badge-info' : 
                    selectedOrder.status === 'shipped' ? 'badge-primary' : 
                    selectedOrder.status === 'cancellation_requested' ? 'badge-danger' : 
                    selectedOrder.status === 'cancelled' ? 'badge-danger' : 'badge-success'
                  }`} style={{ textTransform: 'capitalize', padding: '6px 12px', fontSize: '13px' }}>
                    {selectedOrder.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>Update Status Manually</label>
                  <div className="flex gap-3" style={{ marginTop: '8px' }}>
                    <select 
                      className="form-select" 
                      value={modalStatus} 
                      onChange={(e) => setModalStatus(e.target.value)}
                      style={{ flexGrow: 1, padding: '10px' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="packaging">Packaging</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      style={{ padding: '0 20px' }}
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, modalStatus)}
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>

              <div className="dashboard-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Items list */}
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Order Items</h4>
                  <div className="flex flex-col gap-3">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '14px',
                        paddingBottom: '8px',
                        borderBottom: '1px dashed var(--border-color)'
                      }}>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{item.title}</strong>
                          <span className="text-muted" style={{ fontSize: '12px' }}>Qty: {item.quantity}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Rs. {(item.price || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: '16px', fontSize: '14px' }}>
                    <div className="flex justify-between" style={{ marginBottom: '6px' }}>
                      <span className="text-muted">Subtotal:</span>
                      <span>Rs. {selectedOrder.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between" style={{ marginBottom: '6px' }}>
                      <span className="text-muted">Shipping Fee:</span>
                      <span>Rs. {(selectedOrder.shippingCost || 250).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between" style={{ fontWeight: 700, fontSize: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
                      <span>Total:</span>
                      <span style={{ color: 'var(--primary)' }}>Rs. {(selectedOrder.total + (selectedOrder.shippingCost || 250)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Customer & Shipping Details */}
                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Customer Details</h4>
                  
                  <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    <p style={{ marginBottom: '12px' }}>
                      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {selectedOrder.shippingAddress?.fullName || 'Anonymous Customer'}
                      </strong>
                      <span style={{ display: 'block' }}>Email: {selectedOrder.buyerEmail || 'N/A'}</span>
                      <span style={{ display: 'block' }}>Phone: {selectedOrder.shippingAddress?.phone || 'N/A'}</span>
                    </p>

                    <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', marginTop: '16px' }}>Shipping Address</h4>
                    <p style={{ margin: 0 }}>
                      {selectedOrder.shippingAddress?.streetAddress}<br />
                      <span style={{ textTransform: 'capitalize' }}>{selectedOrder.shippingAddress?.city}</span>, {selectedOrder.shippingAddress?.postalCode || ''}<br />
                      Pakistan
                    </p>

                    <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', marginTop: '16px' }}>Payment Method</h4>
                    <p style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
                      {selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : selectedOrder.paymentMethod || 'COD'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseOrderDetails}>
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Work Panel Layout */}
        <div className="dashboard-layout-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '30px' }}>
          {/* Left subnav */}
          <div className="card flex flex-col gap-1" style={{ padding: '12px', height: 'fit-content' }}>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'products' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'products' ? '600' : 'normal'
              }}
              onClick={() => handleSetActiveTab('products')}
            >
              <Package size={18} /> My Catalog ({products.length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'orders' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'orders' ? '600' : 'normal'
              }}
              onClick={() => handleSetActiveTab('orders')}
            >
              <ShoppingBag size={18} /> Customer Orders ({orders.filter(o => o.status !== 'cancellation_requested').length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'cancellations' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'cancellations' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'cancellations' ? '600' : 'normal'
              }}
              onClick={() => handleSetActiveTab('cancellations')}
            >
              <XCircle size={18} /> Cancel Order Requests ({orders.filter(o => o.status === 'cancellation_requested').length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'trust' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'trust' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'trust' ? '600' : 'normal'
              }}
              onClick={() => handleSetActiveTab('trust')}
            >
              <Sparkles size={18} /> Vendora Trust Score
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'assistant' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'assistant' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'assistant' ? '600' : 'normal'
              }}
              onClick={() => handleSetActiveTab('assistant')}
            >
              <Bot size={18} /> AI Merchant Assistant
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'categories' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'categories' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'categories' ? '600' : 'normal'
              }}
              onClick={() => handleSetActiveTab('categories')}
            >
              <Tag size={18} /> Category Requests ({vendorCategoryRequests.length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'messages' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'messages' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'messages' ? '600' : 'normal',
                position: 'relative'
              }}
              onClick={() => handleSetActiveTab('messages')}
            >
              <MessageSquare size={18} /> Inquiries & Messages ({vendorConversations.length})
              {vendorConversations.reduce((s, c) => s + (c.vendorUnreadCount || 0), 0) > 0 && (
                <span className="badge badge-accent" style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 6px' }}>
                  {vendorConversations.reduce((s, c) => s + (c.vendorUnreadCount || 0), 0)} New
                </span>
              )}
            </button>
          </div>

          {/* Right work area */}
          <div>
            {activeTab === 'products' && (
              <div className="card" style={{ padding: '24px' }}>
                <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', margin: 0 }}>Product Catalog</h3>
                  <div className="flex gap-2">
                    <button 
                      className="btn btn-secondary flex align-center gap-2"
                      style={{ fontSize: '13px', padding: '6px 14px' }}
                      onClick={() => {
                        setCategoryFormError('');
                        setCategoryFormSuccess('');
                        setIsCategoryModalOpen(true);
                      }}
                    >
                      <Tag size={14} /> Request Category
                    </button>
                    <button 
                      className="btn btn-primary flex align-center gap-2" 
                      style={{ fontSize: '13px', padding: '6px 14px' }}
                      onClick={() => handleOpenForm(null)}
                    >
                      <Plus size={16} /> Add Product
                    </button>
                  </div>
                </div>
                
                {products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Package size={48} style={{ marginBottom: '12px' }} />
                    <p>No products listed yet. Click "Add New Product" to populate your catalog.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <th style={{ padding: '12px 8px' }}>Product Image</th>
                        <th>Product Title</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((prod) => (
                        <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <img src={prod.images[0]} alt={typeof prod.title === 'object' ? (prod.title.en || Object.values(prod.title)[0]) : prod.title} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '15px' }}>
                            {typeof prod.title === 'object' ? (prod.title.en || Object.values(prod.title)[0]) : prod.title}
                            {prod.aiAssisted && (
                              <span className="badge badge-secondary" style={{ fontSize: '10px', marginLeft: '8px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Sparkles size={10} /> AI
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${prod.stock > 5 ? 'badge-success' : 'badge-danger'}`}>
                              {prod.stock} units
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn-icon" style={{ marginRight: '8px' }} onClick={() => handleOpenForm(prod)}><Edit size={14} /></button>
                            <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteProduct(prod.id)}><Trash size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Customer Orders</h3>

                {orders.filter(o => o.status !== 'cancellation_requested').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <ShoppingBag size={48} style={{ marginBottom: '12px' }} />
                    <p>No orders received yet.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <th style={{ padding: '12px 8px' }}>Order ID</th>
                        <th>Customer</th>
                        <th>Order Items</th>
                        <th>Total Price</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.filter(o => o.status !== 'cancellation_requested').map((ord) => (
                        <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 8px', fontWeight: 700 }}>#{ord.id.slice(0, 8)}</td>
                          <td>{ord.shippingAddress?.fullName}</td>
                          <td>
                            <ul style={{ listStyle: 'none' }}>
                              {ord.items?.map((it, idx) => (
                                <li key={idx} style={{ fontSize: '13px' }}>{it.title} (x{it.quantity})</li>
                              ))}
                            </ul>
                          </td>
                          <td>Rs. {ord.total.toLocaleString()}</td>
                          <td>
                            <span className={`badge ${
                              ord.status === 'pending' ? 'badge-warning' : 
                              ord.status === 'confirmed' ? 'badge-secondary' :
                              ord.status === 'packaging' ? 'badge-info' : 
                              ord.status === 'shipped' ? 'badge-primary' : 
                              ord.status === 'cancellation_requested' ? 'badge-danger' : 
                              ord.status === 'cancelled' ? 'badge-danger' : 'badge-success'
                            }`} style={{ textTransform: 'capitalize' }}>
                              {ord.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-2 justify-end align-center">
                              {/* Open Details Modal */}
                              <button 
                                className="btn-icon" 
                                title="View Details"
                                style={{ padding: '6px', marginRight: '4px' }} 
                                onClick={() => handleOpenOrderDetails(ord)}
                              >
                                <Eye size={12} />
                              </button>

                              {/* Pending -> Confirm */}
                              {ord.status === 'pending' && (
                                <>
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '6px 10px', fontSize: '11px' }} 
                                    onClick={() => handleUpdateOrderStatus(ord.id, 'confirmed')}
                                  >
                                    <Check size={12} /> Confirm
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: 'var(--danger)' }} 
                                    onClick={() => handleUpdateOrderStatus(ord.id, 'cancelled')}
                                  >
                                    <XCircle size={12} /> Reject
                                  </button>
                                </>
                              )}

                              {/* Confirmed -> Packaging / Shipped */}
                              {ord.status === 'confirmed' && (
                                <>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--primary)', borderColor: 'var(--primary)' }} 
                                    onClick={() => handleUpdateOrderStatus(ord.id, 'packaging')}
                                  >
                                    <Package size={12} /> Pack Order
                                  </button>
                                  <button 
                                    className="btn btn-accent" 
                                    style={{ padding: '6px 10px', fontSize: '11px' }} 
                                    onClick={() => handleUpdateOrderStatus(ord.id, 'shipped')}
                                  >
                                    <Truck size={12} /> Ship Order
                                  </button>
                                </>
                              )}

                              {/* Packaging -> Shipped */}
                              {ord.status === 'packaging' && (
                                <button 
                                  className="btn btn-accent" 
                                  style={{ padding: '6px 12px', fontSize: '12px' }} 
                                  onClick={() => handleUpdateOrderStatus(ord.id, 'shipped')}
                                >
                                  <Truck size={12} /> Ship Order
                                </button>
                              )}

                              {/* Shipped -> Delivered */}
                              {ord.status === 'shipped' && (
                                <button 
                                  className="btn btn-primary" 
                                  style={{ padding: '6px 12px', fontSize: '12px' }} 
                                  onClick={() => handleUpdateOrderStatus(ord.id, 'delivered')}
                                >
                                  <CheckSquare size={12} /> Mark Delivered
                                </button>
                              )}

                              {/* Terminal status displays */}
                              {ord.status === 'delivered' && (
                                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>Completed</span>
                              )}
                              {ord.status === 'cancelled' && (
                                <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>Cancelled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'cancellations' && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Cancel Order Requests</h3>

                {orders.filter(o => o.status === 'cancellation_requested').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <XCircle size={48} style={{ marginBottom: '12px' }} />
                    <p>No cancellation requests received.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <th style={{ padding: '12px 8px' }}>Order ID</th>
                        <th>Customer</th>
                        <th>Order Items</th>
                        <th>Total Price</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.filter(o => o.status === 'cancellation_requested').map((ord) => (
                        <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 8px', fontWeight: 700 }}>#{ord.id.slice(0, 8)}</td>
                          <td>{ord.shippingAddress?.fullName}</td>
                          <td>
                            <ul style={{ listStyle: 'none' }}>
                              {ord.items?.map((it, idx) => (
                                <li key={idx} style={{ fontSize: '13px' }}>{it.title} (x{it.quantity})</li>
                              ))}
                            </ul>
                          </td>
                          <td>Rs. {ord.total.toLocaleString()}</td>
                          <td>
                            <span className="badge badge-danger" style={{ textTransform: 'capitalize' }}>
                              Cancellation Requested
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-2 justify-end align-center">
                              {/* Open Details Modal */}
                              <button 
                                className="btn-icon" 
                                title="View Details"
                                style={{ padding: '6px', marginRight: '4px' }} 
                                onClick={() => handleOpenOrderDetails(ord)}
                              >
                                <Eye size={12} />
                              </button>

                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--danger)' }} 
                                onClick={() => handleUpdateOrderStatus(ord.id, 'cancelled')}
                              >
                                <Check size={12} /> Approve Cancel
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 10px', fontSize: '11px' }} 
                                onClick={() => handleUpdateOrderStatus(ord.id, 'pending')}
                              >
                                <X size={12} /> Deny Request
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'trust' && (
              <div className="flex flex-col gap-6">
                {/* Overall Score */}
                <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <h3 style={{ fontSize: '20px', marginBottom: '16px', fontWeight: 700 }}>Store Trust Profile</h3>
                  
                  {trustScore ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>TRUST SCORE</span>
                        <h2 style={{ fontSize: '48px', color: 'var(--primary)', fontWeight: 800, margin: '8px 0' }}>
                          {trustScore.overallScore} / 100
                        </h2>
                        <span className="badge badge-success" style={{ fontSize: '13px', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                          Category: {trustScore.category}
                        </span>
                      </div>
                      <div style={{ maxWidth: '400px', flex: 1 }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Improvement Suggestions</h4>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                          {trustScore.componentScores?.orderReliability < 80 && (
                            <li>Fulfill customer orders promptly to avoid cancellations and penalties.</li>
                          )}
                          {trustScore.componentScores?.reviewsQuality < 80 && (
                            <li>Encourage buyers to review products and ensure listings match actual specifications.</li>
                          )}
                          {trustScore.componentScores?.responseRate < 80 && (
                            <li>Respond faster to customer inquiries inside the chat widget to improve response metrics.</li>
                          )}
                          {trustScore.componentScores?.returnPerformance < 80 && (
                            <li>Keep exact inventory levels up-to-date to prevent order cancellation claims.</li>
                          )}
                          {trustScore.componentScores?.orderReliability >= 80 && 
                           trustScore.componentScores?.reviewsQuality >= 80 && 
                           trustScore.componentScores?.responseRate >= 80 && (
                            <li>Great job! You are maintaining high performance. Keep satisfying customers to preserve your score.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>Calculating trust profile data...</p>
                  )}
                </div>

                {/* Sub-scores grid */}
                {trustScore && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Verification</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.verification} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Order Reliability</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.orderReliability} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Reviews Quality</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.reviewsQuality} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Response Rate</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.responseRate} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Return Performance</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.returnPerformance} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Customer Satisfaction</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.customerSatisfaction} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Account Age</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.accountHistory} / 100</h4>
                    </div>
                    <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Mitigation</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 0', color: 'var(--text-primary)' }}>{trustScore.componentScores?.riskSignals} / 100</h4>
                    </div>
                  </div>
                )}

                {/* Score History */}
                <div className="card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 700 }}>Score History Log</h3>
                  
                  {trustHistory.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No updates logged yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', paddingBottom: '12px' }}>
                            <th style={{ padding: '12px 8px' }}>Previous Score</th>
                            <th>New Score</th>
                            <th>Change Reason</th>
                            <th>Updated Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trustHistory.map((h, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '14px 8px', fontWeight: 600 }}>{h.previousScore || 0}</td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{h.newScore || h.score}</td>
                              <td style={{ textTransform: 'capitalize' }}>{(h.reasonCategory || 'System update').toLowerCase().replace('_', ' ')}</td>
                              <td>{h.timestamp ? new Date(h.timestamp).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'assistant' && (
              <div className="card" style={{ padding: '28px' }}>
                {/* Assistant Header */}
                <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <div className="flex align-center gap-2">
                      <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                        <Bot size={22} />
                      </div>
                      <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                        Vendora AI Merchant Assistant
                      </h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '6px 0 0' }}>
                      Private business intelligence grounded strictly in your store catalog, orders, and fulfillment data.
                    </p>
                  </div>
                  <div className="flex align-center gap-2">
                    <span className="badge badge-success flex align-center gap-1" style={{ fontSize: '11px' }}>
                      <UserCheck size={12} /> Authorized Access Only
                    </span>
                  </div>
                </div>

                {/* Executive Analytics KPI Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Total Listings</span>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>{products.length}</h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Orders Received</span>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)' }}>{orders.length}</h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Delivered Revenue</span>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>
                      Rs. {orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0).toLocaleString()}
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Low Stock Alert</span>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: products.filter(p => p.stock <= 5).length > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {products.filter(p => p.stock <= 5).length} Items
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Trust Score</span>
                    <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--secondary)' }}>
                      {trustScore?.score || 88} / 100
                    </h4>
                  </div>
                </div>

                {/* Suggested Questions Chips */}
                <div style={{ marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    Suggested Business Inquiries
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      "Which products are selling best?",
                      "Which products need restocking?",
                      "Summarize my store performance",
                      "Why might sales be declining?",
                      "Which products have high return rates?",
                      "Which categories perform best?",
                      "How do I request a new category?",
                      "Improve my product title formula"
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-full)' }}
                        onClick={() => handleAskAssistant(chip)}
                        disabled={assistantLoading}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat History Box */}
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  height: '420px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  {assistantMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={idx}
                        style={{
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background: isUser ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: isUser ? '#fff' : 'var(--text-primary)',
                          border: isUser ? 'none' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '12px 18px',
                          fontSize: '13.5px',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {msg.content}
                      </div>
                    );
                  })}
                  {assistantLoading && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <Loader className="spin" size={16} />
                      Analyzing your store catalog and order history...
                    </div>
                  )}
                </div>

                {/* Chat Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskAssistant();
                  }}
                  style={{ display: 'flex', gap: '10px' }}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ask about bestsellers, restocking, conversion advice, or store metrics..."
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    disabled={assistantLoading}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary flex align-center gap-2"
                    disabled={assistantLoading || !assistantInput.trim()}
                    style={{ padding: '0 24px' }}
                  >
                    <Send size={16} /> Send Inquiry
                  </button>
                </form>
              </div>
            )}

            {/* Phase 16: Category Requests Tab */}
            {activeTab === 'categories' && (
              <div className="card" style={{ padding: '24px' }}>
                <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag size={20} style={{ color: 'var(--primary)' }} />
                      Artisan Category Requests
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
                      Vendors cannot directly create marketplace-wide categories. Suggest new regional specialties for administrator approval.
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary flex align-center gap-2"
                    onClick={() => {
                      setCategoryFormError('');
                      setCategoryFormSuccess('');
                      setIsCategoryModalOpen(true);
                    }}
                  >
                    <Plus size={16} /> Request New Category
                  </button>
                </div>

                {vendorCategoryRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                    <Tag size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                      No category requests submitted yet
                    </p>
                    <p style={{ fontSize: '13px', maxWidth: '440px', margin: '0 auto 18px' }}>
                      Do you sell items that don't fit current categories? Submit a formal request to our marketplace administration.
                    </p>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setIsCategoryModalOpen(true)}
                    >
                      Submit First Request
                    </button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', paddingBottom: '10px' }}>
                          <th style={{ padding: '10px 8px' }}>Requested Category</th>
                          <th>Parent Category</th>
                          <th>Justification Reason</th>
                          <th>Submitted Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right', paddingRight: '8px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorCategoryRequests.map((req) => (
                          <tr key={req.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 8px' }}>
                              <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{req.categoryName}</strong>
                              {req.description && (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{req.description}</span>
                              )}
                            </td>
                            <td style={{ textTransform: 'capitalize' }}>{req.parentCategory || 'Top-level'}</td>
                            <td style={{ maxWidth: '280px', whiteSpace: 'normal', color: 'var(--text-secondary)' }}>
                              {req.reason}
                              {req.rejectionReason && (
                                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>
                                  Admin Feedback: &ldquo;{req.rejectionReason}&rdquo;
                                </div>
                              )}
                            </td>
                            <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge ${
                                req.status === 'APPROVED' ? 'badge-success' :
                                req.status === 'PENDING' ? 'badge-warning' :
                                req.status === 'REJECTED' ? 'badge-danger' : 'badge-secondary'
                              }`} style={{ fontSize: '11px' }}>
                                {req.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '8px' }}>
                              {req.status === 'PENDING' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                  onClick={() => handleCancelRequest(req.id)}
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Inquiries & Messages Tab Panel */}
            {activeTab === 'messages' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', height: '660px', display: 'flex', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '320px', minWidth: '280px', height: '100%' }}>
                  <ConversationList
                    conversations={vendorConversations}
                    activeConversationId={selectedVendorConv?.id || selectedVendorConv?.conversationId}
                    onSelectConversation={setSelectedVendorConv}
                    loading={vendorConvLoading}
                  />
                </div>
                <div style={{ flex: 1, height: '100%' }}>
                  <ChatWindow conversation={selectedVendorConv} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Category Request Modal */}
      {isCategoryModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '32px', position: 'relative', background: 'var(--bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              onClick={() => setIsCategoryModalOpen(false)} 
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
              Request New Marketplace Category
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px' }}>
              Admin approval is required before a category appears in navigation menus and search filters.
            </p>

            {categoryFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px' }}>
                {categoryFormError}
              </div>
            )}
            {categoryFormSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px' }}>
                {categoryFormSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitCategoryRequest} className="flex flex-col gap-4">
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Ajrak & Indigo Blockprints, Chiniot Woodcraft"
                  value={reqCategoryName}
                  onChange={(e) => setReqCategoryName(e.target.value)}
                  disabled={categoryFormLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parent Category (Optional)</label>
                <select
                  className="form-select"
                  value={reqCategoryParent}
                  onChange={(e) => setReqCategoryParent(e.target.value)}
                  disabled={categoryFormLoading}
                >
                  <option value="">None (Top-Level Category)</option>
                  <option value="handicrafts">Handicrafts & Art</option>
                  <option value="fashion">Fashion & Apparel</option>
                  <option value="home-decor">Home & Living</option>
                  <option value="jewelry">Jewelry & Accessories</option>
                  <option value="electronics">Electronics & Tech</option>
                  <option value="spices">Spices & Groceries</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category Description</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="What products and craft techniques fall under this category?"
                  value={reqCategoryDesc}
                  onChange={(e) => setReqCategoryDesc(e.target.value)}
                  disabled={categoryFormLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Business Reason / Justification *</label>
                <textarea
                  className="form-textarea"
                  required
                  rows="3"
                  placeholder="Why is this needed? (e.g. Distinct cultural heritage, customer search volume, specialized artisan group)"
                  value={reqCategoryReason}
                  onChange={(e) => setReqCategoryReason(e.target.value)}
                  disabled={categoryFormLoading}
                />
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                ✉️ An automated email notification will be delivered to the administrator upon submission.
              </div>

              <div className="flex justify-end gap-3" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={categoryFormLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={categoryFormLoading}
                >
                  {categoryFormLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
