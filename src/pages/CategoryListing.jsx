import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, hasFirebaseKeys } from '../services/firebase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CategoryMenu, { categoriesList } from '../components/CategoryMenu';
import ProductCard from '../components/ProductCard';
import { Loader, AlertTriangle, ArrowRight, Sparkles, RefreshCw, Compass } from 'lucide-react';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';
import { 
  intelligentClientSearch, 
  normalizeClientQuery, 
  detectClientLanguage, 
  extractClientEntities 
} from '../services/search/intelligentSearch';
import { getMarketplaceProducts } from '../utils/productSync';

export default function CategoryListing() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const activeCategory = categoriesList.find(c => c.slug === slug) || { name: 'All Products', slug: 'all' };

  // States
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [didYouMean, setDidYouMean] = useState(null);
  const [detectedLang, setDetectedLang] = useState('en');
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(8);

  // Filter & Sort Settings
  const [priceRange, setPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');

  // 1. Fetch products from synced marketplace helper
  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      // Reset pagination when category changes
      setVisibleCount(8);

      try {
        const synced = await getMarketplaceProducts();
        setProducts(synced);
      } catch (err) {
        console.error("Failed to load catalog products:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [slug]);

  // 2. Intelligent Search, Filtering, and Hybrid Ranking (Phase 9)
  useEffect(() => {
    if (searchQuery.trim()) {
      const { corrected, hasCorrection } = normalizeClientQuery(searchQuery);
      setDidYouMean(hasCorrection ? corrected : null);
      setDetectedLang(detectClientLanguage(searchQuery));
    } else {
      setDidYouMean(null);
      setDetectedLang('en');
    }

    const results = intelligentClientSearch(products, searchQuery, {
      category: slug,
      priceRange,
      sortBy
    });

    setFilteredProducts(results);
  }, [products, slug, searchQuery, priceRange, sortBy]);

  // Telemetry Event tracking for category visits
  useEffect(() => {
    if (slug && slug !== 'all') {
      trackEvent(EventTypes.CATEGORY_VIEW, {
        categoryId: slug,
        metadata: { categoryName: activeCategory.name }
      });
    }
  }, [slug, activeCategory.name]);

  // Telemetry Event tracking for search queries
  useEffect(() => {
    if (searchQuery.trim()) {
      trackEvent(EventTypes.PRODUCT_SEARCH, {
        metadata: {
          query: searchQuery,
          language: detectClientLanguage(searchQuery),
          resultCount: filteredProducts.length,
          isZeroResult: filteredProducts.length === 0
        }
      });
    }
  }, [searchQuery, filteredProducts.length]);

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />
      
      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <div className="layout-with-sidebar">
          {/* Categories Sidebar */}
          <CategoryMenu />

          {/* Listings and Filters */}
          <div>
            {/* "Did You Mean" Spelling Banner */}
            {didYouMean && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div className="flex align-center gap-2">
                  <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '13px' }}>
                    Did you mean: <strong style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => navigate(`/category/${slug || 'all'}?search=${encodeURIComponent(didYouMean)}`)}>{didYouMean}</strong>?
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => navigate(`/category/${slug || 'all'}?search=${encodeURIComponent(didYouMean)}`)}
                >
                  Search "{didYouMean}"
                </button>
              </div>
            )}

            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <div className="flex justify-between align-center flex-wrap gap-4">
                <div>
                  <h2 style={{ fontSize: '24px', textTransform: 'capitalize' }}>
                    {activeCategory.name}
                  </h2>
                  {searchQuery && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                      Intelligent search for: <strong>"{searchQuery}"</strong> ({filteredProducts.length} items found) &bull; <span style={{ textTransform: 'capitalize', color: 'var(--primary)', fontWeight: 600 }}>{detectedLang.replace('_', ' ')}</span>
                    </p>
                  )}
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                  <select 
                    className="form-select" 
                    style={{ width: '180px', padding: '8px 12px' }}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="popularity">Sort: Hybrid Relevance</option>
                    <option value="price-low-high">Price: Low to High</option>
                    <option value="price-high-low">Price: High to Low</option>
                    <option value="newest">Newest Arrivals</option>
                  </select>
                  
                  <select 
                    className="form-select" 
                    style={{ width: '180px', padding: '8px 12px' }}
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                  >
                    <option value="all">Price: All Ranges</option>
                    <option value="under-2000">Under Rs. 2,000</option>
                    <option value="2000-5000">Rs. 2,000 - Rs. 5,000</option>
                    <option value="above-5000">Above Rs. 5,000</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center" style={{ padding: '60px 0' }}>
                <Loader className="spin" size={40} style={{ color: 'var(--primary)' }} />
              </div>
            ) : filteredProducts.length === 0 ? (
              /* Phase 9: Zero-Result Experience & Recommendations */
              <div className="card flex flex-col align-center justify-center" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <AlertTriangle size={44} style={{ marginBottom: '14px', color: '#f59e0b' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
                  No exact matches found for "{searchQuery}"
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '480px', marginBottom: '24px' }}>
                  Try checking your spelling, broadening your search query, or exploring recommended items from popular categories below.
                </p>

                {/* Did You Mean Quick Button */}
                {didYouMean && (
                  <button
                    type="button"
                    className="btn btn-primary flex align-center gap-2"
                    style={{ padding: '8px 20px', marginBottom: '24px', fontSize: '13px' }}
                    onClick={() => navigate(`/category/${slug || 'all'}?search=${encodeURIComponent(didYouMean)}`)}
                  >
                    <Sparkles size={14} /> Search "{didYouMean}" Instead
                  </button>
                )}

                {/* Quick Category Suggestions */}
                <div style={{ marginBottom: '32px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
                    Explore Related Categories
                  </span>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {categoriesList.filter(c => c.slug !== 'all').map(cat => (
                      <Link
                        key={cat.slug}
                        to={`/category/${cat.slug}`}
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Fallback Popular Products */}
                {products.length > 0 && (
                  <div style={{ width: '100%', textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '28px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Compass size={18} /> Recommended Marketplace Products
                    </h4>
                    <div className="grid grid-cols-4 gap-6">
                      {products.slice(0, 4).map((prod) => (
                        <ProductCard key={prod.id} product={prod} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-6">
                  {filteredProducts.slice(0, visibleCount).map((prod) => (
                    <ProductCard key={prod.id} product={prod} />
                  ))}
                </div>

                {/* Load More Pagination Button */}
                {visibleCount < filteredProducts.length && (
                  <div className="flex justify-center" style={{ marginTop: '40px' }}>
                    <button 
                      className="btn btn-secondary flex align-center gap-2" 
                      style={{ padding: '12px 30px', fontWeight: 600 }}
                      onClick={() => setVisibleCount(prev => prev + 8)}
                    >
                      Load More Products <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
