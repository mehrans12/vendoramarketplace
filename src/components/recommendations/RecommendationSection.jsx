import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import RecommendationCard from './RecommendationCard';
import { trackEvent } from '../../services/analytics/eventTracker';
import { EventTypes } from '../../services/analytics/eventTypes';

/** Skeleton card for loading state — prevents layout shift */
function SkeletonCard() {
  return (
    <div style={{
      width: '190px',
      flexShrink: 0,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
      <div style={{ paddingTop: '100%', background: 'var(--border-color)' }} />
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ height: '10px', borderRadius: '4px', background: 'var(--border-color)', width: '60%' }} />
        <div style={{ height: '14px', borderRadius: '4px', background: 'var(--border-color)', width: '90%' }} />
        <div style={{ height: '14px', borderRadius: '4px', background: 'var(--border-color)', width: '70%' }} />
        <div style={{ height: '16px', borderRadius: '4px', background: 'var(--border-color)', width: '50%' }} />
      </div>
    </div>
  );
}

/**
 * RecommendationSection — the main container widget.
 *
 * Renders a scrollable horizontal carousel of products with:
 *   - Left/right scroll arrow buttons
 *   - Skeleton loading state (no layout shift)
 *   - Empty state (hidden entirely)
 *   - AI-generated explanation subtitle
 *   - RECOMMENDATION_IMPRESSION tracking on mount
 *
 * @param {Object} props
 * @param {string}        props.title        Widget heading
 * @param {string}        [props.subtitle]   AI explanation text
 * @param {Array<Object>} props.items        Product recommendation items
 * @param {boolean}       props.loading
 * @param {string}        [props.context]
 * @param {React.ReactNode} [props.icon]     Optional heading icon
 */
export default function RecommendationSection({
  title,
  subtitle,
  items = [],
  loading = false,
  context = 'HOME',
  icon = null
}) {
  const scrollRef = useRef(null);
  const impressionTracked = useRef(false);

  // Track impression once when items appear
  useEffect(() => {
    if (items.length > 0 && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(EventTypes.RECOMMENDATION_IMPRESSION, {
        metadata: {
          context,
          widgetTitle: title,
          productIds: items.slice(0, 10).map((p) => p.productId || p.id)
        }
      });
    }
  }, [items, context, title]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 420, behavior: 'smooth' });
  };

  // Don't render empty section after load completes
  if (!loading && items.length === 0) return null;

  const skeletonCount = 5;

  return (
    <section style={{ marginBottom: '48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-primary)'
          }}>
            {icon || <Sparkles size={18} style={{ color: 'var(--primary)' }} />}
            {title}
          </h2>
          {subtitle && !loading && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Scroll arrows */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-full)' }}
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-full)' }}
            onClick={() => scroll(1)}
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollbarWidth: 'none',     // Firefox
          msOverflowStyle: 'none',   // IE / Edge
        }}
      >
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((product, i) => (
              <RecommendationCard
                key={product.productId || product.id || i}
                product={product}
                widgetName={title}
              />
            ))
        }
      </div>

      {/* Hide scrollbar in webkit */}
      <style>{`
        section [ref] ::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
