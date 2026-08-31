import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, ShoppingCart, Sliders } from 'lucide-react';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';
import { useLanguage } from '../context/LanguageContext';
import { useCompare } from '../context/CompareContext';

export default function ProductCard({ product }) {
  const { language } = useLanguage();
  const { addToCompare, isInCompare } = useCompare ? useCompare() : { addToCompare: () => {}, isInCompare: () => false };

  const {
    id = 'prod-1',
    title = 'Handwoven Blue Pottery Vase',
    price = 3450,
    rating = 4.8,
    reviewsCount = 24,
    images = ['https://placehold.co/300x300?text=Pottery+Vase'],
    vendorName = 'Multan Artisan Guild',
    vendorVerified = true,
    stock = 12
  } = product || {};

  const getLocalizedValue = (fieldVal, activeLang) => {
    if (!fieldVal) return "";
    if (typeof fieldVal === 'string') return fieldVal;
    if (typeof fieldVal === 'object') {
      return fieldVal[activeLang] || fieldVal['en'] || Object.values(fieldVal)[0] || "";
    }
    return String(fieldVal);
  };

  const localizedTitle = getLocalizedValue(title, language);

  const handleProductClick = () => {
    trackEvent(EventTypes.PRODUCT_CLICK, {
      productId: id,
      categoryId: product.category || null,
      metadata: { title: localizedTitle, price }
    });
  };

  const isRtl = language === 'ur' || language === 'sd';

  return (
    <div className="card card-hover flex flex-col justify-between" style={{ height: '100%', textAlign: isRtl ? 'right' : 'left' }} onClick={handleProductClick}>
      <div>
        {/* Product Image */}
        <div style={{ position: 'relative', overflow: 'hidden', paddingTop: '100%', background: '#f8fafc' }}>
          <img 
            src={images[0]} 
            alt={localizedTitle} 
            loading="lazy"
            decoding="async"
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              transition: 'transform var(--transition-normal)'
            }}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          />
          {stock < 5 && (
            <span 
              className="badge badge-danger" 
              style={{ position: 'absolute', top: '12px', left: isRtl ? 'auto' : '12px', right: isRtl ? '12px' : 'auto', fontSize: '10px' }}
            >
              Only {stock} Left!
            </span>
          )}

          {/* Quick Compare Button (Phase 10) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              addToCompare(product);
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: isRtl ? 'auto' : '10px',
              left: isRtl ? '10px' : 'auto',
              background: isInCompare(id) ? 'var(--primary)' : 'rgba(255, 255, 255, 0.9)',
              color: isInCompare(id) ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'all 0.2s ease',
              zIndex: 2
            }}
            title={isInCompare(id) ? "Remove from comparison" : "Add to comparison"}
          >
            <Sliders size={14} />
          </button>
        </div>

        {/* Product Details */}
        <div style={{ padding: '16px' }}>
          {/* Vendor Details */}
          <div className="flex align-center gap-2" style={{ marginBottom: '8px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {vendorName}
            </span>
            {vendorVerified && (
              <ShieldCheck size={14} style={{ color: 'var(--primary)' }} title="Verified Merchant" />
            )}
          </div>

          {/* Title */}
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', minHeight: '44px', lineBreak: 'strict' }}>
            <Link to={`/product/${id}`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {localizedTitle}
            </Link>
          </h4>

          {/* Rating */}
          <div className="flex align-center gap-2" style={{ marginBottom: '12px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <div className="flex align-center" style={{ color: 'var(--secondary)', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  size={12} 
                  fill={i < Math.floor(rating) ? 'var(--secondary)' : 'none'} 
                  style={{ marginRight: '1px', marginLeft: isRtl ? '1px' : '0' }}
                />
              ))}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {rating}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ({reviewsCount})
            </span>
          </div>
        </div>
      </div>

      {/* Pricing & Cart Action */}
      <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
        <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', lineHeight: 1 }}>Price</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Rs. {price.toLocaleString()}
          </span>
        </div>
        
        <Link to={`/product/${id}`} className="btn btn-primary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
          View Details
        </Link>
      </div>
    </div>
  );
}
