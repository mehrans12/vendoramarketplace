import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext'; // In-app notification feeds
import EmailVerificationBanner from './EmailVerificationBanner'; // Verification alert banner
import { Search, ShoppingCart, User, Store, LogOut, Package, Bell, Shield, History, Sparkles, TrendingUp, X, ArrowUpRight, MessageSquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { 
  getRecentSearches, 
  saveRecentSearch, 
  clearRecentSearches, 
  POPULAR_SEARCHES, 
  normalizeClientQuery, 
  intelligentClientSearch 
} from '../services/search/intelligentSearch';
import { getMarketplaceProducts } from '../utils/productSync';
import { subscribeToUserConversations } from '../services/chat/chatService';

export default function Header() {
  const navigate = useNavigate();
  const searchContainerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Intelligent Search States (Phase 9)
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [liveSuggestions, setLiveSuggestions] = useState([]);
  const [didYouMean, setDidYouMean] = useState(null);

  const { currentUser, userProfile, role: userRole, logout } = useAuth();
  const { cartCount } = useCart();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { language, setLanguage, t } = useLanguage();

  // PWA installation triggers
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User installation choice outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Load per-user isolated recent searches and catalog products
  useEffect(() => {
    setRecentSearches(getRecentSearches(currentUser?.uid));
    getMarketplaceProducts().then(prods => setCatalogProducts(prods)).catch(() => {});
  }, [currentUser]);

  // Real-time Chat Unread Count listener
  const [totalChatUnread, setTotalChatUnread] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setTotalChatUnread(0);
      return;
    }
    const unsub = subscribeToUserConversations(
      { userId: currentUser.uid, role: userRole },
      (convs) => {
        const total = convs.reduce((acc, c) => {
          const u = userRole === 'vendor' ? c.vendorUnreadCount : userRole === 'admin' ? c.adminUnreadCount : c.buyerUnreadCount;
          return acc + (u || 0);
        }, 0);
        setTotalChatUnread(total);
      }
    );
    return () => unsub();
  }, [currentUser, userRole]);

  // Click outside to dismiss search popup
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced real-time suggestions & spell-check
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLiveSuggestions([]);
      setDidYouMean(null);
      return;
    }

    const timer = setTimeout(() => {
      const { corrected, hasCorrection } = normalizeClientQuery(searchQuery);
      setDidYouMean(hasCorrection ? corrected : null);

      if (catalogProducts.length > 0) {
        const matches = intelligentClientSearch(catalogProducts, searchQuery);
        setLiveSuggestions(matches.slice(0, 4));
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery, catalogProducts]);

  const executeSearch = (term) => {
    const cleanTerm = (term !== undefined ? term : searchQuery).trim();
    if (!cleanTerm) return;
    saveRecentSearch(currentUser?.uid, cleanTerm);
    setRecentSearches(getRecentSearches(currentUser?.uid));
    setSearchFocused(false);
    setSearchQuery(cleanTerm);
    navigate(`/category/all?search=${encodeURIComponent(cleanTerm)}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <header className="main-header" style={{ position: 'relative' }}>
      {/* Unverified Email Alert Banner */}
      <EmailVerificationBanner />

      {/* Top micro banner */}
      <div className="header-top">
        <div className="container flex justify-between align-center">
          <div>{t('nav.topBanner')}</div>
          <div className="flex gap-4 align-center">
            {deferredPrompt && (
              <button
                onClick={handleInstallApp}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginRight: '8px'
                }}
              >
                Install App
              </button>
            )}

            {/* Language Switcher Dropdown Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                <option value="en" style={{ color: '#000' }}>English</option>
                <option value="ur" style={{ color: '#000' }}>اردو</option>
                <option value="sd" style={{ color: '#000' }}>سنڌي</option>
              </select>
            </div>

            {userRole === 'vendor' ? (
              <span className="badge badge-primary">Vendor Mode</span>
            ) : (
              <Link to="/signup?role=vendor" className="flex align-center gap-2" style={{ color: 'var(--secondary)' }}>
                <Store size={14} /> {t('home.registerVendor')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Header area */}
      <div className="header-main">
        <div className="container flex align-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="logo-container">
            <Store size={28} className="logo-accent" />
            <span>VEND<span className="logo-accent">ORA</span></span>
          </Link>

          {/* Intelligent Search bar & Dropdown (Phase 9) */}
          <div ref={searchContainerRef} style={{ position: 'relative', flex: 1, maxWidth: '580px' }}>
            <form className="search-bar-container" onSubmit={handleSearch} style={{ margin: 0, width: '100%' }}>
              <input
                type="text"
                className="search-input"
                placeholder={t('nav.searchPlaceholder')}
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 8px' }}
                >
                  <X size={15} />
                </button>
              )}
              <button type="submit" className="search-btn" title="Search Marketplace">
                <Search size={18} />
              </button>
            </form>

            {/* Suggestions & Autocomplete Dropdown */}
            {searchFocused && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                zIndex: 1000,
                overflow: 'hidden',
                maxHeight: '440px',
                overflowY: 'auto'
              }}>
                {/* 1. "Did You Mean" Spelling Correction */}
                {didYouMean && (
                  <div style={{
                    padding: '10px 16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>
                      Did you mean: <strong style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => executeSearch(didYouMean)}>{didYouMean}</strong>?
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                      onClick={() => executeSearch(didYouMean)}
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* 2. Live Matching Products Preview */}
                {liveSuggestions.length > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      Products Matching "{searchQuery}"
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {liveSuggestions.map(prod => (
                        <div
                          key={prod.id}
                          onClick={() => { setSearchFocused(false); navigate(`/product/${prod.id}`); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <img
                            src={prod.images?.[0] || 'https://placehold.co/40x40?text=Item'}
                            alt=""
                            style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                              {typeof prod.title === 'object' ? (prod.title.en || Object.values(prod.title)[0]) : prod.title}
                            </strong>
                            <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                              Rs. {prod.price?.toLocaleString()}
                            </span>
                          </div>
                          <ArrowUpRight size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Recent Searches (Isolated per user) */}
                {recentSearches.length > 0 && !searchQuery && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                      <span className="flex align-center gap-1" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        <History size={13} /> Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={() => { clearRecentSearches(currentUser?.uid); setRecentSearches([]); }}
                        style={{ background: 'transparent', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => executeSearch(term)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            fontSize: '12px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                          }}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Trending & Popular Searches */}
                <div style={{ padding: '12px 16px' }}>
                  <span className="flex align-center gap-1" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <TrendingUp size={13} /> Popular In Pakistan
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_SEARCHES.map((pop, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => executeSearch(pop.text)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        {pop.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation controls */}
          <nav className="header-nav" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Vendor Dashboard Link */}
            {userRole === 'vendor' && (
              <Link to="/vendor/dashboard" className="nav-item">
                <Store size={22} />
                <span>{t('nav.vendorDashboard')}</span>
              </Link>
            )}

            {/* Admin Dashboard Link (Only visible when logged in as admin) */}
            {userRole === 'admin' && (
              <Link to="/admin/dashboard" className="nav-item" style={{ color: '#f59e0b' }}>
                <Shield size={22} />
                <span>{t('nav.adminDashboard')}</span>
              </Link>
            )}

            {/* Buyer Orders History */}
            {currentUser && userRole !== 'vendor' && (
              <Link to="/my-orders" className="nav-item">
                <Package size={22} />
                <span>{t('nav.orders')}</span>
              </Link>
            )}

            {/* Real-time Messages Hub Link */}
            {currentUser && (
              <Link to="/messages" className="nav-item" style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <MessageSquare size={22} />
                  {totalChatUnread > 0 && (
                    <span
                      className="cart-badge"
                      style={{ backgroundColor: 'var(--primary)', color: '#fff', top: '-6px', right: '-6px' }}
                    >
                      {totalChatUnread}
                    </span>
                  )}
                </div>
                <span>Messages</span>
              </Link>
            )}

            {/* Notification Bell Icon */}
            {currentUser && (
              <div
                className="nav-item"
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => setIsNotifOpen(!isNotifOpen)}
              >
                <div style={{ position: 'relative' }}>
                  <Bell size={22} />
                  {unreadCount > 0 && (
                    <span
                      className="cart-badge"
                      style={{ backgroundColor: 'var(--secondary)', color: '#fff', top: '-6px', right: '-6px' }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span>{t('nav.alerts')}</span>

                {/* Notifications Dropdown Container */}
                {isNotifOpen && (
                  <div
                    className="card"
                    style={{
                      position: 'absolute',
                      top: '48px',
                      right: language === 'en' ? '-80px' : 'auto',
                      left: language !== 'en' ? '-80px' : 'auto',
                      width: '320px',
                      maxHeight: '380px',
                      overflowY: 'auto',
                      zIndex: 9999,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      padding: '12px 0',
                      cursor: 'default',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-hover)'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex justify-between align-center" style={{ padding: '0 16px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14px' }}>Notifications</strong>
                      {unreadCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAllAsRead();
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No notifications yet.
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              markAsRead(n.id);
                              if (n.link) {
                                navigate(n.link);
                              } else if (n.orderId) {
                                navigate(userRole === 'vendor' ? '/vendor/dashboard' : '/my-orders');
                              }
                              setIsNotifOpen(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              backgroundColor: n.read ? 'transparent' : 'var(--bg-tertiary)',
                              transition: 'background-color 0.2s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              textAlign: 'left'
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = n.read ? 'transparent' : 'var(--bg-tertiary)'}
                          >
                            <span style={{ fontSize: '12.5px', fontWeight: n.read ? 'normal' : '700' }}>{n.title}</span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{n.message}</span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Account controls */}
            {currentUser ? (
              <div className="flex align-center gap-4">
                <Link to="/profile" className="nav-item" title="View Profile">
                  <User size={22} />
                  <span style={{ fontSize: '11px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userProfile?.name || currentUser.displayName || currentUser.email}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="btn-icon"
                  style={{ background: 'transparent', border: 'none', color: '#fca5a5', padding: '4px', cursor: 'pointer' }}
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="nav-item">
                <User size={22} />
                <span>{t('nav.login')}</span>
              </Link>
            )}

            {/* Cart Icon */}
            <Link to="/cart" className="nav-item">
              <div style={{ position: 'relative' }}>
                <ShoppingCart size={22} />
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </div>
              <span>{t('nav.cart')}</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
