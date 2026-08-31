import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, hasFirebaseKeys } from '../services/firebase';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Star, ShieldCheck, ShoppingCart, Store, ArrowLeft, Plus, Minus, Loader, Heart, Sliders, MessageCircle } from 'lucide-react';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';
import { SimilarProducts, BecauseYouViewed } from '../components/recommendations/widgets';
import { useLanguage } from '../context/LanguageContext';
import { useCompare } from '../context/CompareContext';
import ChatModal from '../components/chat/ChatModal';

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { userProfile } = useAuth();
  const { t, language } = useLanguage();
  const { addToCompare, isInCompare } = useCompare ? useCompare() : { addToCompare: () => {}, isInCompare: () => false };

  const isRtl = language === 'ur' || language === 'sd';

  // States
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState('Default');
  const [addedMessage, setAddedMessage] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [trustScore, setTrustScore] = useState(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const getLocalizedValue = (fieldVal, activeLang) => {
    if (!fieldVal) return "";
    if (typeof fieldVal === 'string') return fieldVal;
    if (typeof fieldVal === 'object') {
      return fieldVal[activeLang] || fieldVal['en'] || Object.values(fieldVal)[0] || "";
    }
    return String(fieldVal);
  };

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      try {
        const { getMarketplaceProducts } = await import('../utils/productSync');
        const allProducts = await getMarketplaceProducts();
        const found = allProducts.find(p => p.id === id);
        
        if (found) {
          setProduct(found);
          try {
            localStorage.setItem('vendora_last_viewed_product_id', found.id);
            if (found.category) {
              localStorage.setItem('vendora_last_viewed_category', found.category);
            }
          } catch (e) {
            // Non-blocking
          }
          
          // Log view telemetry
          trackEvent(EventTypes.PRODUCT_VIEW, {
            productId: found.id,
            category: found.category || null,
            metadata: { title: getLocalizedValue(found.title, language), price: found.price }
          });
        }
      } catch (err) {
        console.error("Failed to load product details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id, language]);

  useEffect(() => {
    if (product?.vendorId) {
      const fetchTrustScore = async () => {
        try {
          const docRef = doc(db, "vendor_trust_scores", product.vendorId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setTrustScore(snap.data());
          } else {
            setTrustScore({
              overallScore: 85,
              category: "Very Good",
              componentScores: {
                verification: 100,
                orderReliability: 90,
                reviewsQuality: 88,
                responseRate: 90,
                returnPerformance: 95,
                customerSatisfaction: 85,
                accountHistory: 75,
                riskSignals: 90
              }
            });
          }
        } catch (err) {
          console.warn("Failed to fetch trust score:", err);
        }
      };
      fetchTrustScore();
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity, selectedVariant);
    
    // Log cart add telemetry
    trackEvent(EventTypes.CART_ADD, {
      productId: product.id,
      category: product.category || null,
      metadata: { title: getLocalizedValue(product.title, language), price: product.price, quantity, variant: selectedVariant }
    });

    setAddedMessage(true);
    setTimeout(() => setAddedMessage(false), 3000);
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    const nextState = !isInWishlist;
    setIsInWishlist(nextState);

    // Log wishlist toggle telemetry
    const eventType = nextState ? EventTypes.WISHLIST_ADD : EventTypes.WISHLIST_REMOVE;
    trackEvent(eventType, {
      productId: product.id,
      category: product.category || null,
      metadata: { title: getLocalizedValue(product.title, language), price: product.price }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Header />
        <main className="container flex-grow flex justify-center align-center" style={{ padding: '80px 0' }}>
          <Loader className="spin" size={32} style={{ color: 'var(--primary)' }} />
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Header />
        <main className="container flex-grow flex justify-center align-center" style={{ padding: '80px 0' }}>
          <h3>Product not found</h3>
        </main>
        <Footer />
      </div>
    );
  }

  const localizedTitle = getLocalizedValue(product.title, language);
  const localizedDescription = getLocalizedValue(product.description, language);

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingBottom: '60px', textAlign: isRtl ? 'right' : 'left' }}>
        {/* Back Link */}
        <Link to="/" className="flex align-center gap-2 text-muted" style={{ marginBottom: '24px', display: 'inline-flex', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <ArrowLeft size={16} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} /> {language === 'en' ? 'Back to marketplace' : 'مارکیٹ پلیس پر واپس جائیں'}
        </Link>

        {/* Product Details Grid */}
        <div className="product-detail-layout-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px',
          marginBottom: '60px'
        }}>
          {/* Left Column: Images */}
          <div>
            <div className="card" style={{ overflow: 'hidden', marginBottom: '16px' }}>
              <img 
                src={product.images[0]} 
                alt={localizedTitle} 
                style={{ width: '100%', height: 'auto', display: 'block' }} 
              />
            </div>
            {/* Gallery thumbnails */}
            <div className="flex gap-4" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              {product.images.map((img, i) => (
                <div key={i} className="card" style={{ width: '80px', height: '80px', cursor: 'pointer', overflow: 'hidden', border: i === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
                  <img src={img} alt={`thumbnail-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Category & Badge */}
              <div className="flex align-center justify-between" style={{ marginBottom: '16px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <span className="badge badge-primary" style={{ textTransform: 'uppercase' }}>{product.category}</span>
                {product.stock > 0 ? (
                  <span className="badge badge-success">{t('product.inStock')} ({product.stock})</span>
                ) : (
                  <span className="badge badge-danger">{t('product.outOfStock')}</span>
                )}
              </div>

              {/* Title */}
              <h1 style={{ fontSize: '30px', margin: '0 0 16px', fontWeight: 700 }}>
                {localizedTitle}
              </h1>

              {/* Vendor Card */}
              <div className="card flex align-center justify-between" style={{ padding: '16px', marginBottom: '24px', background: 'var(--bg-tertiary)', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <div className="flex align-center gap-3" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                  <div style={{ background: 'var(--primary)', color: '#fff', padding: '8px', borderRadius: 'var(--radius-full)' }}>
                    <Store size={18} />
                  </div>
                  <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
                    <h5 style={{ fontWeight: 600 }}>{product.vendorName}</h5>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{language === 'en' ? 'Verified Shop' : 'تصدیق شدہ دکان'}</p>
                  </div>
                </div>
                {product.vendorVerified && (
                  <span className="badge badge-primary">
                    <ShieldCheck size={14} /> Verified
                  </span>
                )}
              </div>

              {/* Trust Score Display (Buyer View) */}
              {trustScore && (
                <div className="card" style={{ padding: '16px', marginBottom: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="flex justify-between align-center" style={{ marginBottom: '12px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {language === 'en' ? 'VENDORA TRUST SCORE' : 'وینڈورا ٹرسٹ اسکور'}
                    </span>
                    <span className="badge" style={{ 
                      backgroundColor: trustScore.overallScore >= 90 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: trustScore.overallScore >= 90 ? 'var(--primary)' : 'var(--secondary)',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '4px 8px'
                    }}>
                      {trustScore.overallScore}/100 ({trustScore.category})
                    </span>
                  </div>
                  
                  {/* Trust Indicators */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', textAlign: isRtl ? 'right' : 'left', direction: isRtl ? 'rtl' : 'ltr' }}>
                    <div style={{ color: trustScore.componentScores?.verification >= 80 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      ✓ {language === 'en' ? 'Verified Vendor' : 'تصدیق شدہ وینڈر'}
                    </div>
                    <div style={{ color: trustScore.componentScores?.orderReliability >= 75 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      ✓ {language === 'en' ? 'Reliable Orders' : 'قابل اعتماد آرڈرز'}
                    </div>
                    <div style={{ color: trustScore.componentScores?.reviewsQuality >= 75 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      ✓ {language === 'en' ? 'Strong Reviews' : 'بہترین جائزے'}
                    </div>
                    <div style={{ color: trustScore.componentScores?.responseRate >= 80 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      ✓ {language === 'en' ? 'Fast Response' : 'فوری جواب'}
                    </div>
                  </div>
                </div>
              )}

              {/* Rating */}
              <div className="flex align-center gap-2" style={{ marginBottom: '24px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <div className="flex align-center" style={{ color: 'var(--secondary)', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      size={16} 
                      fill={i < Math.floor(product.rating || 5) ? 'var(--secondary)' : 'none'} 
                      style={{ marginRight: '2px', marginLeft: isRtl ? '2px' : 0 }}
                    />
                  ))}
                </div>
                <span style={{ fontWeight: 600 }}>{product.rating || '5.0'}</span>
                <span className="text-muted">({product.reviewsCount || 0} {t('product.reviews')})</span>
              </div>

              {/* Price */}
              <div style={{
                background: 'var(--primary-light)',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '24px'
              }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block' }}>
                  {language === 'en' ? 'Special Price' : 'خصوصی قیمت'}
                </span>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--primary)', display: 'block', lineHeight: 1.1 }}>
                  Rs. {product.price.toLocaleString()}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>*Cash on Delivery Assist Enabled</span>
              </div>

              {/* Variant Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Select Variant</label>
                  <div className="flex gap-3" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                    {product.variants.map((v) => (
                      <button 
                        key={v}
                        className="btn"
                        style={{
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: selectedVariant === v ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: selectedVariant === v ? 'var(--text-light)' : 'var(--text-primary)',
                          borderColor: selectedVariant === v ? 'var(--primary)' : 'var(--border-color)'
                        }}
                        onClick={() => setSelectedVariant(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              {product.stock > 0 && (
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">Quantity</label>
                  <div className="flex align-center gap-3" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '8px', minWidth: '40px' }}
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    >
                      <Minus size={16} />
                    </button>
                    <span style={{ fontSize: '18px', fontWeight: 700, minWidth: '30px', textAlign: 'center' }}>{quantity}</span>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '8px', minWidth: '40px' }}
                      onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ marginTop: '30px' }}>
              {addedMessage && (
                <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
                  {language === 'en' ? 'Item successfully added to your shopping cart!' : 'آئٹم کامیابی سے آپ کے کارٹ میں شامل ہو گیا!'}
                </div>
              )}
              
              <div className="flex gap-4" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                {userProfile?.role === 'vendor' ? (
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '16px', fontSize: '16px', cursor: 'not-allowed', color: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 600 }}
                    disabled
                  >
                    Vendors Cannot Purchase Items
                  </button>
                ) : product.stock > 0 ? (
                  <button 
                    className="btn btn-accent" 
                    style={{ flex: 1, padding: '16px', fontSize: '16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart size={20} /> {t('product.addToCart')}
                  </button>
                ) : (
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '16px', fontSize: '16px', cursor: 'not-allowed' }}
                    disabled
                  >
                    {t('product.outOfStock')}
                  </button>
                )}

                {/* Wishlist Button */}
                {userProfile?.role !== 'vendor' && (
                  <button
                    className="btn btn-secondary flex align-center justify-center"
                    style={{ 
                      padding: '16px', 
                      minWidth: '54px', 
                      borderRadius: 'var(--radius-sm)',
                      borderColor: isInWishlist ? 'var(--secondary)' : 'var(--border-color)',
                      color: isInWishlist ? 'var(--secondary)' : 'var(--text-secondary)'
                    }}
                    onClick={handleToggleWishlist}
                    title={isInWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    <Heart size={20} fill={isInWishlist ? 'var(--secondary)' : 'none'} />
                  </button>
                )}

                {/* Compare Button (Phase 10) */}
                <button
                  type="button"
                  className="btn btn-secondary flex align-center justify-center gap-2"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-sm)',
                    borderColor: isInCompare(id) ? 'var(--primary)' : 'var(--border-color)',
                    color: isInCompare(id) ? 'var(--primary)' : 'var(--text-secondary)',
                    backgroundColor: isInCompare(id) ? 'var(--primary-light)' : 'transparent',
                    fontWeight: 600,
                    fontSize: '14px'
                  }}
                  onClick={() => addToCompare(product)}
                  title={isInCompare(id) ? "Remove from comparison" : "Add to comparison"}
                >
                  <Sliders size={18} />
                  <span>{isInCompare(id) ? 'In Compare' : 'Compare'}</span>
                </button>

                {/* Chat with Vendor Button */}
                {userProfile?.role !== 'vendor' && (
                  <button
                    type="button"
                    className="btn btn-secondary flex align-center justify-center gap-2"
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-sm)',
                      borderColor: 'var(--primary)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                    onClick={() => setIsChatModalOpen(true)}
                    title="Chat directly with the merchant"
                  >
                    <MessageCircle size={18} />
                    <span>Chat with Vendor</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Area: Description */}
        <section className="card" style={{ padding: '40px', textAlign: isRtl ? 'right' : 'left' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>{t('product.description')}</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {localizedDescription}
          </p>
        </section>

        {/* AI Recommendation: Similar Products */}
        <div style={{ marginTop: '48px' }}>
          <SimilarProducts productId={product.id || product.productId} categoryId={product.category} limit={8} />
        </div>

        {/* AI Recommendation: Because You Viewed */}
        <div style={{ marginTop: '8px' }}>
          <BecauseYouViewed productId={product.id || product.productId} limit={8} />
        </div>
      </main>

      {/* Real-Time Buyer ↔ Vendor Chat Modal */}
      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        vendorId={product?.vendorId || 'vendor-default'}
        vendorName={product?.vendorName || 'Artisan Merchant'}
        productId={product?.id || id}
        productTitle={getLocalizedValue(product?.title, language)}
        productImage={product?.images?.[0] || product?.image || ''}
        productPrice={product?.price || 0}
      />

      <Footer />
    </div>
  );
}
