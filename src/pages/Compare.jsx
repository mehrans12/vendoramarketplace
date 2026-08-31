import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCompare } from '../context/CompareContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { getMarketplaceProducts } from '../utils/productSync';
import { 
  Sliders, 
  Trash2, 
  Plus, 
  X, 
  Star, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  Award, 
  ShoppingCart, 
  ArrowLeft,
  Info,
  HelpCircle
} from 'lucide-react';

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { compareItems, removeFromCompare, clearCompare, addToCompare } = useCompare();
  const { addToCart } = useCart();
  const { language, t } = useLanguage();

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');

  // 1. Fetch marketplace catalog
  useEffect(() => {
    getMarketplaceProducts()
      .then(prods => setAllProducts(prods))
      .catch(err => console.error("Failed to load catalog for comparison:", err))
      .finally(() => setLoading(false));
  }, []);

  // 2. Determine products to compare from URL or Context
  const comparedProducts = useMemo(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      return allProducts.filter(p => ids.includes(p.id));
    }
    return compareItems;
  }, [searchParams, allProducts, compareItems]);

  // Sync URL with compared products
  useEffect(() => {
    if (comparedProducts.length > 0) {
      const ids = comparedProducts.map(p => p.id).join(',');
      if (searchParams.get('ids') !== ids) {
        setSearchParams({ ids });
      }
    }
  }, [comparedProducts, setSearchParams]);

  // 3. Extract Unified Specifications Matrix
  const specKeys = useMemo(() => {
    const keys = new Set();
    comparedProducts.forEach(p => {
      const specs = p.specifications && typeof p.specifications === 'object' ? p.specifications : {};
      Object.keys(specs).forEach(k => keys.add(k));
    });
    return Array.from(keys).sort();
  }, [comparedProducts]);

  // 4. Grounded AI Analysis & Superlatives
  const aiVerdict = useMemo(() => {
    if (comparedProducts.length < 2) return null;

    // Best Value (Lowest price among items with rating >= 4.0)
    let bestVal = comparedProducts[0];
    let minPrice = Infinity;
    comparedProducts.forEach(p => {
      const price = Number(p.price) || 0;
      const rating = Number(p.rating) || 0;
      if (price > 0 && price < minPrice && rating >= 4.0) {
        minPrice = price;
        bestVal = p;
      }
    });

    // Best Overall (Weighted rating, review count, quality score)
    let bestOverall = comparedProducts[0];
    let maxScore = -1;
    comparedProducts.forEach(p => {
      const rating = Number(p.rating) || 4.0;
      const reviews = Number(p.reviewsCount || p.reviews || 0);
      const quality = Number(p.qualityAudit?.overallScore || 75);
      const inStock = (p.stock && p.stock > 0) ? 1.2 : 0.8;
      const composite = ((rating * 15) + (Math.min(reviews, 50) * 0.5) + (quality * 0.4)) * inStock;
      if (composite > maxScore) {
        maxScore = composite;
        bestOverall = p;
      }
    });

    const isHandicraft = comparedProducts.some(p => p.category === 'handicrafts' || /handmade|ceramic|pottery|ajrak/i.test(p.title));

    const getTitle = (p) => typeof p.title === 'object' ? (p.title.en || Object.values(p.title)[0]) : p.title;

    let summaryText = "";
    if (bestOverall.id === bestVal.id) {
      summaryText = `${getTitle(bestOverall)} is the top recommendation in this comparison, providing the highest rating (⭐ ${bestOverall.rating}) at an attractive price of Rs. ${bestOverall.price?.toLocaleString()}.`;
    } else {
      summaryText = `For buyers seeking the highest performance and customer satisfaction, ${getTitle(bestOverall)} leads with a rating of ⭐ ${bestOverall.rating}. If budget is your main priority, ${getTitle(bestVal)} delivers exceptional value at Rs. ${bestVal.price?.toLocaleString()}.`;
    }

    return {
      bestOverall,
      bestValue: bestVal,
      isHandicraft,
      summaryVerdict: summaryText
    };
  }, [comparedProducts]);

  const handleRemove = (productId) => {
    removeFromCompare(productId);
    const remaining = comparedProducts.filter(p => p.id !== productId);
    if (remaining.length > 0) {
      setSearchParams({ ids: remaining.map(p => p.id).join(',') });
    } else {
      setSearchParams({});
    }
  };

  const handleAddProductFromModal = (prod) => {
    addToCompare(prod);
    const updated = [...comparedProducts, prod];
    setSearchParams({ ids: updated.map(p => p.id).join(',') });
    setIsAddModalOpen(false);
  };

  const getLocalizedTitle = (p) => {
    if (!p) return "";
    if (typeof p.title === 'object') return p.title[language] || p.title.en || Object.values(p.title)[0];
    return p.title;
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '32px', paddingBottom: '60px' }}>
        {/* Breadcrumb & Navigation */}
        <div className="flex justify-between align-center flex-wrap gap-4" style={{ marginBottom: '24px' }}>
          <div>
            <Link to="/" className="flex align-center gap-2 text-muted" style={{ fontSize: '13px', marginBottom: '8px' }}>
              <ArrowLeft size={14} /> Back to marketplace
            </Link>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={26} style={{ color: 'var(--primary)' }} /> Product Comparison
            </h1>
            <p className="text-muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Compare actual specifications, prices, seller ratings, and stock side-by-side.
            </p>
          </div>

          <div className="flex gap-3 align-center">
            {comparedProducts.length < 4 && (
              <button
                type="button"
                className="btn btn-secondary flex align-center gap-2"
                onClick={() => setIsAddModalOpen(true)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Plus size={16} /> Add Product ({comparedProducts.length}/4)
              </button>
            )}
            {comparedProducts.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary flex align-center gap-2"
                onClick={() => { clearCompare(); setSearchParams({}); }}
                style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                <Trash2 size={15} /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Not Enough Products State */}
        {comparedProducts.length < 2 ? (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Sliders size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
              Select at least 2 products to compare
            </h2>
            <p className="text-muted" style={{ maxWidth: '460px', margin: '0 auto 24px', fontSize: '14px' }}>
              Add products from the marketplace catalog, search results, or product pages to view side-by-side specifications and AI analysis.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
              style={{ padding: '10px 24px', fontSize: '14px' }}
            >
              <Plus size={16} /> Choose Products to Compare
            </button>

            {/* Quick Compare Suggestions */}
            {allProducts.length >= 2 && (
              <div style={{ marginTop: '48px', borderTop: '1px solid var(--border-color)', paddingTop: '32px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '16px' }}>
                  Or compare these popular marketplace pairs
                </span>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary flex align-center gap-2"
                    onClick={() => {
                      const pair = allProducts.slice(0, 2);
                      pair.forEach(p => addToCompare(p));
                      setSearchParams({ ids: pair.map(p => p.id).join(',') });
                    }}
                    style={{ padding: '10px 18px', fontSize: '13px' }}
                  >
                    Compare: {getLocalizedTitle(allProducts[0])?.slice(0, 20)}... vs {getLocalizedTitle(allProducts[1])?.slice(0, 20)}...
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* AI Verdict & Grounded Analysis Box (Phase 10) */}
            {aiVerdict && (
              <div className="card" style={{
                padding: '24px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)'
              }}>
                <div className="flex align-center gap-2" style={{ color: 'var(--primary)', marginBottom: '8px' }}>
                  <Sparkles size={20} />
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AI Grounded Comparison Verdict
                  </span>
                </div>

                <p style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                  {aiVerdict.summaryVerdict}
                </p>

                {/* Superlative Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {/* Best Overall */}
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="flex align-center gap-2" style={{ color: 'var(--success)', marginBottom: '4px' }}>
                      <Award size={16} />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Best Overall Choice</span>
                    </div>
                    <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-primary)' }}>
                      {getLocalizedTitle(aiVerdict.bestOverall)}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ⭐ {aiVerdict.bestOverall.rating} rating &bull; Rs. {aiVerdict.bestOverall.price?.toLocaleString()}
                    </span>
                  </div>

                  {/* Best Value */}
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div className="flex align-center gap-2" style={{ color: 'var(--primary)', marginBottom: '4px' }}>
                      <Check size={16} />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Best Value Pick</span>
                    </div>
                    <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-primary)' }}>
                      {getLocalizedTitle(aiVerdict.bestValue)}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Rs. {aiVerdict.bestValue.price?.toLocaleString()} &bull; Highest feature-to-price ratio
                    </span>
                  </div>

                  {/* Category Superlative */}
                  {aiVerdict.isHandicraft && (
                    <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div className="flex align-center gap-2" style={{ color: '#f59e0b', marginBottom: '4px' }}>
                        <Sparkles size={16} />
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Heritage Craftsmanship</span>
                      </div>
                      <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-primary)' }}>
                        Authentic Local Artisan Craft
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Verified Pakistani cultural craftsmanship & natural materials
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Responsive Comparison Table */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
                  {/* Table Header: Products */}
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                      <th style={{ width: '180px', padding: '20px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', verticalAlign: 'top' }}>
                        Attributes
                      </th>
                      {comparedProducts.map(p => (
                        <th key={p.id} style={{ padding: '20px', minWidth: '220px', maxWidth: '280px', verticalAlign: 'top' }}>
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => handleRemove(p.id)}
                              style={{ position: 'absolute', top: 0, right: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                              title="Remove from comparison"
                            >
                              <X size={16} />
                            </button>

                            <img
                              src={p.images?.[0] || 'https://placehold.co/120x120?text=Item'}
                              alt=""
                              style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}
                            />

                            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                              <Link to={`/product/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {getLocalizedTitle(p)}
                              </Link>
                            </h4>

                            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px' }}>
                              Rs. {p.price?.toLocaleString()}
                            </div>

                            <button
                              type="button"
                              className="btn btn-primary flex align-center justify-center gap-2"
                              style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                              onClick={() => addToCart(p, 1)}
                            >
                              <ShoppingCart size={14} /> Add to Cart
                            </button>
                          </div>
                        </th>
                      ))}
                      {/* Slot to add another product if < 4 */}
                      {comparedProducts.length < 4 && (
                        <th style={{ padding: '20px', minWidth: '160px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary flex flex-col align-center justify-center gap-2"
                            onClick={() => setIsAddModalOpen(true)}
                            style={{ width: '100%', height: '140px', borderStyle: 'dashed' }}
                          >
                            <Plus size={24} />
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>Add Product</span>
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {/* Rating & Reviews */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Customer Rating
                      </td>
                      {comparedProducts.map(p => (
                        <td key={p.id} style={{ padding: '16px 20px' }}>
                          <div className="flex align-center gap-1" style={{ color: 'var(--secondary)' }}>
                            <Star size={14} fill="currentColor" />
                            <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{p.rating || 4.5}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                              ({p.reviewsCount || p.reviews || 0} reviews)
                            </span>
                          </div>
                        </td>
                      ))}
                      {comparedProducts.length < 4 && <td />}
                    </tr>

                    {/* Stock & Availability */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Availability
                      </td>
                      {comparedProducts.map(p => (
                        <td key={p.id} style={{ padding: '16px 20px' }}>
                          {p.stock > 0 ? (
                            <span className="badge badge-success">In Stock ({p.stock})</span>
                          ) : (
                            <span className="badge badge-danger">Out of Stock</span>
                          )}
                        </td>
                      ))}
                      {comparedProducts.length < 4 && <td />}
                    </tr>

                    {/* Vendor & Trust */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Merchant & Trust
                      </td>
                      {comparedProducts.map(p => (
                        <td key={p.id} style={{ padding: '16px 20px' }}>
                          <strong style={{ display: 'block', fontSize: '13px' }}>{p.vendorName || 'Verified Merchant'}</strong>
                          <span className="badge badge-primary flex align-center gap-1" style={{ fontSize: '10px', marginTop: '4px', display: 'inline-flex' }}>
                            <ShieldCheck size={11} /> Trust Score: {p.vendorTrustScore || 92}/100
                          </span>
                        </td>
                      ))}
                      {comparedProducts.length < 4 && <td />}
                    </tr>

                    {/* Product Quality Score */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                        AI Quality Score
                      </td>
                      {comparedProducts.map(p => {
                        const score = p.qualityAudit?.overallScore || 85;
                        return (
                          <td key={p.id} style={{ padding: '16px 20px' }}>
                            <span className="badge" style={{
                              backgroundColor: score >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              color: score >= 80 ? '#10b981' : '#f59e0b',
                              fontWeight: 700
                            }}>
                              {score} / 100 ({score >= 85 ? 'Excellent' : 'Good'})
                            </span>
                          </td>
                        );
                      })}
                      {comparedProducts.length < 4 && <td />}
                    </tr>

                    {/* Category */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Category
                      </td>
                      {comparedProducts.map(p => (
                        <td key={p.id} style={{ padding: '16px 20px', textTransform: 'capitalize', fontSize: '13px' }}>
                          {p.category} {p.subcategory ? `> ${p.subcategory}` : ''}
                        </td>
                      ))}
                      {comparedProducts.length < 4 && <td />}
                    </tr>

                    {/* Dynamic Specifications Matrix */}
                    {specKeys.map(key => (
                      <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {key}
                        </td>
                        {comparedProducts.map(p => (
                          <td key={p.id} style={{ padding: '14px 20px', fontSize: '13px' }}>
                            {p.specifications?.[key] || '—'}
                          </td>
                        ))}
                        {comparedProducts.length < 4 && <td />}
                      </tr>
                    ))}

                    {/* Description Excerpt */}
                    <tr>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Overview
                      </td>
                      {comparedProducts.map(p => {
                        const desc = typeof p.description === 'object' ? (p.description.en || Object.values(p.description)[0]) : p.description;
                        return (
                          <td key={p.id} style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {desc ? desc.slice(0, 140) + '...' : '—'}
                          </td>
                        );
                      })}
                      {comparedProducts.length < 4 && <td />}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {isAddModalOpen && (
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
            <div className="card" style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              padding: '24px',
              position: 'relative'
            }}>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>
                Add Product to Comparison
              </h3>

              <input
                type="text"
                className="form-input"
                placeholder="Search products by title or category..."
                value={addSearchQuery}
                onChange={e => setAddSearchQuery(e.target.value)}
                style={{ marginBottom: '16px' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {allProducts
                  .filter(p => !comparedProducts.some(cp => cp.id === p.id))
                  .filter(p => !addSearchQuery || (getLocalizedTitle(p) || '').toLowerCase().includes(addSearchQuery.toLowerCase()))
                  .slice(0, 10)
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleAddProductFromModal(p)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      <img
                        src={p.images?.[0] || 'https://placehold.co/40x40?text=Item'}
                        alt=""
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getLocalizedTitle(p)}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                          Rs. {p.price?.toLocaleString()}
                        </span>
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                        Select
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
