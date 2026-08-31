import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { trackEvent } from '../../services/analytics/eventTracker';
import { EventTypes } from '../../services/analytics/eventTypes';

/**
 * A single recommendation card — visually consistent with ProductCard
 * but smaller and tailored for horizontal scroll carousels.
 */
export default function RecommendationCard({ product, widgetName = '' }) {
  if (!product) return null;

  const {
    productId,
    id,
    title = 'Product',
    price = 0,
    images = [],
    rating = 0,
    category = '',
    vendorName = '',
    stock = 1
  } = product;

  const resolvedId = productId || id;
  const imageUrl = images[0] || 'https://placehold.co/200x200?text=Product';
  const isInStock = stock === undefined || stock > 0;

  const handleClick = () => {
    trackEvent(EventTypes.RECOMMENDATION_CLICK, {
      productId: resolvedId,
      categoryId: category,
      metadata: { widgetName, title, price }
    });
  };

  return (
    <Link
      to={`/product/${resolvedId}`}
      onClick={handleClick}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        className="card card-hover"
        style={{
          width: '190px',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          position: 'relative'
        }}
      >
        {/* Product Image */}
        <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease'
            }}
          />
          {!isInStock && (
            <div style={{
              position: 'absolute',
              top: 8, right: 8,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              Sold Out
            </div>
          )}
        </div>

        {/* Card Body */}
        <div style={{ padding: '12px' }}>
          {/* Category tag */}
          {category && (
            <span style={{
              fontSize: '10px',
              color: 'var(--primary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {category}
            </span>
          )}

          {/* Title */}
          <h4 style={{
            fontSize: '13px',
            fontWeight: 600,
            margin: '4px 0 6px',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: 'var(--text-primary)'
          }}>
            {title}
          </h4>

          {/* Rating */}
          {rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <Star size={11} fill="var(--secondary)" color="var(--secondary)" />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{rating}</span>
            </div>
          )}

          {/* Price */}
          <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
            Rs. {price.toLocaleString()}
          </p>

          {/* Vendor */}
          {vendorName && (
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {vendorName}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
