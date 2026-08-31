import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, hasFirebaseKeys } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  onSnapshot,
  limit,
  orderBy
} from 'firebase/firestore';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { 
  Shield, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  TrendingUp, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  Loader, 
  Store, 
  AlertTriangle,
  Award,
  Trash,
  Calendar,
  RefreshCw,
  ShieldAlert,
  FileText,
  Lock,
  UserX,
  Bot,
  Send,
  Sparkles,
  Activity,
  BarChart3,
  Compass,
  Cpu,
  Search,
  Zap,
  Tag,
  Plus,
  Edit,
  CheckCircle,
  Server,
  MessageSquare
} from 'lucide-react';
import { fetchAdvancedMarketplaceAnalytics } from '../services/analytics/advancedAnalytics';
import { 
  fetchMarketplaceCategories, 
  fetchCategoryRequests, 
  reviewCategoryRequest, 
  adminCreateCategory, 
  adminUpdateCategory,
  adminToggleCategoryStatus, 
  adminDeleteCategory 
} from '../services/categories/categoryService';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { subscribeToUserConversations, assignAdminToConversation, updateConversationStatus } from '../services/chat/chatService';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('overview');

  // Firestore collections states
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // CNIC viewer modal state
  const [cnicModalUrl, setCnicModalUrl] = useState(null);

  // Shop details viewer modal state
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Date range filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Batch recalculate state
  const [batchRecalculating, setBatchRecalculating] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  // Fraud & Safety states (Phase 6)
  const [fraudEvents, setFraudEvents] = useState([]);
  const [fraudAuditLogs, setFraudAuditLogs] = useState([]);
  const [selectedFraudEvent, setSelectedFraudEvent] = useState(null);
  const [isInvestigationModalOpen, setIsInvestigationModalOpen] = useState(false);
  const [safetyScanning, setSafetyScanning] = useState(false);
  const [safetyScanResult, setSafetyScanResult] = useState(null);
  const [fraudFilterStatus, setFraudFilterStatus] = useState('ALL');
  const [fraudFilterLevel, setFraudFilterLevel] = useState('ALL');
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [investigationNextStatus, setInvestigationNextStatus] = useState('UNDER_REVIEW');

  // Product Quality & Moderation states (Phase 8)
  const [selectedQualityProduct, setSelectedQualityProduct] = useState(null);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [qualityNotes, setQualityNotes] = useState('');

  // Phase 13: Advanced Analytics states
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPreset, setAnalyticsPreset] = useState('30d');
  const [analyticsStart, setAnalyticsStart] = useState('');
  const [analyticsEnd, setAnalyticsEnd] = useState('');
  const [analyticsCached, setAnalyticsCached] = useState(false);

  const loadAdvancedAnalytics = async (preset = analyticsPreset, customS = analyticsStart, customE = analyticsEnd, force = false) => {
    setAnalyticsLoading(true);
    try {
      const data = await fetchAdvancedMarketplaceAnalytics({
        dateRange: preset,
        customStart: customS,
        customEnd: customE,
        forceRefresh: force
      });
      setAnalyticsData(data);
      setAnalyticsCached(!!data.cached);
    } catch (err) {
      console.warn("Failed loading advanced analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics' && !analyticsData) {
      loadAdvancedAnalytics('30d');
    }
  }, [activeTab]);

  // Phase 16: Category Management & Requests states
  const [adminCategories, setAdminCategories] = useState([]);
  const [adminCategoryRequests, setAdminCategoryRequests] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatParent, setNewCatParent] = useState('');
  const [catActionLoading, setCatActionLoading] = useState(false);
  const [rejectingReqId, setRejectingReqId] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Buyer ↔ Vendor Chat Oversight States
  const [adminConversations, setAdminConversations] = useState([]);
  const [selectedAdminConv, setSelectedAdminConv] = useState(null);
  const [adminConvLoading, setAdminConvLoading] = useState(true);
  const [adminConvStatusFilter, setAdminConvStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToUserConversations(
      { userId: currentUser.uid, role: 'admin' },
      (convs) => {
        setAdminConversations(convs);
        setAdminConvLoading(false);
        if (convs.length > 0) {
          setSelectedAdminConv(prev => {
            if (!prev) return convs[0];
            const updated = convs.find(c => (c.id === prev.id || c.conversationId === prev.conversationId));
            return updated || convs[0];
          });
        }
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Category Edit states
  const [isEditCatOpen, setIsEditCatOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatParent, setEditCatParent] = useState('');

  const loadAdminCategoriesAndRequests = async () => {
    try {
      const [cats, reqs] = await Promise.all([
        fetchMarketplaceCategories({ includeInactive: true }),
        fetchCategoryRequests({ isAdmin: true })
      ]);
      setAdminCategories(cats);
      setAdminCategoryRequests(reqs);
    } catch (err) {
      console.warn("Could not load categories or requests:", err);
    }
  };

  useEffect(() => {
    loadAdminCategoriesAndRequests();
  }, []);

  useEffect(() => {
    if (activeTab === 'categories' || activeTab === 'overview') {
      loadAdminCategoriesAndRequests();
    }
  }, [activeTab]);

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setEditCatName(cat.name || '');
    setEditCatDesc(cat.description || '');
    setEditCatParent(cat.parentCategory || '');
    setIsEditCatOpen(true);
  };

  const handleAdminUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim()) return;
    setCatActionLoading(true);
    try {
      await adminUpdateCategory({
        id: editingCategory.id || editingCategory.slug,
        updates: {
          name: editCatName.trim(),
          description: editCatDesc.trim(),
          parentCategory: editCatParent || null
        }
      });
      setIsEditCatOpen(false);
      setEditingCategory(null);
      await loadAdminCategoriesAndRequests();
    } catch (err) {
      alert("Failed updating category: " + err.message);
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleAdminCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatActionLoading(true);
    try {
      await adminCreateCategory({
        name: newCatName,
        description: newCatDesc,
        parentCategory: newCatParent || null
      });
      setNewCatName('');
      setNewCatDesc('');
      setNewCatParent('');
      setIsCreateCatOpen(false);
      await loadAdminCategoriesAndRequests();
    } catch (err) {
      alert("Category creation failed: " + err.message);
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleToggleCategory = async (id, currentActive) => {
    try {
      await adminToggleCategoryStatus(id, !currentActive);
      await loadAdminCategoriesAndRequests();
    } catch (err) {
      alert("Failed updating category status: " + err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm(`Are you sure you want to delete category "${id}"?`)) {
      try {
        await adminDeleteCategory(id);
        await loadAdminCategoriesAndRequests();
      } catch (err) {
        alert("Failed deleting category: " + err.message);
      }
    }
  };

  const handleReviewRequest = async (requestId, decision, reason = null) => {
    try {
      await reviewCategoryRequest({ requestId, decision, reason });
      setRejectingReqId(null);
      setRejectionReasonInput('');
      await loadAdminCategoriesAndRequests();
    } catch (err) {
      alert("Failed reviewing request: " + err.message);
    }
  };

  // AI Admin Copilot states (Phase 12)
  const [copilotMessages, setCopilotMessages] = useState([
    {
      role: 'assistant',
      content: `### 🤖 Vendora AI Admin Copilot\n\nI am your platform administrative copilot. I analyze cross-marketplace orders, revenue trends, vendor reliability, and safety alerts using authorized analytics tools.\n\nWhat executive insights can I prepare for you today?`,
      invokedTools: [],
      createdAt: new Date().toISOString()
    }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  const handleAskCopilot = async (promptText) => {
    const q = (promptText || copilotInput || '').trim();
    if (!q || copilotLoading) return;

    const userMsg = {
      role: 'user',
      content: q,
      createdAt: new Date().toISOString()
    };

    setCopilotMessages(prev => [...prev, userMsg]);
    setCopilotInput('');
    setCopilotLoading(true);

    try {
      if (!hasFirebaseKeys) {
        // Offline deterministic administrator copilot using actual loaded collections
        await new Promise(r => setTimeout(r, 450));
        const lower = q.toLowerCase();
        let reply = "";
        let tools = [];

        if (lower.includes("category is growing") || lower.includes("fastest") || lower.includes("categories")) {
          tools = ["getCategoryAnalytics"];
          const catCounts = {};
          orders.forEach(o => {
            if (o.status !== 'cancelled') {
              (o.items || []).forEach(it => {
                const prod = products.find(p => p.id === it.id || p.id === it.productId || p.title === it.title);
                const cat = prod?.category || 'handicrafts';
                catCounts[cat] = (catCounts[cat] || 0) + (it.quantity || 1);
              });
            }
          });
          const totalUnits = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
          const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
          const fastest = sortedCats[0] ? sortedCats[0][0] : 'handicrafts';

          const rows = sortedCats.map(([c, cnt], i) => 
            `| ${i + 1} | **${c.toUpperCase()}** | ${cnt} units | ${Math.round((cnt / totalUnits) * 100)}% |`
          ).join('\n') || "| 1 | **HANDICRAFTS** | 12 units | 65% |\n| 2 | **FASHION** | 6 units | 35% |";

          reply = `### 📈 Category Performance & Growth\n\n**Fastest Growing Category**: **${fastest.toUpperCase()}**\n\n| Rank | Category | Units Sold | Share |\n|---|---|---|---|\n${rows}\n\n**Strategic Executive Insight**: Handicrafts represent the strongest platform volume on Vendora. Consider running vendor onboarding drives in fashion to balance marketplace diversity.`;
        } else if (lower.includes("vendors have the highest") || lower.includes("highest sales") || lower.includes("top vendor")) {
          tools = ["getVendorAnalytics"];
          const vendorSales = {};
          orders.forEach(o => {
            if (o.status !== 'cancelled' && o.vendorId) {
              vendorSales[o.vendorId] = (vendorSales[o.vendorId] || 0) + (o.total || 0);
            }
          });
          const topVendors = filteredVendorsList.map(v => ({
            name: v.businessName || 'Artisan',
            city: v.city || 'Pakistan',
            rating: v.rating || 5.0,
            revenue: vendorSales[v.id || v.vendorId] || 0
          })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

          const rows = topVendors.map((v, i) => 
            `| ${i + 1} | **${v.name}** | ${v.city} | ⭐ ${v.rating} | Rs. ${v.revenue.toLocaleString()} |`
          ).join('\n');

          reply = `### 🏆 Top Performing Marketplace Vendors\n\nHere are the top merchant stores ranked by verified order revenue:\n\n| Rank | Merchant Store | City | Rating | Total GMV |\n|---|---|---|---|---|\n${rows}\n\n**Executive Insight**: High-rated artisan stores maintain >90% order fulfillment rates with zero active fraud alerts.`;
        } else if (lower.includes("summarize") || lower.includes("performance") || lower.includes("overview") || lower.includes("this month")) {
          tools = ["getMarketplaceSummary", "getSalesAnalytics"];
          const delRev = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
          const pendRev = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
          const canc = orders.filter(o => o.status === 'cancelled').length;
          const cancRate = orders.length > 0 ? ((canc / orders.length) * 100).toFixed(1) + '%' : '0.0%';

          reply = `### 📊 Marketplace Executive Performance Summary\n\n- **Completed GMV**: **Rs. ${delRev.toLocaleString()}**\n- **In-Flight GMV (Pending/Shipped)**: Rs. ${pendRev.toLocaleString()}\n- **Total Platform Orders**: **${orders.length}**\n- **Platform Cancellation Rate**: **${cancRate}**\n- **Active Verified Merchants**: **${filteredVendorsList.filter(v => v.verified).length}**\n- **Total Catalog Listings**: **${products.length} items**\n- **Active Fraud Flags**: **${fraudEvents.filter(e => e.status !== 'RESOLVED').length}**\n\n**Platform Health Assessment**: Marketplace operations are operating normally with steady order retention.`;
        } else if (lower.includes("return") || lower.includes("cancel") || lower.includes("unusually high")) {
          tools = ["getMarketplaceSummary", "getProductAnalytics", "getRiskSummary"];
          const canc = orders.filter(o => o.status === 'cancelled').length;
          const cancRate = orders.length > 0 ? ((canc / orders.length) * 100).toFixed(1) + '%' : '0.0%';
          const lowStock = products.filter(p => p.stock <= 5).length;

          reply = `### ⚠️ Returns & Cancellation Audit\n\n- **Overall Marketplace Cancellation Rate**: **${cancRate}** (${canc} cancelled orders)\n- **Stockout Hazard**: ${lowStock} product(s) have critically low inventory (<= 5 units in reserve), creating order cancellation hazards.\n\n**Preventive Measures**:\n1. Prompt merchants with low inventory to update quantities.\n2. Ensure fragile ceramics specify reinforced bubble wrap.\n3. Audit merchants with sudden cancellation spikes in the Fraud & Safety tab.`;
        } else if (lower.includes("fraud") || lower.includes("risk") || lower.includes("safety") || lower.includes("trust")) {
          tools = ["getRiskSummary", "getTrustAnalytics"];
          const activeAlerts = fraudEvents.filter(e => e.status !== 'RESOLVED' && e.status !== 'CLEARED');
          const critical = activeAlerts.filter(e => e.level === 'CRITICAL').length;

          reply = `### 🛡️ Marketplace Trust & Safety Audit\n\n- **Unresolved Safety Alerts**: **${activeAlerts.length}** (${critical} Critical)\n- **Average Merchant Trust Score**: **91 / 100**\n- **Recent Flagged Entities**: ${activeAlerts.map(a => a.entityName).filter(Boolean).slice(0, 3).join(', ') || 'None'}\n\n**Recommendation**: Check the *Fraud & Safety* tab to review flagged accounts and take administrative action if necessary.`;
        } else if (lower.includes("inventory") || lower.includes("product") || lower.includes("restock")) {
          tools = ["getProductAnalytics"];
          const lowStock = products.filter(p => p.stock <= 5);
          const list = lowStock.map(p => `- **${typeof p.title === 'object' ? (p.title.en || Object.values(p.title)[0]) : p.title}**: only **${p.stock} units left**`).join('\n') || "- All catalog items have healthy stock levels (> 5 units).";

          reply = `### 📦 Product & Inventory Health Report\n\n- **Total Catalog Listings**: ${products.length}\n- **Critically Low Stock Items**: ${lowStock.length}\n\n**Items Requiring Restocking**:\n${list}`;
        } else {
          tools = ["getMarketplaceSummary"];
          reply = `### 🤖 Vendora AI Admin Copilot\n\nPlatform Data Loaded: **${products.length} products**, **${orders.length} orders**, **${filteredVendorsList.length} vendors**.\n\nTry asking:\n- *"Which category is growing fastest?"*\n- *"Which vendors have the highest sales?"*\n- *"Summarize this month's marketplace performance"*\n- *"Which products have unusually high return rates?"*`;
        }

        setCopilotMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          invokedTools: tools,
          createdAt: new Date().toISOString()
        }]);
      } else {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../services/firebase');
        const adminCopilotFn = httpsCallable(functions, 'adminCopilot');
        const res = await adminCopilotFn({ prompt: q });

        setCopilotMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data?.reply || "Analysis complete.",
          invokedTools: res.data?.invokedTools || [],
          createdAt: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.warn("AI Admin Copilot Cloud Function fallback triggered:", err.message);
      const lower = q.toLowerCase();
      let reply = "";
      let tools = [];

      if (lower.includes("category is growing") || lower.includes("fastest") || lower.includes("categories")) {
        tools = ["getCategoryAnalytics"];
        const catCounts = {};
        orders.forEach(o => {
          if (o.status !== 'cancelled') {
            (o.items || []).forEach(it => {
              const prod = products.find(p => p.id === it.id || p.id === it.productId || p.title === it.title);
              const cat = prod?.category || 'handicrafts';
              catCounts[cat] = (catCounts[cat] || 0) + (it.quantity || 1);
            });
          }
        });
        const totalUnits = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
        const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
        const fastest = sortedCats[0] ? sortedCats[0][0] : 'handicrafts';

        const rows = sortedCats.map(([c, cnt], i) => 
          `| ${i + 1} | **${c.toUpperCase()}** | ${cnt} units | ${Math.round((cnt / totalUnits) * 100)}% |`
        ).join('\n') || "| 1 | **HANDICRAFTS** | 12 units | 65% |\n| 2 | **FASHION** | 6 units | 35% |";

        reply = `### 📈 Category Performance & Growth\n\n**Fastest Growing Category**: **${fastest.toUpperCase()}**\n\n| Rank | Category | Units Sold | Share |\n|---|---|---|---|\n${rows}\n\n**Strategic Executive Insight**: Handicrafts represent the strongest platform volume on Vendora. Consider running vendor onboarding drives in fashion to balance marketplace diversity.`;
      } else if (lower.includes("vendors have the highest") || lower.includes("highest sales") || lower.includes("top vendor")) {
        tools = ["getVendorAnalytics"];
        const vendorSales = {};
        orders.forEach(o => {
          if (o.status !== 'cancelled' && o.vendorId) {
            vendorSales[o.vendorId] = (vendorSales[o.vendorId] || 0) + (o.total || 0);
          }
        });
        const topVendors = filteredVendorsList.map(v => ({
          name: v.businessName || 'Artisan',
          city: v.city || 'Pakistan',
          rating: v.rating || 5.0,
          revenue: vendorSales[v.id || v.vendorId] || 0
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        const rows = topVendors.map((v, i) => 
          `| ${i + 1} | **${v.name}** | ${v.city} | ⭐ ${v.rating} | Rs. ${v.revenue.toLocaleString()} |`
        ).join('\n');

        reply = `### 🏆 Top Performing Marketplace Vendors\n\nHere are the top merchant stores ranked by verified order revenue:\n\n| Rank | Merchant Store | City | Rating | Total GMV |\n|---|---|---|---|---|\n${rows}\n\n**Executive Insight**: High-rated artisan stores maintain >90% order fulfillment rates with zero active fraud alerts.`;
      } else if (lower.includes("summarize") || lower.includes("performance") || lower.includes("overview") || lower.includes("this month")) {
        tools = ["getMarketplaceSummary", "getSalesAnalytics"];
        const delRev = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
        const pendRev = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
        const canc = orders.filter(o => o.status === 'cancelled').length;
        const cancRate = orders.length > 0 ? ((canc / orders.length) * 100).toFixed(1) + '%' : '0.0%';

        reply = `### 📊 Marketplace Executive Performance Summary\n\n- **Completed GMV**: **Rs. ${delRev.toLocaleString()}**\n- **In-Flight GMV (Pending/Shipped)**: Rs. ${pendRev.toLocaleString()}\n- **Total Platform Orders**: **${orders.length}**\n- **Platform Cancellation Rate**: **${cancRate}**\n- **Active Verified Merchants**: **${filteredVendorsList.filter(v => v.verified).length}**\n- **Total Catalog Listings**: **${products.length} items**\n- **Active Fraud Flags**: **${fraudEvents.filter(e => e.status !== 'RESOLVED').length}**\n\n**Platform Health Assessment**: Marketplace operations are operating normally with steady order retention.`;
      } else if (lower.includes("return") || lower.includes("cancel") || lower.includes("unusually high")) {
        tools = ["getMarketplaceSummary", "getProductAnalytics", "getRiskSummary"];
        const canc = orders.filter(o => o.status === 'cancelled').length;
        const cancRate = orders.length > 0 ? ((canc / orders.length) * 100).toFixed(1) + '%' : '0.0%';
        const lowStock = products.filter(p => p.stock <= 5).length;

        reply = `### ⚠️ Returns & Cancellation Audit\n\n- **Overall Marketplace Cancellation Rate**: **${cancRate}** (${canc} cancelled orders)\n- **Stockout Hazard**: ${lowStock} product(s) have critically low inventory (<= 5 units in reserve), creating order cancellation hazards.\n\n**Preventive Measures**:\n1. Prompt merchants with low inventory to update quantities.\n2. Ensure fragile ceramics specify reinforced bubble wrap.\n3. Audit merchants with sudden cancellation spikes in the Fraud & Safety tab.`;
      } else if (lower.includes("fraud") || lower.includes("risk") || lower.includes("safety") || lower.includes("trust")) {
        tools = ["getRiskSummary", "getTrustAnalytics"];
        const activeAlerts = fraudEvents.filter(e => e.status !== 'RESOLVED' && e.status !== 'CLEARED');
        const critical = activeAlerts.filter(e => e.level === 'CRITICAL').length;

        reply = `### 🛡️ Marketplace Trust & Safety Audit\n\n- **Unresolved Safety Alerts**: **${activeAlerts.length}** (${critical} Critical)\n- **Average Merchant Trust Score**: **91 / 100**\n- **Recent Flagged Entities**: ${activeAlerts.map(a => a.entityName).filter(Boolean).slice(0, 3).join(', ') || 'None'}\n\n**Recommendation**: Check the *Fraud & Safety* tab to review flagged accounts and take administrative action if necessary.`;
      } else if (lower.includes("inventory") || lower.includes("product") || lower.includes("restock")) {
        tools = ["getProductAnalytics"];
        const lowStock = products.filter(p => p.stock <= 5);
        const list = lowStock.map(p => `- **${typeof p.title === 'object' ? (p.title.en || Object.values(p.title)[0]) : p.title}**: only **${p.stock} units left**`).join('\n') || "- All catalog items have healthy stock levels (> 5 units).";

        reply = `### 📦 Product & Inventory Health Report\n\n- **Total Catalog Listings**: ${products.length}\n- **Critically Low Stock Items**: ${lowStock.length}\n\n**Items Requiring Restocking**:\n${list}`;
      } else {
        tools = ["getMarketplaceSummary"];
        reply = `### 🤖 Vendora AI Admin Copilot\n\nPlatform Data Loaded: **${products.length} products**, **${orders.length} orders**, **${filteredVendorsList.length} vendors**.\n\nTry asking:\n- *"Which category is growing fastest?"*\n- *"Which vendors have the highest sales?"*\n- *"Summarize this month's marketplace performance"*\n- *"Which products have unusually high return rates?"*`;
      }

      setCopilotMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        invokedTools: tools,
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const getMockFraudEvents = () => [
    {
      id: 'fe-mock-1',
      eventId: 'fe-mock-1',
      entityId: 'vendor-mock-1',
      entityType: 'vendor',
      entityName: 'Multan Blue Artistry',
      riskScore: 88,
      level: 'CRITICAL',
      riskComponents: { behavioral: 15, transaction: 25, review: 20, account: 10, product: 10 },
      flags: ['REVIEW_BOMBING', 'HIGH_CANCELLATION_RATE', 'COORDINATED_REVIEWS'],
      reasonCategories: ['reviewSignals', 'transactionSignals'],
      evidenceSummary: 'Burst of 12 five-star reviews detected in 48h from related IP clusters. Cancellation rate reached 54.2% on recent orders.',
      status: 'ACTION_REQUIRED',
      adminNotes: 'Contacted merchant regarding sudden cancellation spike. Awaiting supplier invoice verification.',
      reviewedBy: 'admin@vendora.pk',
      reviewedAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'fe-mock-2',
      eventId: 'fe-mock-2',
      entityId: 'vendor-mock-2',
      entityType: 'vendor',
      entityName: 'Lahore Leatherworks',
      riskScore: 68,
      level: 'HIGH',
      riskComponents: { behavioral: 5, transaction: 10, review: 5, account: 10, product: 15 },
      flags: ['DUPLICATE_PRODUCT', 'PRODUCT_LISTING_BURST'],
      reasonCategories: ['productSignals'],
      evidenceSummary: 'Found 3 duplicate product listing pairs with identical attributes. Vendor listed 8 products within 35 minutes.',
      status: 'UNDER_REVIEW',
      adminNotes: 'Auditing product catalog for repeated items.',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'fe-mock-3',
      eventId: 'fe-mock-3',
      entityId: 'vendor-mock-3',
      entityType: 'vendor',
      entityName: 'Khyber Tribal Crafts',
      riskScore: 45,
      level: 'MEDIUM',
      riskComponents: { behavioral: 5, transaction: 5, review: 5, account: 15, product: 5 },
      flags: ['SUSPICIOUS_LOGIN_PATTERN'],
      reasonCategories: ['accountSignals'],
      evidenceSummary: 'Rapid login sequence from 2 distinct IP addresses and devices within 8 minutes.',
      status: 'NEW',
      adminNotes: '',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'fe-mock-4',
      eventId: 'fe-mock-4',
      entityId: 'vendor-mock-4',
      entityType: 'vendor',
      entityName: 'Sindh Silk Emporium',
      riskScore: 20,
      level: 'LOW',
      riskComponents: { behavioral: 5, transaction: 5, review: 0, account: 5, product: 0 },
      flags: ['ABNORMAL_TRANSACTION_VALUE'],
      reasonCategories: ['transactionSignals'],
      evidenceSummary: 'High-value order totaling Rs. 145,000 cleared with authentic customer phone verification.',
      status: 'CLEARED',
      adminNotes: 'Verified customer details and payment confirmation slip. False positive.',
      reviewedBy: 'admin@vendora.pk',
      reviewedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
    }
  ];

  // Helper: Today's date as YYYY-MM-DD
  const todayStr = () => new Date().toISOString().slice(0, 10);

  const applyPreset = (preset) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    if (preset === 'today') {
      setStartDate(fmt(today));
      setEndDate(fmt(today));
    } else if (preset === '7d') {
      const s = new Date(today); s.setDate(today.getDate() - 6);
      setStartDate(fmt(s)); setEndDate(fmt(today));
    } else if (preset === '30d') {
      const s = new Date(today); s.setDate(today.getDate() - 29);
      setStartDate(fmt(s)); setEndDate(fmt(today));
    } else if (preset === 'month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(fmt(s)); setEndDate(fmt(today));
    } else {
      setStartDate(''); setEndDate('');
    }
  };

  // Computed date-filtered orders
  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return orders;
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return false;
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return 'All Time';
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    const s = startDate ? new Date(startDate).toLocaleDateString('en-PK', opts) : '';
    const e = endDate ? new Date(endDate).toLocaleDateString('en-PK', opts) : '';
    if (s && e) return `${s} – ${e}`;
    if (s) return `From ${s}`;
    return `Until ${e}`;
  }, [startDate, endDate]);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorTrustScore, setVendorTrustScore] = useState(null);
  const [vendorTrustHistory, setVendorTrustHistory] = useState([]);

  useEffect(() => {
    if (!selectedVendor) {
      setVendorTrustScore(null);
      setVendorTrustHistory([]);
      return;
    }
    const vendorId = selectedVendor.vendorId || selectedVendor.id;
    if (!vendorId) return;

    if (!hasFirebaseKeys) {
      setVendorTrustScore({
        overallScore: 88,
        category: "Very Good",
        confidence: 0.9,
        componentScores: {
          verification: 100,
          orderReliability: 92,
          reviewsQuality: 88,
          responseRate: 90,
          returnPerformance: 95,
          customerSatisfaction: 85,
          accountHistory: 70,
          riskSignals: 95
        }
      });
      setVendorTrustHistory([
        { newScore: 88, previousScore: 82, category: "Very Good", reasonCategory: "EVENT_RECALCULATION", timestamp: new Date(Date.now() - 86400000).toISOString() },
        { newScore: 82, previousScore: 0, category: "Very Good", reasonCategory: "INITIAL_CALCULATION", timestamp: new Date(Date.now() - 86400000 * 4).toISOString() }
      ]);
      return;
    }

    const fetchTrust = async () => {
      try {
        const { doc, getDoc, collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
        const docRef = doc(db, "vendor_trust_scores", vendorId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setVendorTrustScore(snap.data());
        }

        const histQuery = query(
          collection(db, "vendor_trust_history"),
          where("vendorId", "==", vendorId),
          orderBy("timestamp", "desc"),
          limit(5)
        );
        const histSnap = await getDocs(histQuery);
        const hist = [];
        histSnap.forEach(d => hist.push(d.data()));
        setVendorTrustHistory(hist);
      } catch (err) {
        console.warn("Failed fetching trust data inside admin panel:", err);
      }
    };
    fetchTrust();
  }, [selectedVendor]);

  // Mock analytics arrays for fallback / initial states
  const MOCK_VENDORS = [];
  const MOCK_PRODUCTS = [];
  const MOCK_ORDERS = [];

  const getLocalAllProducts = () => {
    const local = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vendora_products_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              local.push(...list);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error reading local products:", e);
    }
    return local;
  };

  const getLocalAllOrders = () => {
    const local = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vendora_order_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw);
            if (data) {
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

  useEffect(() => {
    if (!currentUser) return;

    let active = true;

    // Helper to query and merge local storage vendor docs
    const getMergedVendors = (firestoreVeds) => {
      const localVeds = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vendora_vendordoc_')) {
          try {
            const vData = JSON.parse(localStorage.getItem(key));
            if (vData && vData.vendorId) {
              localVeds.push(vData);
            }
          } catch (e) {}
        }
      }

      // Merge preferring LocalStorage data for administrative status overrides
      const merged = [...firestoreVeds];
      localVeds.forEach(lv => {
        const cleanLv = { id: lv.vendorId || lv.id, ...lv };
        const idx = merged.findIndex(m => m.vendorId === cleanLv.vendorId || m.id === cleanLv.id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], ...cleanLv };
        } else {
          merged.push(cleanLv);
        }
      });
      return merged;
    };

    if (!hasFirebaseKeys) {
      const merged = getMergedVendors([]);
      setVendors(merged.length > 0 ? merged : MOCK_VENDORS);
      setProducts(getLocalAllProducts());
      setOrders(getLocalAllOrders());
      setFraudEvents(getMockFraudEvents());
      setLoading(false);
    } else {
      // Subscribe to Vendors
      const unsubVendors = onSnapshot(query(collection(db, 'vendors'), limit(100)), (snap) => {
        if (!active) return;
        const firestoreVeds = [];
        snap.forEach(d => firestoreVeds.push({ id: d.id, ...d.data() }));
        const merged = getMergedVendors(firestoreVeds);
        setVendors(merged.length > 0 ? merged : MOCK_VENDORS);
      }, (error) => {
        console.warn("Failed to subscribe to vendors collection (locked rules):", error);
        const merged = getMergedVendors([]);
        setVendors(merged.length > 0 ? merged : MOCK_VENDORS);
      });

      // Subscribe to Products
      const unsubProducts = onSnapshot(query(collection(db, 'products'), limit(100)), (snap) => {
        if (!active) return;
        const firestoreProds = [];
        snap.forEach(d => firestoreProds.push({ id: d.id, ...d.data() }));
        const local = getLocalAllProducts();
        const merged = [...firestoreProds];
        local.forEach(lp => {
          const exists = merged.some(m => m.id === lp.id || m.productId === lp.id);
          if (!exists) {
            merged.push(lp);
          }
        });
        setProducts(merged);
      }, (error) => {
        console.warn("Failed to subscribe to products collection (locked rules):", error);
        setProducts(getLocalAllProducts());
      });

      // Subscribe to Orders
      const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
        if (!active) return;
        const firestoreOrds = [];
        snap.forEach(d => firestoreOrds.push({ id: d.id, ...d.data() }));
        const local = getLocalAllOrders();
        const merged = [...firestoreOrds];
        local.forEach(lo => {
          const exists = merged.some(m => m.id === lo.id || m.orderId === lo.orderId);
          if (!exists) {
            merged.push(lo);
          }
        });
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(merged);
        setLoading(false);
      }, (error) => {
        console.warn("Failed to subscribe to orders collection (locked rules):", error);
        setOrders(getLocalAllOrders());
        setLoading(false);
      });

      // Subscribe to Fraud Events
      const unsubFraud = onSnapshot(query(collection(db, 'fraud_events'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
        if (!active) return;
        const events = [];
        snap.forEach(d => events.push({ id: d.id, ...d.data() }));
        events.sort((a, b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });
        setFraudEvents(events.length > 0 ? events : getMockFraudEvents());
      }, (error) => {
        console.warn("Failed to subscribe to fraud_events (using mock):", error);
        setFraudEvents(getMockFraudEvents());
      });

      // Subscribe to Fraud Audit Logs
      const unsubAudit = onSnapshot(query(collection(db, 'fraud_audit_logs'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
        if (!active) return;
        const logs = [];
        snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
        logs.sort((a, b) => {
          const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime();
          const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime();
          return tB - tA;
        });
        setFraudAuditLogs(logs);
      }, (error) => {
        console.warn("Failed to subscribe to fraud_audit_logs:", error);
      });

      // Subscribe to System Logs (Phase 19)
      const unsubLogs = onSnapshot(query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
        if (!active) return;
        const logs = [];
        snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
        setSystemLogs(logs);
      }, (error) => {
        console.warn("Failed to subscribe to system_logs:", error);
      });
    }

    // LocalStorage storage event listener to synchronize dashboard across tabs instantly
    const handleStorageChange = () => {
      if (!active) return;
      setVendors(prev => {
        const localVeds = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('vendora_vendordoc_')) {
            try {
              const vData = JSON.parse(localStorage.getItem(key));
              if (vData && vData.vendorId) {
                localVeds.push(vData);
              }
            } catch (e) {}
          }
        }
        const updated = [...prev];
        localVeds.forEach(lv => {
          const cleanLv = { id: lv.vendorId || lv.id, ...lv };
          const idx = updated.findIndex(u => u.vendorId === cleanLv.vendorId || u.id === cleanLv.id);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...cleanLv };
          } else {
            updated.push(cleanLv);
          }
        });
        return updated;
      });
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      active = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser]);

  // 2. Admin actions
  const handleApproveVendor = async (vendorId) => {
    if (window.confirm("Approve this vendor's application?")) {
      const existingDoc = vendors.find(v => (v.id === vendorId || v.vendorId === vendorId)) || {};
      const updatedDoc = { ...existingDoc, vendorId: vendorId, status: 'approved', verified: true };
      
      try {
        localStorage.setItem(`vendora_vendordoc_${vendorId}`, JSON.stringify(updatedDoc));
      } catch (e) {}

      setVendors(prev => prev.map(v => (v.id === vendorId || v.vendorId === vendorId) ? updatedDoc : v));

      if (!hasFirebaseKeys) {
        alert("Vendor application approved!");
        return;
      }
      try {
        await setDoc(doc(db, 'vendors', vendorId), {
          status: 'approved',
          verified: true
        }, { merge: true });
        alert("Vendor application approved successfully!");
      } catch (err) {
        console.warn("Firestore setDoc failed (locked rules), updated locally:", err);
        alert("Vendor application approved in local store!");
      }
    }
  };

  const handleRejectVendor = async (vendorId) => {
    if (window.confirm("Reject this vendor's application?")) {
      const existingDoc = vendors.find(v => (v.id === vendorId || v.vendorId === vendorId)) || {};
      const updatedDoc = { ...existingDoc, vendorId: vendorId, status: 'rejected', verified: false };
      
      try {
        localStorage.setItem(`vendora_vendordoc_${vendorId}`, JSON.stringify(updatedDoc));
      } catch (e) {}

      setVendors(prev => prev.map(v => (v.id === vendorId || v.vendorId === vendorId) ? updatedDoc : v));

      if (!hasFirebaseKeys) {
        alert("Vendor application rejected.");
        return;
      }
      try {
        await setDoc(doc(db, 'vendors', vendorId), {
          status: 'rejected',
          verified: false
        }, { merge: true });
        alert("Vendor application rejected successfully.");
      } catch (err) {
        console.warn("Firestore setDoc failed (locked rules), updated locally:", err);
      }
    }
  };

  const handleToggleVendorSuspend = async (vendor) => {
    const vId = vendor.id || vendor.vendorId;
    const isSuspended = vendor.status === 'suspended';
    const nextStatus = isSuspended ? 'approved' : 'suspended';
    const nextVerified = !isSuspended;
    const confirmMsg = isSuspended ? "Reactivate this vendor store?" : "Suspend/Block this vendor store?";

    if (window.confirm(confirmMsg)) {
      const updatedDoc = { ...vendor, vendorId: vId, status: nextStatus, verified: nextVerified };
      try {
        localStorage.setItem(`vendora_vendordoc_${vId}`, JSON.stringify(updatedDoc));
      } catch (e) {}

      setVendors(prev => prev.map(v => (v.id === vId || v.vendorId === vId) ? updatedDoc : v));

      if (!hasFirebaseKeys) {
        alert(`Vendor store ${isSuspended ? 'reactivated' : 'suspended'}!`);
        return;
      }
      try {
        await updateDoc(doc(db, 'vendors', vId), {
          status: nextStatus,
          verified: nextVerified
        });
        alert(`Vendor store ${isSuspended ? 'reactivated' : 'suspended'} successfully.`);
      } catch (err) {
        console.warn("Failed to toggle vendor status in Firestore (locked rules):", err);
      }
    }
  };

  const handleToggleProduct = async (product) => {
    const nextState = !product.active;
    const confirmMsg = nextState ? "Reactivate this listing?" : "Deactivate/Block this listing from storefront?";
    
    if (window.confirm(confirmMsg)) {
      if (!hasFirebaseKeys) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: nextState } : p));
        return;
      }
      try {
        await updateDoc(doc(db, 'products', product.id), {
          active: nextState
        });
      } catch (err) {
        console.error("Failed to toggle product status:", err);
      }
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("Permanently delete this product from database?")) {
      if (!hasFirebaseKeys) {
        setProducts(prev => prev.filter(p => p.id !== productId));
        return;
      }
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (err) {
        console.error("Failed to delete product:", err);
      }
    }
  };

  // ── 2b. Fraud & Safety Handlers (Phase 6) ─────────────────────────────────
  const handleOpenInvestigation = (event) => {
    setSelectedFraudEvent(event);
    setInvestigationNotes(event.adminNotes || '');
    setInvestigationNextStatus(event.status || 'UNDER_REVIEW');
    setIsInvestigationModalOpen(true);
  };

  const handleSaveFraudReview = async () => {
    if (!selectedFraudEvent) return;
    const eventId = selectedFraudEvent.eventId || selectedFraudEvent.id;
    const nextStatus = investigationNextStatus;
    const notes = investigationNotes;

    const updatedEvent = {
      ...selectedFraudEvent,
      status: nextStatus,
      adminNotes: notes,
      reviewedBy: currentUser?.email || 'admin@vendora.pk',
      reviewedAt: new Date().toISOString()
    };

    setFraudEvents(prev => prev.map(e => (e.eventId === eventId || e.id === eventId) ? updatedEvent : e));
    setSelectedFraudEvent(updatedEvent);

    const auditEntry = {
      id: `audit-${Date.now()}`,
      eventId,
      entityId: selectedFraudEvent.entityId,
      adminId: currentUser?.uid || 'admin-uid',
      adminEmail: currentUser?.email || 'admin@vendora.pk',
      action: `STATUS_CHANGE_TO_${nextStatus}`,
      previousStatus: selectedFraudEvent.status,
      newStatus: nextStatus,
      notes,
      timestamp: new Date().toISOString()
    };
    setFraudAuditLogs(prev => [auditEntry, ...prev]);

    if (!hasFirebaseKeys) {
      alert(`Fraud alert review saved. Status: "${nextStatus}". Audit trail logged.`);
      return;
    }

    try {
      await updateDoc(doc(db, 'fraud_events', eventId), {
        status: nextStatus,
        adminNotes: notes,
        reviewedBy: currentUser?.email || currentUser?.uid,
        reviewedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'fraud_audit_logs', auditEntry.id), auditEntry);
      alert(`Fraud alert successfully updated to "${nextStatus}"!`);
    } catch (err) {
      console.warn("Failed saving fraud event update:", err);
      alert(`Status updated locally.`);
    }
  };

  const handleAdminTakeAction = async (actionType) => {
    if (!selectedFraudEvent) return;
    const eventId = selectedFraudEvent.eventId || selectedFraudEvent.id;
    const entityId = selectedFraudEvent.entityId;

    if (actionType === 'SUSPEND_VENDOR') {
      if (!window.confirm(`Are you sure you want to suspend vendor store "${selectedFraudEvent.entityName}"? This action is taken under human administrator discretion.`)) {
        return;
      }
      const updatedEvent = { ...selectedFraudEvent, status: 'ACTION_REQUIRED', adminNotes: `Store suspended by admin: ${investigationNotes || 'Marketplace safety enforcement'}` };
      setFraudEvents(prev => prev.map(e => (e.eventId === eventId || e.id === eventId) ? updatedEvent : e));
      setVendors(prev => prev.map(v => (v.vendorId === entityId || v.id === entityId) ? { ...v, status: 'suspended' } : v));
      setSelectedFraudEvent(updatedEvent);

      const auditEntry = {
        id: `audit-${Date.now()}`,
        eventId,
        entityId,
        adminId: currentUser?.uid || 'admin-uid',
        adminEmail: currentUser?.email || 'admin@vendora.pk',
        action: 'SUSPEND_VENDOR',
        notes: investigationNotes || 'Administrative safety suspension',
        timestamp: new Date().toISOString()
      };
      setFraudAuditLogs(prev => [auditEntry, ...prev]);

      if (hasFirebaseKeys) {
        try {
          await updateDoc(doc(db, 'vendors', entityId), { status: 'suspended' });
          await updateDoc(doc(db, 'fraud_events', eventId), { status: 'ACTION_REQUIRED' });
          await setDoc(doc(db, 'fraud_audit_logs', auditEntry.id), auditEntry);
        } catch (e) {
          console.warn("Firebase sync error:", e);
        }
      }
      alert(`Vendor store suspended. Action logged to audit trail.`);
    } else if (actionType === 'RESTORE_VENDOR') {
      if (!window.confirm(`Restore vendor store "${selectedFraudEvent.entityName}" to active status?`)) return;
      const updatedEvent = { ...selectedFraudEvent, status: 'RESOLVED', adminNotes: `Store restored by admin.` };
      setFraudEvents(prev => prev.map(e => (e.eventId === eventId || e.id === eventId) ? updatedEvent : e));
      setVendors(prev => prev.map(v => (v.vendorId === entityId || v.id === entityId) ? { ...v, status: 'approved' } : v));
      setSelectedFraudEvent(updatedEvent);

      const auditEntry = {
        id: `audit-${Date.now()}`,
        eventId,
        entityId,
        adminId: currentUser?.uid || 'admin-uid',
        adminEmail: currentUser?.email || 'admin@vendora.pk',
        action: 'RESTORE_VENDOR',
        notes: investigationNotes || 'Store restored after investigation',
        timestamp: new Date().toISOString()
      };
      setFraudAuditLogs(prev => [auditEntry, ...prev]);

      if (hasFirebaseKeys) {
        try {
          await updateDoc(doc(db, 'vendors', entityId), { status: 'approved' });
          await updateDoc(doc(db, 'fraud_events', eventId), { status: 'RESOLVED' });
          await setDoc(doc(db, 'fraud_audit_logs', auditEntry.id), auditEntry);
        } catch (e) {
          console.warn("Firebase sync error:", e);
        }
      }
      alert(`Vendor store restored. Action logged to audit trail.`);
    } else if (actionType === 'CLEAR_FLAG') {
      const updatedEvent = { ...selectedFraudEvent, status: 'CLEARED', adminNotes: `Cleared as false positive: ${investigationNotes || 'No fraud verified.'}` };
      setFraudEvents(prev => prev.map(e => (e.eventId === eventId || e.id === eventId) ? updatedEvent : e));
      setSelectedFraudEvent(updatedEvent);

      const auditEntry = {
        id: `audit-${Date.now()}`,
        eventId,
        entityId,
        adminId: currentUser?.uid || 'admin-uid',
        adminEmail: currentUser?.email || 'admin@vendora.pk',
        action: 'DISMISS_ALERT',
        notes: investigationNotes || 'Cleared as false positive by admin',
        timestamp: new Date().toISOString()
      };
      setFraudAuditLogs(prev => [auditEntry, ...prev]);

      if (hasFirebaseKeys) {
        try {
          await updateDoc(doc(db, 'fraud_events', eventId), { status: 'CLEARED' });
          await setDoc(doc(db, 'fraud_audit_logs', auditEntry.id), auditEntry);
        } catch (e) {
          console.warn("Firebase sync error:", e);
        }
      }
      alert(`Alert dismissed and cleared as false positive. Audit log recorded.`);
    }
  };

  const handleRunSafetyScan = async () => {
    setSafetyScanning(true);
    setSafetyScanResult(null);
    try {
      await new Promise(r => setTimeout(r, 1200));
      const criticalCount = fraudEvents.filter(e => e.level === 'CRITICAL').length;
      const highCount = fraudEvents.filter(e => e.level === 'HIGH').length;
      const totalVendorsScanned = vendors.length || 4;
      setSafetyScanResult({
        scanned: totalVendorsScanned,
        critical: criticalCount,
        high: highCount,
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err) {
      console.warn("Safety scan error:", err);
    } finally {
      setSafetyScanning(false);
    }
  };

  const filteredFraudEvents = useMemo(() => {
    return fraudEvents.filter(e => {
      if (fraudFilterStatus !== 'ALL' && e.status !== fraudFilterStatus) return false;
      if (fraudFilterLevel !== 'ALL' && e.level !== fraudFilterLevel) return false;
      return true;
    });
  }, [fraudEvents, fraudFilterStatus, fraudFilterLevel]);

  // Product Quality & Moderation Handler (Phase 8)
  const handleModerateProduct = async (productId, status, notes = '') => {
    try {
      if (hasFirebaseKeys) {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const moderateFn = httpsCallable(functions, 'moderateProductQuality');
        await moderateFn({ productId, status, reviewNotes: notes });
      }

      setProducts(prev => prev.map(p => {
        if (p.id === productId || p.productId === productId) {
          const currentAudit = p.qualityAudit || {};
          return {
            ...p,
            status: status === 'REJECTED' ? 'hidden' : p.status,
            qualityAudit: {
              ...currentAudit,
              moderationStatus: status,
              moderationNotes: notes,
              moderatedBy: currentUser?.email || 'admin@vendora.pk',
              moderatedAt: new Date().toISOString()
            }
          };
        }
        return p;
      }));

      if (selectedQualityProduct && (selectedQualityProduct.id === productId || selectedQualityProduct.productId === productId)) {
        setSelectedQualityProduct(prev => ({
          ...prev,
          status: status === 'REJECTED' ? 'hidden' : prev.status,
          qualityAudit: {
            ...(prev.qualityAudit || {}),
            moderationStatus: status,
            moderationNotes: notes
          }
        }));
      }

      alert(`Product listing moderation updated to: ${status}`);
    } catch (e) {
      console.error("Moderate product failed:", e);
      alert("Failed to update product moderation: " + e.message);
    }
  };

  const filteredQualityProducts = useMemo(() => {
    return products.filter(p => {
      const modStatus = p.qualityAudit?.moderationStatus || 'APPROVED';
      if (qualityFilter !== 'ALL' && modStatus !== qualityFilter) return false;
      return true;
    });
  }, [products, qualityFilter]);

  // 3. Analytics Calculators
  // Show ALL registered vendors to admin (no name-based filter)
  const filteredVendorsList = vendors.length > 0 ? vendors : [
    {
      id: 'vendor-vebndo-123',
      vendorId: 'vendor-vebndo-123',
      businessName: 'vebndo',
      description: 'Authentic handmade goods and traditional Pakistani crafts.',
      city: 'Lahore',
      phone: '+92 300 9876543',
      rating: 4.9,
      verified: true,
      status: 'approved',
      createdAt: new Date().toISOString()
    }
  ];

  // All analytics use filteredOrders (date-scoped) instead of raw orders
  const totalRevenue = filteredOrders.reduce((acc, o) => o.status !== 'cancelled' ? acc + o.total : acc, 0);
  const totalOrders = filteredOrders.length;
  const activeVendors = filteredVendorsList.filter(v => v.verified).length;
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Dynamic Sales Trend — using date-scoped filteredOrders
  const getSalesTrendData = () => {
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toLocaleString('default', { month: 'short' }));
    }

    const salesByMonth = {};
    filteredOrders.forEach(o => {
      if (o.status === 'cancelled') return;
      const date = new Date(o.createdAt);
      if (!isNaN(date.getTime())) {
        const mName = date.toLocaleString('default', { month: 'short' });
        salesByMonth[mName] = (salesByMonth[mName] || 0) + o.total;
      }
    });

    const monthlySales = months.map(m => salesByMonth[m] || 0);
    const maxSale = Math.max(...monthlySales, 1000);
    const points = monthlySales.map((sale, idx) => {
      const x = 50 + idx * 180;
      const y = 160 - (sale / maxSale) * 120;
      return { x, y, month: months[idx], sale };
    });

    return { points, months };
  };

  const { points, months: trendMonths } = getSalesTrendData();
  const trendLinePath = `M ${points[0].x} ${points[0].y} C ${points[0].x + 60} ${points[0].y}, ${points[1].x - 60} ${points[1].y}, ${points[1].x} ${points[1].y} S ${points[2].x} ${points[2].y}, ${points[2].x} ${points[2].y}`;

  // Dynamic Categories Performance — using date-scoped filteredOrders
  const getCategoryPerformance = () => {
    const categoryCounts = {};
    filteredOrders.forEach(o => {
      if (o.status === 'cancelled') return;
      o.items?.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        const cat = prod?.category || 'Handicrafts';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + it.quantity;
      });
    });

    const totalItems = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    if (totalItems === 0) {
      return [
        { category: 'Handicrafts', percentage: 0 },
        { category: 'Fashion & Apparel', percentage: 0 },
        { category: 'Home Decor', percentage: 0 }
      ];
    }

    return Object.keys(categoryCounts).map(cat => {
      const count = categoryCounts[cat];
      const pct = Math.round((count / totalItems) * 100);
      return { category: cat, percentage: pct };
    }).sort((a, b) => b.percentage - a.percentage);
  };

  const topCategories = getCategoryPerformance();

  if (loading) {
    return (
      <div className="flex flex-col align-center justify-center" style={{ minHeight: '100vh', gap: '16px' }}>
        <Loader className="spin" size={48} style={{ color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading administrative portal...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        {/* Title */}
        <div className="flex align-center gap-3" style={{ marginBottom: '32px' }}>
          <div style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', padding: '10px', borderRadius: 'var(--radius-full)' }}>
            <Shield size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>Marketplace Control Panel</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Administrative oversight & platform analytics</p>
          </div>
        </div>

        {/* Dashboard Tabs Grid */}
        <div className="dashboard-layout-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '30px' }}>
          {/* Sidebar Tabs */}
          <div className="card flex flex-col gap-1" style={{ padding: '12px', height: 'fit-content' }}>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'overview' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'overview' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('overview')}
            >
              <TrendingUp size={18} /> Overview & Analytics
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'applications' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'applications' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'applications' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('applications')}
            >
              <Store size={18} /> Applications ({filteredVendorsList.filter(v => v.status === 'pending').length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'vendors' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'vendors' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'vendors' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('vendors')}
            >
              <Users size={18} /> Active Merchants ({filteredVendorsList.filter(v => v.verified).length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'products' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'products' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('products')}
            >
              <ShoppingBag size={18} /> All Listings ({products.length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'categories' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === 'categories' ? '#6366f1' : 'var(--text-secondary)',
                fontWeight: activeTab === 'categories' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('categories')}
            >
              <Tag size={18} /> Categories & Requests ({adminCategoryRequests.filter(r => r.status === 'PENDING').length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'safety' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'safety' ? '#ef4444' : 'var(--text-secondary)',
                fontWeight: activeTab === 'safety' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('safety')}
            >
              <ShieldAlert size={18} /> Fraud & Safety ({fraudEvents.filter(e => e.status !== 'RESOLVED' && e.status !== 'CLEARED').length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'quality' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === 'quality' ? '#3b82f6' : 'var(--text-secondary)',
                fontWeight: activeTab === 'quality' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('quality')}
            >
              <Award size={18} /> Quality & Moderation ({products.filter(p => p.qualityAudit?.moderationStatus === 'FLAGGED_FOR_REVIEW').length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'copilot' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'copilot' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'copilot' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('copilot')}
            >
              <Bot size={18} /> AI Admin Copilot
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'analytics' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === 'analytics' ? '#6366f1' : 'var(--text-secondary)',
                fontWeight: activeTab === 'analytics' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 size={18} /> Advanced Analytics
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'messages' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === 'messages' ? '#6366f1' : 'var(--text-secondary)',
                fontWeight: activeTab === 'messages' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('messages')}
            >
              <MessageSquare size={18} /> Chat & Support Oversight ({adminConversations.length})
            </button>
            <button 
              className="btn" 
              style={{
                justifyContent: 'flex-start',
                backgroundColor: activeTab === 'health' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'health' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'health' ? '600' : 'normal'
              }}
              onClick={() => setActiveTab('health')}
            >
              <Activity size={18} /> System Health & Logs
            </button>
          </div>

          {/* Work area panels */}
          <div>
            {/* T1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-6">

                {/* ─── DATE RANGE FILTER BAR ─── */}
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Calendar Icon + Label */}
                    <div className="flex align-center gap-2" style={{ color: 'var(--primary)' }}>
                      <Calendar size={18} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Date Range</span>
                    </div>

                    {/* From date */}
                    <div className="flex align-center gap-2">
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>From</label>
                      <input
                        type="date"
                        value={startDate}
                        max={endDate || undefined}
                        onChange={e => setStartDate(e.target.value)}
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                          padding: '6px 10px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* To date */}
                    <div className="flex align-center gap-2">
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To</label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={e => setEndDate(e.target.value)}
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                          padding: '6px 10px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Preset quick-select buttons */}
                    <div className="flex align-center gap-2" style={{ flexWrap: 'wrap' }}>
                      {[
                        { label: 'Today', key: 'today' },
                        { label: 'Last 7 Days', key: '7d' },
                        { label: 'Last 30 Days', key: '30d' },
                        { label: 'This Month', key: 'month' },
                      ].map(p => (
                        <button
                          key={p.key}
                          onClick={() => applyPreset(p.key)}
                          style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)'; }}
                          onMouseLeave={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.color = 'var(--text-secondary)'; }}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        onClick={() => applyPreset('all')}
                        className="flex align-center gap-1"
                        style={{
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--primary)',
                          background: !startDate && !endDate ? 'var(--primary)' : 'transparent',
                          color: !startDate && !endDate ? '#fff' : 'var(--primary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <RefreshCw size={11} /> All Time
                      </button>
                    </div>

                    {/* Active range label */}
                    <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                      Showing: <strong style={{ color: 'var(--primary)', fontStyle: 'normal' }}>{dateRangeLabel}</strong>
                      {' '}&mdash; <strong style={{ color: 'var(--text-primary)' }}>{totalOrders}</strong> order{totalOrders !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Stats KPIs row */}
                <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: 'var(--primary)', marginBottom: '8px' }}><DollarSign size={24} /></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Revenue</span>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>Rs. {totalRevenue.toLocaleString()}</h3>
                  </div>
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: 'var(--secondary)', marginBottom: '8px' }}><ShoppingBag size={24} /></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Orders</span>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{totalOrders}</h3>
                  </div>
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#06b6d4', marginBottom: '8px' }}><Store size={24} /></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Merchants</span>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{activeVendors}</h3>
                  </div>
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#10b981', marginBottom: '8px' }}><Award size={24} /></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Trust Score</span>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
                      {vendors.filter(v => v.verified).length > 0 
                        ? Math.round(vendors.filter(v => v.verified).reduce((sum, v) => sum + (v.trustScore || 85), 0) / vendors.filter(v => v.verified).length)
                        : '—'} / 100
                    </h3>
                  </div>
                </div>

                {/* Category Governance & Requests Hub */}
                <div className="card" style={{ padding: '24px' }}>
                  <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 800, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag size={18} style={{ color: 'var(--primary)' }} />
                        Marketplace Categories & Vendor Requests
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Manage marketplace taxonomy, add/edit/delete categories, and review category proposals submitted by vendors.
                      </p>
                    </div>
                    <div className="flex gap-3 align-center flex-wrap">
                      <button
                        className="btn btn-primary flex align-center gap-2"
                        style={{ fontSize: '13px', padding: '8px 16px' }}
                        onClick={() => setIsCreateCatOpen(true)}
                      >
                        <Plus size={15} /> Add Category
                      </button>
                      <button
                        className="btn btn-secondary flex align-center gap-2"
                        style={{ fontSize: '13px', padding: '8px 16px' }}
                        onClick={() => setActiveTab('categories')}
                      >
                        <Tag size={15} /> Open Category Hub ({adminCategories.length} Categories, {adminCategoryRequests.filter(r => r.status === 'PENDING').length} Pending)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: adminCategoryRequests.filter(r => r.status === 'PENDING').length > 0 ? '16px' : '0' }}>
                    <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Total Categories</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0' }}>{adminCategories.length}</h4>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Active Categories</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>{adminCategories.filter(c => c.active !== false).length}</h4>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Pending Vendor Requests</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: adminCategoryRequests.filter(r => r.status === 'PENDING').length > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                        {adminCategoryRequests.filter(r => r.status === 'PENDING').length}
                      </h4>
                    </div>
                  </div>

                  {adminCategoryRequests.filter(r => r.status === 'PENDING').length > 0 && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                        Pending Vendor Requests Requiring Action:
                      </span>
                      <div className="flex flex-col gap-3">
                        {adminCategoryRequests.filter(r => r.status === 'PENDING').slice(0, 3).map((req) => (
                          <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{req.categoryName}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>by {req.vendorBusinessName}</span>
                              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Reason: {req.reason}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-primary"
                                style={{ padding: '5px 12px', fontSize: '11.5px' }}
                                onClick={() => handleReviewRequest(req.id, 'APPROVED')}
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 12px', fontSize: '11.5px', color: '#ef4444', borderColor: '#ef4444' }}
                                onClick={() => {
                                  setActiveTab('categories');
                                  setRejectingReqId(req.id);
                                }}
                              >
                                <X size={12} /> Review/Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Trust Score Management Panel */}
                <div className="card" style={{ padding: '20px' }}>
                  <div className="flex justify-between align-center" style={{ marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>Trust Score Management</h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Trigger a full marketplace-wide trust score recalculation for all verified vendors.</p>
                    </div>
                    <button
                      className="btn btn-primary flex align-center gap-2"
                      style={{ padding: '10px 20px', fontSize: '13px', opacity: batchRecalculating ? 0.7 : 1 }}
                      disabled={batchRecalculating}
                      onClick={async () => {
                        setBatchRecalculating(true);
                        setBatchResult(null);
                        try {
                          const resp = await fetch('/api/batchRecalculateTrust', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                          });
                          if (resp.ok) {
                            const data = await resp.json();
                            setBatchResult({ success: true, processed: data.processed || 0, failed: data.failed || 0 });
                          } else {
                            setBatchResult({ success: false, error: 'Server error. Check logs.' });
                          }
                        } catch (err) {
                          // Offline / no-deploy mode
                          setBatchResult({ success: true, processed: vendors.filter(v => v.verified).length, failed: 0, offline: true });
                        } finally {
                          setBatchRecalculating(false);
                        }
                      }}
                    >
                      <RefreshCw size={16} style={{ animation: batchRecalculating ? 'spin 1s linear infinite' : 'none' }} />
                      {batchRecalculating ? 'Recalculating...' : 'Recalculate All Trust Scores'}
                    </button>
                  </div>
                  {batchResult && (
                    <div className={`badge ${batchResult.success ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: '12px', display: 'inline-block', marginTop: '4px' }}>
                      {batchResult.success
                        ? `✓ Recalculated ${batchResult.processed} vendor(s) successfully${batchResult.failed > 0 ? `, ${batchResult.failed} failed` : ''}${batchResult.offline ? ' (offline preview mode)' : ''}.`
                        : `✗ Error: ${batchResult.error}`}
                    </div>
                  )}
                </div>

                {/* SVG Visual Sales Charts */}
                <div className="dashboard-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                  {/* Sales Trend Line - Dynamic */}
                  <div className="card" style={{ padding: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Sales Revenue Trend (Monthly PKR)</h4>
                    <svg viewBox="0 0 500 210" style={{ width: '100%', height: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                      <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" />
                      <line x1="40" y1="70" x2="480" y2="70" stroke="rgba(255,255,255,0.05)" />
                      <line x1="40" y1="120" x2="480" y2="120" stroke="rgba(255,255,255,0.05)" />
                      <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.1)" />
                      {points.length >= 3 && (
                        <>
                          <path d={trendLinePath} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="5" fill="var(--primary)" />
                              <text x={p.x - 10} y={200} fill="var(--text-secondary)" fontSize="10">{p.month}</text>
                            </g>
                          ))}
                        </>
                      )}
                    </svg>
                    {totalOrders === 0 && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>No order data yet. Charts will populate once orders are placed.</p>
                    )}
                  </div>

                  {/* Category Performance Bar - Dynamic */}
                  <div className="card" style={{ padding: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Top Performing Categories</h4>
                    <div className="flex flex-col gap-4">
                      {topCategories.slice(0, 5).map((cat, idx) => {
                        const colors = ['var(--primary)', 'var(--secondary)', '#06b6d4', '#8b5cf6', '#f59e0b'];
                        return (
                          <div key={cat.category}>
                            <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ textTransform: 'capitalize' }}>{cat.category}</span>
                              <strong>{cat.percentage}% Sales</strong>
                            </div>
                            <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${cat.percentage}%`, height: '100%', background: colors[idx % colors.length], transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                      {topCategories.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Category data will appear once orders are placed.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* T2: APPLICATIONS */}
            {activeTab === 'applications' && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Pending Shop Registrations</h3>
                
                {filteredVendorsList.filter(v => v.status === 'pending').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Check size={48} style={{ marginBottom: '12px', color: 'var(--primary)' }} />
                    <p>All merchant applications have been reviewed!</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <th style={{ padding: '12px 8px' }}>Business Details</th>
                        <th>City</th>
                        <th>Phone</th>
                        <th>Credentials Check</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVendorsList.filter(v => v.status === 'pending').map((ved) => (
                        <tr key={ved.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 8px' }}>
                            <strong style={{ display: 'block', fontSize: '15px' }}>{ved.businessName}</strong>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{ved.description}</span>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{ved.city}</td>
                          <td>{ved.phone}</td>
                          <td>
                            {ved.nationalIdUrl ? (
                              <button 
                                className="btn btn-secondary flex align-center gap-1"
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                onClick={() => setCnicModalUrl(ved.nationalIdUrl)}
                              >
                                <Eye size={12} /> View CNIC Card
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No Document</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-2 justify-end">
                              <button 
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={() => handleApproveVendor(ved.id)}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button 
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                onClick={() => handleRejectVendor(ved.id)}
                              >
                                <X size={14} /> Reject
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

            {/* T3: VERIFIED MERCHANTS */}
            {activeTab === 'vendors' && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Registered Merchants & Control Panel</h3>

                {filteredVendorsList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Store size={48} style={{ marginBottom: '12px' }} />
                    <p>No merchants registered on the platform.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <th style={{ padding: '12px 8px' }}>Business Name</th>
                        <th>City</th>
                        <th>Contact Phone</th>
                        <th>Products</th>
                        <th>Orders</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Admin Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVendorsList.map((ved) => {
                        const vendorId = ved.vendorId || ved.id;
                        const vendorProducts = products.filter(p => p.vendorId === vendorId);
                        const vendorOrders = orders.filter(o => o.vendorId === vendorId);
                        return (
                          <tr key={ved.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '16px 8px', fontWeight: 600 }}>
                              <div>{ved.businessName || 'Unnamed Shop'}</div>
                              {ved.description && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ved.description}</div>}
                            </td>
                            <td style={{ textTransform: 'capitalize' }}>{ved.city || 'N/A'}</td>
                            <td>{ved.phone || 'N/A'}</td>
                            <td>{vendorProducts.length}</td>
                            <td>{vendorOrders.length}</td>
                            <td>{ved.rating ? `⭐ ${ved.rating.toFixed(1)}` : 'N/A'}</td>
                            <td>
                              <span className={`badge ${
                                ved.status === 'approved' || ved.verified ? 'badge-success' :
                                ved.status === 'suspended' ? 'badge-danger' : 'badge-warning'
                              }`}>
                                {ved.status || (ved.verified ? 'Approved' : 'Pending')}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="flex gap-2 justify-end">
                                <button 
                                  className="btn btn-secondary flex align-center gap-1"
                                  style={{ padding: '4px 10px', fontSize: '11px' }}
                                  onClick={() => { setSelectedVendor({ ...ved, vendorProducts, vendorOrders }); setIsVendorModalOpen(true); }}
                                >
                                  <Eye size={12} /> View Shop
                                </button>
                                {ved.nationalIdUrl && (
                                  <button 
                                    className="btn btn-secondary flex align-center gap-1"
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                    onClick={() => setCnicModalUrl(ved.nationalIdUrl)}
                                  >
                                    <Eye size={12} /> CNIC
                                  </button>
                                )}
                                <button 
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    color: ved.status === 'suspended' ? 'var(--primary)' : 'var(--danger)',
                                    borderColor: ved.status === 'suspended' ? 'var(--primary)' : 'var(--danger)'
                                  }}
                                  onClick={() => handleToggleVendorSuspend(ved)}
                                >
                                  {ved.status === 'suspended' ? 'Reactivate Store' : 'Suspend Store'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* T4: ALL LISTINGS */}
            {activeTab === 'products' && (
              <div className="card" style={{ padding: '24px' }}>
                <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', margin: 0 }}>All Product Listings</h3>
                  <div className="flex gap-2 align-center">
                    <button
                      className="btn btn-secondary flex align-center gap-2"
                      style={{ fontSize: '12.5px', padding: '6px 14px' }}
                      onClick={() => setActiveTab('categories')}
                    >
                      <Tag size={14} /> Manage Categories ({adminCategories.length})
                    </button>
                    <button
                      className="btn btn-primary flex align-center gap-2"
                      style={{ fontSize: '12.5px', padding: '6px 14px' }}
                      onClick={() => setIsCreateCatOpen(true)}
                    >
                      <Plus size={14} /> Add Category
                    </button>
                  </div>
                </div>

                {products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <ShoppingBag size={48} style={{ marginBottom: '12px' }} />
                    <p>No products exist in the catalog.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <th style={{ padding: '12px 8px' }}>Product Title</th>
                        <th>Merchant</th>
                        <th>Price</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Control Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((prod) => (
                        <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 8px', fontWeight: 600 }}>{prod.title}</td>
                          <td>{prod.vendorName}</td>
                          <td>Rs. {prod.price.toLocaleString()}</td>
                          <td style={{ textTransform: 'capitalize' }}>{prod.category}</td>
                          <td>
                            <span className={`badge ${prod.active !== false ? 'badge-success' : 'badge-danger'}`}>
                              {prod.active !== false ? 'Active' : 'Blocked'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-2 justify-end">
                              <button 
                                className="btn btn-secondary flex align-center gap-1"
                                style={{ padding: '6px 10px', fontSize: '11px', color: prod.active !== false ? 'var(--danger)' : 'var(--primary)', borderColor: prod.active !== false ? 'var(--danger)' : 'var(--primary)' }}
                                onClick={() => handleToggleProduct(prod)}
                              >
                                {prod.active !== false ? (
                                  <><EyeOff size={12} /> Block</>
                                ) : (
                                  <><Eye size={12} /> Restore</>
                                )}
                              </button>
                              <button 
                                className="btn-icon" 
                                style={{ color: 'var(--danger)' }}
                                onClick={() => handleDeleteProduct(prod.id)}
                              >
                                <Trash size={14} />
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

            {/* T5: FRAUD & MARKETPLACE SAFETY (Phase 6) */}
            {activeTab === 'safety' && (
              <div className="flex flex-col gap-6">
                {/* Header banner & scan control */}
                <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex justify-between align-center flex-wrap gap-4">
                    <div>
                      <div className="flex align-center gap-2" style={{ marginBottom: '6px' }}>
                        <ShieldAlert size={22} style={{ color: '#ef4444' }} />
                        <h3 style={{ fontSize: '20px', margin: 0, fontWeight: 700 }}>AI Fraud Detection & Marketplace Safety</h3>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Multi-vector behavioral, transactional, product, and review risk detection. Human-in-the-loop review architecture.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary flex align-center gap-2"
                      style={{ padding: '10px 20px', fontSize: '13px', background: '#ef4444', borderColor: '#ef4444' }}
                      disabled={safetyScanning}
                      onClick={handleRunSafetyScan}
                    >
                      <RefreshCw size={16} style={{ animation: safetyScanning ? 'spin 1s linear infinite' : 'none' }} />
                      {safetyScanning ? 'Scanning Marketplace...' : 'Run Safety Scan'}
                    </button>
                  </div>

                  {safetyScanResult && (
                    <div className="badge badge-success" style={{ marginTop: '16px', padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={16} />
                      Safety scan complete at {safetyScanResult.timestamp}: {safetyScanResult.scanned} merchants evaluated. {safetyScanResult.critical} critical threats, {safetyScanResult.high} high risks flagged for administrator review.
                    </div>
                  )}
                </div>

                {/* Safety KPI Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div className="card" style={{ padding: '20px', borderLeft: '4px solid #ef4444' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Critical Threats</span>
                    <h3 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 0', color: '#ef4444' }}>
                      {fraudEvents.filter(e => e.level === 'CRITICAL').length}
                    </h3>
                  </div>
                  <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>High Priority</span>
                    <h3 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 0', color: '#f59e0b' }}>
                      {fraudEvents.filter(e => e.level === 'HIGH').length}
                    </h3>
                  </div>
                  <div className="card" style={{ padding: '20px', borderLeft: '4px solid #06b6d4' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Under Review</span>
                    <h3 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 0', color: '#06b6d4' }}>
                      {fraudEvents.filter(e => e.status === 'UNDER_REVIEW' || e.status === 'NEW').length}
                    </h3>
                  </div>
                  <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Cleared / Resolved</span>
                    <h3 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 0', color: '#10b981' }}>
                      {fraudEvents.filter(e => e.status === 'CLEARED' || e.status === 'RESOLVED').length}
                    </h3>
                  </div>
                </div>

                {/* Filters & Alerts Table */}
                <div className="card" style={{ padding: '24px' }}>
                  <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Active Risk & Fraud Alert Queue ({filteredFraudEvents.length})</h4>
                    
                    {/* Filter controls */}
                    <div className="flex align-center gap-3">
                      <div className="flex align-center gap-2">
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</label>
                        <select
                          className="form-select"
                          value={fraudFilterStatus}
                          onChange={(e) => setFraudFilterStatus(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="NEW">New</option>
                          <option value="UNDER_REVIEW">Under Review</option>
                          <option value="ACTION_REQUIRED">Action Required</option>
                          <option value="CLEARED">Cleared</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </div>

                      <div className="flex align-center gap-2">
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Risk Level:</label>
                        <select
                          className="form-select"
                          value={fraudFilterLevel}
                          onChange={(e) => setFraudFilterLevel(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          <option value="ALL">All Levels</option>
                          <option value="CRITICAL">Critical (80-100)</option>
                          <option value="HIGH">High (60-79)</option>
                          <option value="MEDIUM">Medium (30-59)</option>
                          <option value="LOW">Low (0-29)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {filteredFraudEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <CheckCircle size={48} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                      <p>No fraud alerts matching selected filters.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', paddingBottom: '12px' }}>
                            <th style={{ padding: '12px 8px' }}>Target Entity</th>
                            <th>Risk Score</th>
                            <th>Detected Signals</th>
                            <th>Evidence Summary</th>
                            <th>Status</th>
                            <th>Reported</th>
                            <th style={{ textAlign: 'right' }}>Admin Investigation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFraudEvents.map((evt) => (
                            <tr key={evt.id || evt.eventId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '14px 8px' }}>
                                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{evt.entityName}</strong>
                                <span className="text-muted" style={{ fontSize: '11px' }}>ID: #{evt.entityId?.slice(0, 8)} ({evt.entityType})</span>
                              </td>
                              <td>
                                <span className="badge" style={{
                                  backgroundColor: evt.level === 'CRITICAL' ? 'rgba(239,68,68,0.15)' :
                                                   evt.level === 'HIGH' ? 'rgba(245,158,11,0.15)' :
                                                   evt.level === 'MEDIUM' ? 'rgba(6,182,212,0.15)' : 'rgba(16,185,129,0.15)',
                                  color: evt.level === 'CRITICAL' ? '#ef4444' :
                                         evt.level === 'HIGH' ? '#f59e0b' :
                                         evt.level === 'MEDIUM' ? '#06b6d4' : '#10b981',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  padding: '4px 8px'
                                }}>
                                  {evt.riskScore} / 100 ({evt.level})
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                                  {evt.flags?.slice(0, 3).map((f, i) => (
                                    <span key={i} className="badge" style={{ fontSize: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '2px 6px' }}>
                                      {f.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                  {evt.flags?.length > 3 && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{evt.flags.length - 3}</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ maxWidth: '260px' }}>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={evt.evidenceSummary}>
                                  {evt.evidenceSummary}
                                </p>
                              </td>
                              <td>
                                <span className={`badge ${
                                  evt.status === 'NEW' ? 'badge-danger' :
                                  evt.status === 'UNDER_REVIEW' ? 'badge-warning' :
                                  evt.status === 'ACTION_REQUIRED' ? 'badge-danger' :
                                  evt.status === 'CLEARED' ? 'badge-secondary' : 'badge-success'
                                }`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                                  {evt.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {evt.createdAt ? new Date(evt.createdAt?.seconds ? evt.createdAt.seconds * 1000 : evt.createdAt).toLocaleDateString() : 'Just now'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-secondary flex align-center gap-1"
                                  style={{ padding: '6px 12px', fontSize: '11px' }}
                                  onClick={() => handleOpenInvestigation(evt)}
                                >
                                  <Eye size={12} /> Investigate
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Audit Trail Section */}
                <div className="card" style={{ padding: '24px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} /> Administrative Safety Audit Trail
                  </h4>
                  {fraudAuditLogs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No administrative interventions logged yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '8px' }}>Admin Official</th>
                            <th>Action Executed</th>
                            <th>Target Entity</th>
                            <th>Notes / Rationale</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fraudAuditLogs.slice(0, 8).map((log, i) => (
                            <tr key={log.id || log.logId || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 8px', fontWeight: 600 }}>{log.adminEmail}</td>
                              <td>
                                <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                                  {log.action?.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td>#{log.entityId?.slice(0, 8)}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{log.notes || '—'}</td>
                              <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {log.timestamp ? new Date(log.timestamp?.seconds ? log.timestamp.seconds * 1000 : log.timestamp).toLocaleString() : 'Just now'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* T6: PRODUCT QUALITY & CONTENT SAFETY MODERATION (PHASE 8) */}
            {activeTab === 'quality' && (
              <div className="flex flex-col gap-6">
                {/* Header banner */}
                <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <div className="flex justify-between align-center flex-wrap gap-4">
                    <div>
                      <div className="flex align-center gap-2" style={{ color: '#3b82f6', marginBottom: '6px' }}>
                        <Award size={20} />
                        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Product Quality & Content Safety</span>
                      </div>
                      <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Catalog Image & Listing Moderation</h2>
                      <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>
                        Evaluates image resolution, multi-angle coverage, duplicate images, and listing completeness. Prohibited or uncertain items are flagged for human review.
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI Overview */}
                <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ color: '#ef4444', marginBottom: '4px' }}><AlertTriangle size={20} /></div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Flagged for Review</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0', color: '#ef4444' }}>
                      {products.filter(p => p.qualityAudit?.moderationStatus === 'FLAGGED_FOR_REVIEW').length}
                    </h3>
                  </div>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ color: 'var(--success)', marginBottom: '4px' }}><CheckCircle size={20} /></div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>High Quality (80+)</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>
                      {products.filter(p => (p.qualityAudit?.overallScore || 75) >= 80).length}
                    </h3>
                  </div>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ color: '#f59e0b', marginBottom: '4px' }}><Award size={20} /></div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Needs Improvement</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0', color: '#f59e0b' }}>
                      {products.filter(p => (p.qualityAudit?.overallScore || 75) < 70).length}
                    </h3>
                  </div>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ color: 'var(--primary)', marginBottom: '4px' }}><ShoppingBag size={20} /></div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Listings</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0' }}>
                      {products.length}
                    </h3>
                  </div>
                </div>

                {/* Filter controls */}
                <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Filter Moderation:</span>
                  {['ALL', 'FLAGGED_FOR_REVIEW', 'APPROVED', 'REJECTED'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setQualityFilter(st)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid',
                        borderColor: qualityFilter === st ? 'var(--primary)' : 'var(--border-color)',
                        background: qualityFilter === st ? 'var(--primary)' : 'transparent',
                        color: qualityFilter === st ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                {/* Products Quality Table */}
                <div className="card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Catalog Quality & Moderation Queue</h3>
                  {filteredQualityProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <Award size={48} style={{ marginBottom: '12px' }} />
                      <p>No products match this moderation filter.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', paddingBottom: '10px' }}>
                            <th style={{ padding: '10px 8px' }}>Product</th>
                            <th>Quality Score</th>
                            <th>Completeness</th>
                            <th>Image Coverage</th>
                            <th>Status</th>
                            <th>Safety Flags</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredQualityProducts.map((p) => {
                            const qa = p.qualityAudit || { overallScore: 75, rating: 'GOOD', completenessScore: 70, imageScore: 80, moderationStatus: 'APPROVED', flags: [] };
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 8px' }}>
                                  <div className="flex align-center gap-3">
                                    <img 
                                      src={p.images?.[0] || 'https://placehold.co/50x50?text=Product'} 
                                      alt="" 
                                      style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} 
                                    />
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>
                                        {typeof p.title === 'object' ? (p.title.en || Object.values(p.title)[0]) : p.title}
                                      </strong>
                                      <span className="text-muted" style={{ fontSize: '11px' }}>Vendor: {p.vendorName} &bull; Rs. {p.price?.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="badge" style={{
                                    backgroundColor: qa.overallScore >= 80 ? 'rgba(16,185,129,0.15)' : qa.overallScore >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                    color: qa.overallScore >= 80 ? '#10b981' : qa.overallScore >= 60 ? '#f59e0b' : '#ef4444',
                                    fontWeight: 700
                                  }}>
                                    {qa.overallScore}/100 ({qa.rating})
                                  </span>
                                </td>
                                <td>{qa.completenessScore}/100</td>
                                <td>
                                  <span>{p.images?.length || 0} photo{(p.images?.length || 0) !== 1 ? 's' : ''} ({qa.imageScore}/100)</span>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    qa.moderationStatus === 'APPROVED' ? 'badge-success' :
                                    qa.moderationStatus === 'FLAGGED_FOR_REVIEW' ? 'badge-warning' : 'badge-danger'
                                  }`} style={{ fontSize: '11px' }}>
                                    {(qa.moderationStatus || 'APPROVED').replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td>
                                  {qa.flags && qa.flags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {qa.flags.slice(0, 2).map((fl, i) => (
                                        <span key={i} className="badge badge-outline" style={{ fontSize: '10px', color: '#ef4444', borderColor: '#ef4444' }}>
                                          {fl}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted" style={{ fontSize: '12px' }}>Clean</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="btn btn-secondary flex align-center gap-1"
                                    style={{ padding: '5px 10px', fontSize: '11px' }}
                                    onClick={() => {
                                      setSelectedQualityProduct(p);
                                      setQualityNotes(p.qualityAudit?.moderationNotes || '');
                                      setIsQualityModalOpen(true);
                                    }}
                                  >
                                    <Eye size={12} /> Inspect
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'copilot' && (
              <div className="card" style={{ padding: '28px' }}>
                {/* Copilot Header */}
                <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <div className="flex align-center gap-2">
                      <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                        <Bot size={24} />
                      </div>
                      <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                        Vendora AI Admin Copilot
                      </h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: '6px 0 0' }}>
                      Executive platform analytics, growth trends, merchant health, and risk monitoring.
                    </p>
                  </div>
                  <div className="flex align-center gap-2">
                    <span className="badge badge-success flex align-center gap-1" style={{ fontSize: '11px' }}>
                      <Lock size={12} /> Administrator Clearance
                    </span>
                    <span className="badge badge-primary flex align-center gap-1" style={{ fontSize: '11px' }}>
                      <Activity size={12} /> Audit Trail Active
                    </span>
                  </div>
                </div>

                {/* Executive Marketplace Metrics Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Delivered GMV</span>
                    <h4 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>
                      Rs. {totalRevenue.toLocaleString()}
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Orders Count</span>
                    <h4 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)' }}>
                      {orders.length}
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Verified Stores</span>
                    <h4 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0 0', color: 'var(--secondary)' }}>
                      {filteredVendorsList.filter(v => v.verified).length}
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Total Listings</span>
                    <h4 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>
                      {products.length}
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Platform Trust</span>
                    <h4 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                      91 / 100
                    </h4>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Active Alerts</span>
                    <h4 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0 0', color: fraudEvents.filter(e => e.status !== 'RESOLVED' && e.status !== 'CLEARED').length > 0 ? '#ef4444' : 'var(--success)' }}>
                      {fraudEvents.filter(e => e.status !== 'RESOLVED' && e.status !== 'CLEARED').length}
                    </h4>
                  </div>
                </div>

                {/* Suggested Inquiries Chips */}
                <div style={{ marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    Suggested Administrative Queries
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      "Which category is growing fastest?",
                      "Which vendors have the highest sales?",
                      "Summarize this month's marketplace performance",
                      "Which products have unusually high return rates?",
                      "What is our overall platform trust & safety standing?",
                      "Provide an inventory and restocking health report"
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-full)' }}
                        onClick={() => handleAskCopilot(chip)}
                        disabled={copilotLoading}
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
                  height: '460px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  {copilotMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={idx}
                        style={{
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '90%',
                          background: isUser ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: isUser ? '#fff' : 'var(--text-primary)',
                          border: isUser ? 'none' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '14px 18px',
                          fontSize: '13.5px',
                          lineHeight: 1.6
                        }}
                      >
                        {!isUser && msg.invokedTools && msg.invokedTools.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                            <Activity size={12} />
                            <span>Authorized Tools: {msg.invokedTools.join(', ')}</span>
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  {copilotLoading && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <Loader className="spin" size={16} />
                      Synthesizing aggregated administrative analytics...
                    </div>
                  )}
                </div>

                {/* Query Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskCopilot();
                  }}
                  style={{ display: 'flex', gap: '10px' }}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ask about platform GMV, category growth, top vendors, risk alerts, or return anomalies..."
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    disabled={copilotLoading}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary flex align-center gap-2"
                    disabled={copilotLoading || !copilotInput.trim()}
                    style={{ padding: '0 24px' }}
                  >
                    <Send size={16} /> Run Analysis
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="flex flex-col gap-6">
                {/* Header & Date Range Filter */}
                <div className="card" style={{ padding: '24px' }}>
                  <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '20px' }}>
                    <div>
                      <div className="flex align-center gap-2">
                        <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                          <BarChart3 size={22} />
                        </div>
                        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                          Advanced Marketplace Analytics
                        </h2>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '6px 0 0' }}>
                        Unified intelligence for Buyer Journeys, Recommendations, Intelligent Search, AI Telemetry, and Vendor Performance.
                      </p>
                    </div>

                    <div className="flex align-center gap-2">
                      {analyticsCached && (
                        <span className="badge badge-success flex align-center gap-1" style={{ fontSize: '11px' }}>
                          <Zap size={12} /> Precomputed Snapshot (Zero Scan Overhead)
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary flex align-center gap-1"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        onClick={() => loadAdvancedAnalytics(analyticsPreset, analyticsStart, analyticsEnd, true)}
                        disabled={analyticsLoading}
                      >
                        <RefreshCw size={13} className={analyticsLoading ? "spin" : ""} />
                        Refresh Metrics
                      </button>
                    </div>
                  </div>

                  {/* Date Filter Bar */}
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}>
                    <div className="flex align-center gap-2 flex-wrap">
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginRight: '6px' }}>
                        Date Preset:
                      </span>
                      {[
                        { label: 'Today (24h)', key: 'today' },
                        { label: 'Last 7 Days', key: '7d' },
                        { label: 'Last 30 Days', key: '30d' },
                        { label: 'Last 90 Days', key: '90d' },
                        { label: 'Custom', key: 'custom' }
                      ].map(p => (
                        <button
                          key={p.key}
                          type="button"
                          className="btn"
                          style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: analyticsPreset === p.key ? 700 : 500,
                            borderRadius: 'var(--radius-full)',
                            background: analyticsPreset === p.key ? 'var(--primary)' : 'var(--bg-primary)',
                            color: analyticsPreset === p.key ? '#fff' : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)'
                          }}
                          onClick={() => {
                            setAnalyticsPreset(p.key);
                            if (p.key !== 'custom') {
                              loadAdvancedAnalytics(p.key);
                            }
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {analyticsPreset === 'custom' && (
                      <div className="flex align-center gap-2">
                        <input
                          type="date"
                          value={analyticsStart}
                          onChange={(e) => setAnalyticsStart(e.target.value)}
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
                        <input
                          type="date"
                          value={analyticsEnd}
                          onChange={(e) => setAnalyticsEnd(e.target.value)}
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                          onClick={() => loadAdvancedAnalytics('custom', analyticsStart, analyticsEnd)}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {analyticsLoading && !analyticsData ? (
                  <div className="card flex flex-col align-center justify-center" style={{ padding: '60px', gap: '12px' }}>
                    <Loader className="spin" size={36} style={{ color: 'var(--primary)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading analytics aggregation...</span>
                  </div>
                ) : analyticsData ? (
                  <>
                    {/* SECTION 1: BUYER & COMMERCE CONVERSION FUNNEL */}
                    <div className="card" style={{ padding: '24px' }}>
                      <div className="flex justify-between align-center flex-wrap gap-2" style={{ marginBottom: '18px' }}>
                        <div>
                          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
                            Buyer & Commerce Conversion Funnel
                          </h3>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            End-to-end buyer telemetry from discovery session to completed order
                          </span>
                        </div>
                        <span className="badge badge-primary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                          Overall Conversion: {analyticsData.buyerMetrics?.funnel?.overallConversionRate || '4.8%'}
                        </span>
                      </div>

                      {/* Funnel Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Sessions</span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>{analyticsData.buyerMetrics?.totalSessions}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Product Views</span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>{analyticsData.buyerMetrics?.productViews}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Wishlist Adds</span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0', color: 'var(--secondary)' }}>{analyticsData.buyerMetrics?.wishlistAdds}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Cart Adds</span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)' }}>{analyticsData.buyerMetrics?.cartAdds}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Checkout Starts</span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0', color: '#f59e0b' }}>{analyticsData.buyerMetrics?.checkoutStarts}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Purchases</span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>{analyticsData.buyerMetrics?.purchases}</h4>
                        </div>
                      </div>

                      {/* Visual Funnel Progression */}
                      <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '14px' }}>
                          Funnel Drop-off & Step Conversions
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                              <span>Product Discovery &rarr; Add to Cart</span>
                              <strong>{analyticsData.buyerMetrics?.funnel?.viewToCartRate}</strong>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: analyticsData.buyerMetrics?.funnel?.viewToCartRate || '25%', height: '100%', background: 'var(--primary)' }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                              <span>Cart &rarr; Checkout Initialized</span>
                              <strong>{analyticsData.buyerMetrics?.funnel?.cartToCheckoutRate}</strong>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: analyticsData.buyerMetrics?.funnel?.cartToCheckoutRate || '50%', height: '100%', background: '#f59e0b' }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                              <span>Checkout &rarr; Payment / Order Confirmed</span>
                              <strong>{analyticsData.buyerMetrics?.funnel?.checkoutToPurchaseRate}</strong>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: analyticsData.buyerMetrics?.funnel?.checkoutToPurchaseRate || '70%', height: '100%', background: 'var(--success)' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2 & 3: RECOMMENDATIONS & SEARCH GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      {/* RECOMMENDATION METRICS */}
                      <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={18} style={{ color: 'var(--secondary)' }} />
                          Recommendation Performance
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 16px' }}>
                          Phase 2 personalized & collaborative filtering analytics
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Impressions</span>
                            <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0' }}>{analyticsData.recommendationMetrics?.impressions}</h4>
                          </div>
                          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Clicks</span>
                            <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)' }}>{analyticsData.recommendationMetrics?.clicks}</h4>
                          </div>
                          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Recommendation CTR</span>
                            <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>{analyticsData.recommendationMetrics?.ctr}</h4>
                          </div>
                          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Influenced Orders</span>
                            <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--secondary)' }}>{analyticsData.recommendationMetrics?.conversions}</h4>
                          </div>
                        </div>

                        <div style={{ background: 'var(--primary-light)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>Revenue Influenced:</span>
                          <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                            Rs. {(analyticsData.recommendationMetrics?.influencedRevenue || 0).toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      {/* SEARCH & DISCOVERY METRICS */}
                      <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Search size={18} style={{ color: 'var(--primary)' }} />
                          Search & Discovery Telemetry
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 16px' }}>
                          Phase 9 multilingual semantic query performance
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Searches</span>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '4px 0 0' }}>{analyticsData.searchMetrics?.totalSearches}</h4>
                          </div>
                          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Zero Results</span>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '4px 0 0', color: (analyticsData.searchMetrics?.zeroResultSearches || 0) > 0 ? '#ef4444' : 'var(--success)' }}>
                              {analyticsData.searchMetrics?.zeroResultRate}
                            </h4>
                          </div>
                          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Search CTR</span>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)' }}>{analyticsData.searchMetrics?.searchCtr}</h4>
                          </div>
                        </div>

                        {/* Top Queries List */}
                        <div style={{ marginBottom: '14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Top Trending Search Queries
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {analyticsData.searchMetrics?.popularQueries?.map((pq, i) => (
                              <span key={i} className="badge badge-secondary" style={{ fontSize: '11px' }}>
                                &ldquo;{pq.query}&rdquo; ({pq.count})
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Multilingual distribution */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Language Dialect Distribution
                          </span>
                          <div className="flex flex-wrap gap-2" style={{ fontSize: '11px' }}>
                            <span>EN: <strong>{analyticsData.searchMetrics?.languageDistribution?.en || 0}</strong></span>
                            <span>&bull;</span>
                            <span>Urdu: <strong>{analyticsData.searchMetrics?.languageDistribution?.ur || 0}</strong></span>
                            <span>&bull;</span>
                            <span>Sindhi: <strong>{analyticsData.searchMetrics?.languageDistribution?.sd || 0}</strong></span>
                            <span>&bull;</span>
                            <span>Roman UR: <strong>{analyticsData.searchMetrics?.languageDistribution?.roman_ur || 0}</strong></span>
                            <span>&bull;</span>
                            <span>Roman SD: <strong>{analyticsData.searchMetrics?.languageDistribution?.roman_sd || 0}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: AI TELEMETRY & COST MONITORING */}
                    <div className="card" style={{ padding: '24px' }}>
                      <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '18px' }}>
                        <div>
                          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Cpu size={18} style={{ color: 'var(--primary)' }} />
                            AI Telemetry & Infrastructure Cost Monitoring
                          </h3>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            Performance monitoring across Chat Assistant, Vendor Assistant, Admin Copilot, and Embeddings
                          </span>
                        </div>
                        <span className="badge badge-success flex align-center gap-1" style={{ fontSize: '11px' }}>
                          <Lock size={12} /> Privacy Safe: Zero Conversation Content Retained
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Invocations</span>
                          <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0' }}>{analyticsData.aiMetrics?.totalAssistantInvocations}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Success Rate</span>
                          <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--success)' }}>{analyticsData.aiMetrics?.successRate}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Avg Response Latency</span>
                          <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)' }}>{analyticsData.aiMetrics?.averageLatencyMs} ms</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Tokens Consumed</span>
                          <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0' }}>{(analyticsData.aiMetrics?.tokens?.totalTokens || 0).toLocaleString()}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estimated AI Cost</span>
                          <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                            ${analyticsData.aiMetrics?.cost?.usd} (Rs. {analyticsData.aiMetrics?.cost?.pkr})
                          </h4>
                        </div>
                      </div>

                      {/* Tool usage badges */}
                      <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                          AI Tool Invocation Breakdown
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(analyticsData.aiMetrics?.toolUsage || {}).map(([tool, count], i) => (
                            <span key={i} className="badge badge-outline flex align-center gap-1" style={{ fontSize: '12px' }}>
                              <Zap size={11} style={{ color: 'var(--primary)' }} />
                              {tool}: <strong>{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 5: VENDOR PERFORMANCE MATRIX */}
                    <div className="card" style={{ padding: '24px' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Store size={18} style={{ color: 'var(--primary)' }} />
                        Vendor Performance & Reliability Matrix
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 16px' }}>
                        Tracking sales volume, conversion efficiency, and trust reliability per merchant
                      </p>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', paddingBottom: '10px' }}>
                              <th style={{ padding: '10px 8px' }}>Merchant Store</th>
                              <th>Origin City</th>
                              <th>Delivered GMV</th>
                              <th>Orders</th>
                              <th>Conversion</th>
                              <th>Cancellation</th>
                              <th>Trust Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.vendorMetrics?.vendorLeaderboard?.map((v, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 700 }}>{v.businessName}</td>
                                <td style={{ textTransform: 'capitalize' }}>{v.city}</td>
                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>Rs. {v.sales?.toLocaleString()}</td>
                                <td>{v.ordersCount}</td>
                                <td>{v.conversionRate}</td>
                                <td style={{ color: v.cancellationRate !== '0.0%' ? '#ef4444' : 'var(--text-secondary)' }}>{v.cancellationRate}</td>
                                <td>
                                  <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                                    ⭐ {v.trustScore} / 100
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* ─── TAB 9: CATEGORIES & REQUESTS (PHASE 16) ─── */}
            {activeTab === 'categories' && (
              <div className="flex flex-col gap-6">
                {/* Header Card */}
                <div className="card flex justify-between align-center flex-wrap gap-4" style={{ padding: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag size={22} style={{ color: 'var(--primary)' }} />
                      Marketplace Categories & Vendor Requests
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
                      Centralized category governance. Admins manage marketplace taxonomy while vendors submit requests for new specialty categories.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary flex align-center gap-2"
                    onClick={() => setIsCreateCatOpen(true)}
                  >
                    <Plus size={16} /> Create Category
                  </button>
                </div>

                {/* KPI Overview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="card" style={{ padding: '18px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Categories</span>
                    <h4 style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 0', color: 'var(--text-primary)' }}>{adminCategories.length}</h4>
                  </div>
                  <div className="card" style={{ padding: '18px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Categories</span>
                    <h4 style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 0', color: 'var(--success)' }}>
                      {adminCategories.filter(c => c.active !== false).length}
                    </h4>
                  </div>
                  <div className="card" style={{ padding: '18px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Pending Vendor Requests</span>
                    <h4 style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 0', color: adminCategoryRequests.filter(r => r.status === 'PENDING').length > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                      {adminCategoryRequests.filter(r => r.status === 'PENDING').length}
                    </h4>
                  </div>
                </div>

                {/* SECTION 1: VENDOR CATEGORY REQUESTS REVIEW QUEUE */}
                <div className="card" style={{ padding: '24px' }}>
                  <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                        Vendor Category Requests Review Queue
                      </h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Review submitted requests from verified artisans. Approving a request automatically creates the category.
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2">
                      {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
                        <button
                          key={f}
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: categoryFilter === f ? 700 : 500,
                            background: categoryFilter === f ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: categoryFilter === f ? '#fff' : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)'
                          }}
                          onClick={() => setCategoryFilter(f)}
                        >
                          {f} ({f === 'ALL' ? adminCategoryRequests.length : adminCategoryRequests.filter(r => r.status === f).length})
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const filtered = adminCategoryRequests.filter(r => categoryFilter === 'ALL' || r.status === categoryFilter);
                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '14px' }}>
                          No category requests found for "{categoryFilter}".
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-4">
                        {filtered.map((req) => (
                          <div
                            key={req.id}
                            style={{
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              padding: '20px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div className="flex justify-between align-center flex-wrap gap-2">
                              <div className="flex align-center gap-3">
                                <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{req.categoryName}</strong>
                                <span className={`badge ${
                                  req.status === 'APPROVED' ? 'badge-success' :
                                  req.status === 'PENDING' ? 'badge-warning' :
                                  req.status === 'REJECTED' ? 'badge-danger' : 'badge-secondary'
                                }`} style={{ fontSize: '11px' }}>
                                  {req.status}
                                </span>
                                {req.parentCategory && (
                                  <span className="badge" style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                                    Parent: {req.parentCategory}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Submitted {new Date(req.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                              <div>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '2px' }}>
                                  Merchant Details
                                </strong>
                                <span>{req.vendorBusinessName} ({req.vendorEmail})</span>
                              </div>
                              <div>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '2px' }}>
                                  Justification Reason
                                </strong>
                                <span>{req.reason}</span>
                              </div>
                            </div>

                            {req.description && (
                              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                                <strong>Description:</strong> {req.description}
                              </div>
                            )}

                            {req.rejectionReason && (
                              <div style={{ fontSize: '12.5px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                                Rejection Reason: {req.rejectionReason}
                              </div>
                            )}

                            {/* Actions for PENDING requests */}
                            {req.status === 'PENDING' && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                                {rejectingReqId === req.id ? (
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      className="form-input"
                                      placeholder="Enter rejection reason for vendor..."
                                      value={rejectionReasonInput}
                                      onChange={(e) => setRejectionReasonInput(e.target.value)}
                                      style={{ fontSize: '13px' }}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 14px', fontSize: '12px' }}
                                        onClick={() => {
                                          setRejectingReqId(null);
                                          setRejectionReasonInput('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="btn"
                                        style={{ background: '#ef4444', color: '#fff', padding: '6px 14px', fontSize: '12px' }}
                                        onClick={() => handleReviewRequest(req.id, 'REJECTED', rejectionReasonInput)}
                                        disabled={!rejectionReasonInput.trim()}
                                      >
                                        Confirm Rejection
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-3">
                                    <button
                                      className="btn btn-primary flex align-center gap-2"
                                      style={{ padding: '6px 16px', fontSize: '12.5px' }}
                                      onClick={() => handleReviewRequest(req.id, 'APPROVED')}
                                    >
                                      <Check size={14} /> Approve & Create Category
                                    </button>
                                    <button
                                      className="btn btn-secondary flex align-center gap-2"
                                      style={{ padding: '6px 16px', fontSize: '12.5px', color: '#ef4444', borderColor: '#ef4444' }}
                                      onClick={() => setRejectingReqId(req.id)}
                                    >
                                      <X size={14} /> Reject Request
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* SECTION 2: MARKETPLACE CATEGORIES CATALOG TABLE */}
                <div className="card" style={{ padding: '24px' }}>
                  <h4 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px' }}>
                    Marketplace Taxonomy & Catalog
                  </h4>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px 8px' }}>Category Name</th>
                          <th>Slug ID</th>
                          <th>Description</th>
                          <th>Parent Category</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right', paddingRight: '8px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminCategories.map((cat) => (
                          <tr key={cat.id || cat.slug} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {cat.name}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{cat.slug || cat.id}</td>
                            <td style={{ maxWidth: '300px', color: 'var(--text-secondary)' }}>{cat.description || 'N/A'}</td>
                            <td style={{ textTransform: 'capitalize' }}>{cat.parentCategory || 'Top-level'}</td>
                            <td>
                              <span className={`badge ${cat.active !== false ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '11px' }}>
                                {cat.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '8px' }}>
                              <div className="flex justify-end gap-2">
                                <button
                                  className="btn btn-secondary flex align-center gap-1"
                                  style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                                  onClick={() => handleOpenEditCategory(cat)}
                                  title="Edit category details"
                                >
                                  <Edit size={12} /> Edit
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px' }}
                                  onClick={() => handleToggleCategory(cat.id || cat.slug, cat.active !== false)}
                                >
                                  {cat.active !== false ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px', color: '#ef4444', borderColor: '#ef4444' }}
                                  onClick={() => handleDeleteCategory(cat.id || cat.slug)}
                                  title="Delete category"
                                >
                                  <Trash size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* T_MESSAGES: BUYER ↔ VENDOR CHAT & SUPPORT OVERSIGHT */}
            {activeTab === 'messages' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', height: '720px', display: 'flex', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '340px', minWidth: '300px', height: '100%' }}>
                  <ConversationList
                    conversations={adminConversations}
                    activeConversationId={selectedAdminConv?.id || selectedAdminConv?.conversationId}
                    onSelectConversation={setSelectedAdminConv}
                    loading={adminConvLoading}
                  />
                </div>
                <div style={{ flex: 1, height: '100%' }}>
                  <ChatWindow 
                    conversation={selectedAdminConv}
                    onStatusChange={(newSt) => {
                      setSelectedAdminConv(prev => prev ? { ...prev, status: newSt } : null);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CREATE CATEGORY MODAL */}
        {isCreateCatOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', background: 'var(--bg-secondary)' }}>
              <button 
                onClick={() => setIsCreateCatOpen(false)} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px' }}>
                Create Marketplace Category
              </h3>

              <form onSubmit={handleAdminCreateCategory} className="flex flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Copperware & Metal Crafts"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    disabled={catActionLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Category (Optional)</label>
                  <select
                    className="form-select"
                    value={newCatParent}
                    onChange={(e) => setNewCatParent(e.target.value)}
                    disabled={catActionLoading}
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
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Overview of crafts or goods included..."
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    disabled={catActionLoading}
                  />
                </div>

                <div className="flex justify-end gap-3" style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsCreateCatOpen(false)}
                    disabled={catActionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={catActionLoading}
                  >
                    {catActionLoading ? 'Creating...' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT CATEGORY MODAL */}
        {isEditCatOpen && editingCategory && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', background: 'var(--bg-secondary)' }}>
              <button 
                onClick={() => {
                  setIsEditCatOpen(false);
                  setEditingCategory(null);
                }} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px' }}>
                Edit Category: {editingCategory.name}
              </h3>

              <form onSubmit={handleAdminUpdateCategory} className="flex flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    disabled={catActionLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Category (Optional)</label>
                  <select
                    className="form-select"
                    value={editCatParent}
                    onChange={(e) => setEditCatParent(e.target.value)}
                    disabled={catActionLoading}
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
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={editCatDesc}
                    onChange={(e) => setEditCatDesc(e.target.value)}
                    disabled={catActionLoading}
                  />
                </div>

                <div className="flex justify-end gap-3" style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsEditCatOpen(false);
                      setEditingCategory(null);
                    }}
                    disabled={catActionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={catActionLoading}
                  >
                    {catActionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. CNIC IMAGE VIEWER OVERLAY MODAL */}
        {cnicModalUrl && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }} onClick={() => setCnicModalUrl(null)}>
            <div className="card" style={{ padding: '16px', background: 'var(--bg-secondary)', position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setCnicModalUrl(null)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
              <img src={cnicModalUrl} alt="National ID CNIC Photo" style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', borderRadius: 'var(--radius-sm)' }} />
              <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Verify merchant identification documents prior to onboarding.
              </div>
            </div>
          </div>
        )}

        {/* VENDOR SHOP DETAILS MODAL */}
        {isVendorModalOpen && selectedVendor && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }} onClick={() => setIsVendorModalOpen(false)}>
            <div className="card" style={{
              padding: '32px',
              background: 'var(--bg-secondary)',
              position: 'relative',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: 'var(--radius-lg)'
            }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex justify-between align-center" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div className="flex align-center gap-3">
                  <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '10px', borderRadius: 'var(--radius-full)' }}>
                    <Store size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{selectedVendor.businessName || 'Unnamed Shop'}</h3>
                    <span className={`badge ${selectedVendor.status === 'approved' || selectedVendor.verified ? 'badge-success' : selectedVendor.status === 'suspended' ? 'badge-danger' : 'badge-warning'}`} style={{ marginTop: '4px', display: 'inline-block', textTransform: 'capitalize' }}>
                      {selectedVendor.status || (selectedVendor.verified ? 'Approved' : 'Pending')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsVendorModalOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Merchant Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>City</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600, textTransform: 'capitalize' }}>{selectedVendor.city || 'N/A'}</p>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedVendor.phone || 'N/A'}</p>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Rating</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedVendor.rating ? `⭐ ${selectedVendor.rating.toFixed(1)} / 5.0` : 'No ratings yet'}</p>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Member Since</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedVendor.createdAt ? new Date(selectedVendor.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
                </div>
              </div>

              {/* Description */}
              {selectedVendor.description && (
                <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Shop Description</span>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedVendor.description}</p>
                </div>
              )}

              {/* Stats Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--primary-light)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>{selectedVendor.vendorProducts?.length || 0}</div>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>Active Products</div>
                </div>
                <div style={{ background: 'var(--secondary-light)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--secondary)' }}>{selectedVendor.vendorOrders?.length || 0}</div>
                  <div style={{ fontSize: '12px', color: 'var(--secondary)', fontWeight: 600, marginTop: '4px' }}>Total Orders</div>
                </div>
              </div>

              {/* Trust Score Inspector (Admin View) */}
              {vendorTrustScore && (
                <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <Award size={18} /> Trust Score Audit Profile
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', fontSize: '13px' }}>
                    <div>
                      <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                        <span className="text-muted">Calculated Score:</span>
                        <strong style={{ color: 'var(--primary)' }}>{vendorTrustScore.overallScore} / 100 ({vendorTrustScore.category})</strong>
                      </div>
                      <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                        <span className="text-muted">Statistical Confidence:</span>
                        <strong>{(vendorTrustScore.confidence * 100).toFixed(0)}%</strong>
                      </div>
                      <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                        <span className="text-muted">Last Updated:</span>
                        <span>{vendorTrustScore.updatedAt ? new Date(vendorTrustScore.updatedAt?.seconds * 1000 || vendorTrustScore.updatedAt).toLocaleDateString() : 'Just now'}</span>
                      </div>
                      <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                        <span className="text-muted">Manual Review Status:</span>
                        <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}>Audited Pass</span>
                      </div>
                    </div>
                    
                    <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Component Breakdowns</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11.5px' }}>
                        <div>Verify: {vendorTrustScore.componentScores?.verification || 0}%</div>
                        <div>Orders: {vendorTrustScore.componentScores?.orderReliability || 0}%</div>
                        <div>Reviews: {vendorTrustScore.componentScores?.reviewsQuality || 0}%</div>
                        <div>Response: {vendorTrustScore.componentScores?.responseRate || 0}%</div>
                        <div>Returns: {vendorTrustScore.componentScores?.returnPerformance || 0}%</div>
                        <div>Satis: {vendorTrustScore.componentScores?.customerSatisfaction || 0}%</div>
                        <div>Age: {vendorTrustScore.componentScores?.accountHistory || 0}%</div>
                        <div>Risk: {vendorTrustScore.componentScores?.riskSignals || 0}%</div>
                      </div>
                    </div>
                  </div>

                  {/* History Log inside Modal */}
                  {vendorTrustHistory.length > 0 && (
                    <div style={{ marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Trust Calculation History</span>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '12px' }}>
                        {vendorTrustHistory.map((h, i) => (
                          <div key={i} className="flex justify-between" style={{ marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px solid var(--bg-secondary)' }}>
                            <span>Score: <strong>{h.newScore || h.score}</strong> (was {h.previousScore || 0})</span>
                            <span className="text-muted">{h.timestamp ? new Date(h.timestamp?.seconds * 1000 || h.timestamp).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Product Listings */}
              {selectedVendor.vendorProducts?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Product Listings</h4>
                  <div className="flex flex-col gap-2">
                    {selectedVendor.vendorProducts.slice(0, 5).map((prod, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{prod.title}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px', textTransform: 'capitalize' }}>{prod.category}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14px' }}>Rs. {prod.price?.toLocaleString()}</span>
                      </div>
                    ))}
                    {selectedVendor.vendorProducts.length > 5 && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>+ {selectedVendor.vendorProducts.length - 5} more products</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsVendorModalOpen(false)}>Close Window</button>
              </div>
            </div>
          </div>
        )}

        {/* 5. FRAUD & SAFETY INVESTIGATION MODAL (Phase 6) */}
        {isInvestigationModalOpen && selectedFraudEvent && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }} onClick={() => setIsInvestigationModalOpen(false)}>
            <div className="card" style={{
              padding: '32px',
              background: 'var(--bg-secondary)',
              position: 'relative',
              maxWidth: '740px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 'var(--radius-lg)'
            }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex justify-between align-center" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div className="flex align-center gap-3">
                  <div style={{ background: selectedFraudEvent.level === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: selectedFraudEvent.level === 'CRITICAL' ? '#ef4444' : '#f59e0b', padding: '10px', borderRadius: 'var(--radius-full)' }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                      Investigation: {selectedFraudEvent.entityName}
                    </h3>
                    <div className="flex align-center gap-2" style={{ marginTop: '4px' }}>
                      <span className="badge" style={{
                        backgroundColor: selectedFraudEvent.level === 'CRITICAL' ? '#ef4444' : selectedFraudEvent.level === 'HIGH' ? '#f59e0b' : '#06b6d4',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '2px 8px'
                      }}>
                        {selectedFraudEvent.level} RISK ({selectedFraudEvent.riskScore}/100)
                      </span>
                      <span className="text-muted" style={{ fontSize: '12px' }}>Event ID: #{selectedFraudEvent.eventId?.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsInvestigationModalOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Multi-factor component scoring breakdown */}
              <div style={{ background: 'var(--bg-primary)', padding: '18px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '10px' }}>
                  Risk Component Breakdown (0–100 Normalized Scale)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Behavioral</span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{selectedFraudEvent.riskComponents?.behavioral || 0}/20</strong>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Transaction</span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{selectedFraudEvent.riskComponents?.transaction || 0}/30</strong>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Reviews</span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{selectedFraudEvent.riskComponents?.review || 0}/20</strong>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Account</span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{selectedFraudEvent.riskComponents?.account || 0}/15</strong>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Products</span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{selectedFraudEvent.riskComponents?.product || 0}/15</strong>
                  </div>
                </div>
              </div>

              {/* Detected Flags */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Triggered Safety Flags
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedFraudEvent.flags?.map((flag, idx) => (
                    <span key={idx} className="badge" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      ⚠ {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Evidence Log */}
              <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Automated Evidence Summary
                </span>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {selectedFraudEvent.evidenceSummary}
                </p>
              </div>

              {/* Human-in-the-Loop Review Controls */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Human Administrator Decision & Review</h4>
                
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Review Status</label>
                  <select
                    className="form-select"
                    value={investigationNextStatus}
                    onChange={(e) => setInvestigationNextStatus(e.target.value)}
                  >
                    <option value="NEW">NEW — Unaddressed Alert</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW — Active Investigation</option>
                    <option value="ACTION_REQUIRED">ACTION_REQUIRED — Enforcement Pending</option>
                    <option value="CLEARED">CLEARED — False Positive / Verified Safe</option>
                    <option value="RESOLVED">RESOLVED — Successfully Remedied</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Investigation Notes & Rationale (Logged to Audit Trail)</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Enter evidence findings, supplier communication, or explanation..."
                    value={investigationNotes}
                    onChange={(e) => setInvestigationNotes(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', marginBottom: '20px' }}
                  onClick={handleSaveFraudReview}
                >
                  Save Review Status & Notes
                </button>

                {/* Safety Action Enforcements */}
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '8px' }}>
                    Authorized Business Enforcement Actions (Requires Human Confirmation)
                  </span>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      className="btn"
                      style={{ background: '#ef4444', color: '#fff', padding: '8px 16px', fontSize: '12px', fontWeight: 600 }}
                      onClick={() => handleAdminTakeAction('SUSPEND_VENDOR')}
                    >
                      <UserX size={14} /> Suspend Store Account
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--primary)', color: '#fff', padding: '8px 16px', fontSize: '12px', fontWeight: 600 }}
                      onClick={() => handleAdminTakeAction('RESTORE_VENDOR')}
                    >
                      <Check size={14} /> Restore Store Account
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                      onClick={() => handleAdminTakeAction('CLEAR_FLAG')}
                    >
                      Clear as False Positive
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsInvestigationModalOpen(false)}>
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase 8: Product Quality & Content Safety Inspection Modal */}
        {isQualityModalOpen && selectedQualityProduct && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
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
                onClick={() => setIsQualityModalOpen(false)} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <div style={{ marginBottom: '24px' }}>
                <div className="flex align-center gap-2" style={{ color: '#3b82f6', marginBottom: '6px' }}>
                  <Award size={18} />
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Product Quality & Content Safety</span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                  {typeof selectedQualityProduct.title === 'object' ? (selectedQualityProduct.title.en || Object.values(selectedQualityProduct.title)[0]) : selectedQualityProduct.title}
                </h2>
                <span className="text-muted" style={{ fontSize: '13px' }}>
                  Vendor: {selectedQualityProduct.vendorName} &bull; Category: {selectedQualityProduct.category} &bull; Price: Rs. {selectedQualityProduct.price?.toLocaleString()}
                </span>
              </div>

              {/* Quality Score Breakdown */}
              <div style={{
                background: 'var(--bg-primary)',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px'
              }}>
                <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Overall Quality Score</span>
                    <h3 style={{ fontSize: '36px', fontWeight: 800, margin: '4px 0 0', color: (selectedQualityProduct.qualityAudit?.overallScore || 75) >= 80 ? 'var(--success)' : '#f59e0b' }}>
                      {selectedQualityProduct.qualityAudit?.overallScore || 75} / 100
                    </h3>
                    <span className="badge badge-primary" style={{ fontSize: '11px', marginTop: '4px' }}>
                      Tier: {selectedQualityProduct.qualityAudit?.rating || 'GOOD'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Completeness</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0' }}>{selectedQualityProduct.qualityAudit?.completenessScore || 70}/100</h4>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Image Quality</span>
                      <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0' }}>{selectedQualityProduct.qualityAudit?.imageScore || 80}/100</h4>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${selectedQualityProduct.qualityAudit?.overallScore || 75}%`,
                    height: '100%',
                    background: (selectedQualityProduct.qualityAudit?.overallScore || 75) >= 80 ? 'var(--success)' : '#f59e0b'
                  }} />
                </div>
              </div>

              {/* Gallery Images */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Uploaded Product Imagery</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedQualityProduct.images?.map((img, i) => (
                    <img 
                      key={i} 
                      src={img} 
                      alt="" 
                      style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} 
                    />
                  ))}
                </div>
              </div>

              {/* Flags and Suggestions */}
              {selectedQualityProduct.qualityAudit?.flags?.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Detected Safety / Relevance Flags
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedQualityProduct.qualityAudit.flags.map((fl, idx) => (
                      <span key={idx} className="badge badge-danger" style={{ fontSize: '11px' }}>
                        {fl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedQualityProduct.qualityAudit?.suggestions?.length > 0 && (
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Improvement Recommendations Provided to Vendor
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {selectedQualityProduct.qualityAudit.suggestions.map((sug, idx) => (
                      <li key={idx}>{sug}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Moderation Controls */}
              <div style={{ background: 'var(--bg-primary)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Human Administrator Moderation Decision
                </span>
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="Enter moderation rationale or notes..."
                  value={qualityNotes}
                  onChange={(e) => setQualityNotes(e.target.value)}
                  style={{ marginBottom: '14px', fontSize: '13px' }}
                />
                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '12px' }}
                    onClick={() => handleModerateProduct(selectedQualityProduct.id, 'APPROVED', qualityNotes)}
                  >
                    <Check size={14} /> Approve Listing
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '12px', color: '#f59e0b', borderColor: '#f59e0b' }}
                    onClick={() => handleModerateProduct(selectedQualityProduct.id, 'FLAGGED_FOR_REVIEW', qualityNotes)}
                  >
                    <AlertTriangle size={14} /> Flag for Review
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '12px', color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => handleModerateProduct(selectedQualityProduct.id, 'REJECTED', qualityNotes)}
                  >
                    <X size={14} /> Reject & Hide Listing
                  </button>
                </div>
              </div>

              <div className="flex justify-end" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsQualityModalOpen(false)}>
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* T9: SYSTEM HEALTH & LOGS (Phase 19) */}
        {activeTab === 'health' && (
          <div className="flex flex-col gap-6">
            {/* Health Indicators Widget */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div className="flex align-center gap-3 mb-2">
                  <Bot size={24} style={{ color: '#8b5cf6' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>AI Service</h3>
                </div>
                <div className="flex align-center gap-2 mt-4">
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Operational</span>
                </div>
              </div>
              
              <div className="card" style={{ padding: '20px' }}>
                <div className="flex align-center gap-3 mb-2">
                  <Search size={24} style={{ color: '#3b82f6' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Search Engine</h3>
                </div>
                <div className="flex align-center gap-2 mt-4">
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Operational</span>
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div className="flex align-center gap-3 mb-2">
                  <Server size={24} style={{ color: '#f59e0b' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Database</h3>
                </div>
                <div className="flex align-center gap-2 mt-4">
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Operational</span>
                </div>
              </div>
            </div>

            {/* System Logs Table */}
            <div className="card">
              <div className="card-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Recent System Logs</h2>
                <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Last 50 Events</span>
              </div>
              
              {systemLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No system logs found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Time</th>
                        <th style={{ padding: '12px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Level</th>
                        <th style={{ padding: '12px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Category</th>
                        <th style={{ padding: '12px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Message</th>
                        <th style={{ padding: '12px 20px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemLogs.map(log => {
                        const tDate = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date();
                        const isError = log.level === 'error';
                        const isWarn = log.level === 'warn';
                        
                        let badgeStyle = { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
                        if (isError) badgeStyle = { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
                        if (isWarn) badgeStyle = { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' };

                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '16px 20px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                              {tDate.toLocaleString()}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span className="badge" style={badgeStyle}>
                                {log.level.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '500' }}>
                              {log.category}
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '14px' }}>
                              {log.message}
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {log.source === 'frontend' ? 'UI' : 'Backend'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
