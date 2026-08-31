import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db, hasFirebaseKeys } from '../services/firebase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CategoryMenu from '../components/CategoryMenu';
import ProductCard from '../components/ProductCard';
import { Sparkles, ArrowRight, ShieldCheck, Users, Store, Loader, Compass, Flame, Heart, Award } from 'lucide-react';
import { 
  RecommendedForYou, 
  TrendingProducts,
  BecauseYouViewed,
  SimilarProducts,
  InterestRecommendations,
  NewForYou,
  FrequentlyBoughtTogether,
  PopularProducts,
  NewArrivals
} from '../components/recommendations/widgets';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasRecentBrowsing, setHasRecentBrowsing] = useState(false);
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();

  const isRtl = language === 'ur' || language === 'sd';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { getMarketplaceProducts } = await import('../utils/productSync');
        const synced = await getMarketplaceProducts();
        setProducts(synced);
      } catch (err) {
        console.error("Failed to load products for homepage:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

    // Check if anonymous user has previous browsing activity
    try {
      const viewed = localStorage.getItem('vendora_last_viewed_product_id');
      const events = JSON.parse(localStorage.getItem('vendora_mock_events') || '[]');
      if (viewed || events.some(e => e.eventType === 'PRODUCT_VIEW')) {
        setHasRecentBrowsing(true);
      }
    } catch (e) {
      // Non-blocking
    }
  }, []);

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingBottom: '60px' }}>
        {/* Hero Banner Section */}
        <section className="layout-with-sidebar">
          <CategoryMenu />

          <div style={{
            background: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)',
            color: 'var(--text-light)',
            borderRadius: 'var(--radius-md)',
            padding: '48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '360px',
            position: 'relative',
            overflow: 'hidden',
            textAlign: isRtl ? 'right' : 'left'
          }}>
            <div style={{
              position: 'absolute',
              right: isRtl ? 'auto' : '-10%',
              left: isRtl ? '-10%' : 'auto',
              bottom: '-20%',
              width: '400px',
              height: '400px',
              borderRadius: 'var(--radius-full)',
              background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: '600px', zIndex: 1 }}>
              <span className="badge badge-secondary" style={{ marginBottom: '16px', background: 'var(--secondary)', color: '#fff' }}>
                <Sparkles size={12} /> {currentUser ? `Salam, ${currentUser.displayName || currentUser.email?.split('@')[0] || 'Shopper'}!` : t('nav.topBanner')}
              </span>
              <h1 style={{ color: 'var(--text-light)', fontSize: '32px', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.3 }}>
                {currentUser ? "Your Curated Artisan Marketplace" : t('home.heroTitle')}
              </h1>
              <p style={{ color: '#d1fae5', fontSize: '15px', marginBottom: '32px', opacity: 0.9 }}>
                {currentUser 
                  ? "Explore recommendations handpicked from your verified Pakistani artisans, past orders, and style preferences." 
                  : t('home.heroSubtitle')}
              </p>
              <div className="flex gap-4" style={{ justifyContent: isRtl ? 'flex-start' : 'flex-start' }}>
                <Link to="/category/all" className="btn btn-accent" style={{ fontSize: '15px' }}>
                  {t('home.shopNow')} <ArrowRight size={16} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                </Link>
                <Link to="/signup?role=vendor" className="btn btn-secondary" style={{ background: 'transparent', borderColor: '#d1fae5', color: '#fff' }}>
                  {t('home.registerVendor')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Banner */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginTop: '40px'
        }}>
          <div className="card flex align-center gap-4" style={{ padding: '24px', flexDirection: isRtl ? 'row-reverse' : 'row', textAlign: isRtl ? 'right' : 'left' }}>
            <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{t('home.qualityGuaranteed')}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('home.qualitySubtitle')}</p>
            </div>
          </div>
          <div className="card flex align-center gap-4" style={{ padding: '24px', flexDirection: isRtl ? 'row-reverse' : 'row', textAlign: isRtl ? 'right' : 'left' }}>
            <div style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <Users size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{t('home.directFromMaker')}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('home.directSubtitle')}</p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* PERSONALIZED DISCOVERY STREAMS                                          */}
        {/* ════════════════════════════════════════════════════════════════════════ */}

        {currentUser ? (
          /* ── AUTHENTICATED USER EXPERIENCE ───────────────────────────────────── */
          <div style={{ marginTop: '50px' }}>
            {/* 1. Recommended For You */}
            <RecommendedForYou limit={8} />

            {/* 2. Because You Viewed */}
            <BecauseYouViewed limit={8} />

            {/* 3. Based on Your Interests */}
            <InterestRecommendations limit={8} />

            {/* 4. Similar Products */}
            <SimilarProducts limit={8} />

            {/* 5. Trending on Vendora */}
            <TrendingProducts limit={8} />

            {/* 6. New For You */}
            <NewForYou limit={8} />

            {/* 7. Frequently Bought Together */}
            <FrequentlyBoughtTogether limit={6} />
          </div>
        ) : (
          /* ── ANONYMOUS USER EXPERIENCE (WITH GRADUAL PERSONALIZATION) ────────── */
          <div style={{ marginTop: '50px' }}>
            {/* 1. Trending on Vendora */}
            <TrendingProducts limit={8} />

            {/* 2. Popular Products */}
            <PopularProducts limit={8} />

            {/* 3. New Arrivals */}
            <NewArrivals limit={8} />

            {/* 4. Explore by Category Showcase */}
            <section style={{ marginBottom: '48px' }}>
              <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Compass size={18} style={{ color: 'var(--primary)' }} />
                    Explore by Heritage Craft
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Browse regional specialties direct from traditional cultural districts
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                {[
                  { name: "Blue Pottery", query: "pottery", color: "#1e3a8a", icon: "🏺" },
                  { name: "Ajrak & Blockprint", query: "ajrak", color: "#831843", icon: "🧣" },
                  { name: "Handicrafts", query: "handicrafts", color: "#14532d", icon: "🪵" },
                  { name: "Traditional Shoes", query: "chappal", color: "#7c2d12", icon: "👞" },
                  { name: "Brass Decor", query: "brass", color: "#78350f", icon: "✨" },
                  { name: "Embroidered Shawls", query: "shawl", color: "#581c87", icon: "🧶" }
                ].map((c, i) => (
                  <Link
                    key={i}
                    to={`/search?q=${encodeURIComponent(c.query)}`}
                    className="card"
                    style={{
                      padding: '20px 16px',
                      textAlign: 'center',
                      textDecoration: 'none',
                      background: 'var(--bg-secondary)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '32px' }}>{c.icon}</span>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{c.name}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Explore &rarr;</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* 5. Seasonal Artisan Fair Showcase */}
            <section className="card" style={{
              padding: '36px',
              marginBottom: '48px',
              background: 'linear-gradient(135deg, #134e4a 0%, #042f2e 100%)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '24px'
            }}>
              <div style={{ maxWidth: '540px' }}>
                <span className="badge badge-secondary" style={{ marginBottom: '12px', background: '#f59e0b', color: '#000' }}>
                  Seasonal Craft Fair &bull; Spring Spotlight
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>
                  Sindh & Punjab Master Craftsman Fair
                </h3>
                <p style={{ color: '#ccfbf1', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  Celebrating handmade Multani glazed terracotta and authentic indigo-dyed Hala textiles. Each piece supports verified artisan families directly.
                </p>
              </div>
              <Link to="/category/handicrafts" className="btn btn-accent" style={{ padding: '12px 24px', fontWeight: 700 }}>
                Explore Seasonal Fair &rarr;
              </Link>
            </section>

            {/* 6. Gradual Personalization for Active Anonymous Users */}
            {hasRecentBrowsing && (
              <>
                <BecauseYouViewed limit={8} />
                <InterestRecommendations limit={8} />
              </>
            )}
          </div>
        )}

        {/* Featured Products Catalog Showcase */}
        <section style={{ marginTop: '20px' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '24px', flexDirection: isRtl ? 'row-reverse' : 'row', textAlign: isRtl ? 'right' : 'left' }}>
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 700 }}>{t('home.featuredTitle')}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t('home.featuredSubtitle')}</p>
            </div>
            <Link to="/category/all" className="btn btn-secondary flex align-center gap-2" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              {t('home.browseAll')} <ArrowRight size={16} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center" style={{ padding: '40px 0' }}>
              <Loader className="spin" size={32} style={{ color: 'var(--primary)' }} />
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-6">
              {products.slice(0, 10).map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          )}
        </section>

        {/* Call to Action for Merchants */}
        <section className="card" style={{
          marginTop: '60px',
          background: 'linear-gradient(135deg, var(--bg-dark) 0%, var(--bg-dark-secondary) 100%)',
          color: 'var(--text-light)',
          padding: '48px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ color: 'var(--text-light)', fontSize: '32px', marginBottom: '16px' }}>{t('home.merchantTitle')}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              {t('home.merchantSubtitle')}
            </p>
            <Link to="/signup?role=vendor" className="btn btn-accent flex align-center gap-2" style={{ display: 'inline-flex', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              <Store size={18} /> {t('home.joinVendor')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

