/**
 * Pre-built recommendation widgets for Vendora Phase 2.
 *
 * Each widget wraps RecommendationSection with a specific context, title, and icon.
 * Import the widget you need rather than wiring context manually.
 *
 * Usage:
 *   import { RecommendedForYou, SimilarProducts, TrendingProducts } from '../components/recommendations/widgets';
 */

import React from 'react';
import { TrendingUp, Zap, Eye, Flame, Star, ShoppingBag, Heart } from 'lucide-react';
import RecommendationSection from './RecommendationSection';
import { useRecommendations } from '../../hooks/useRecommendations';

/* ── Recommended For You (HOME) ─────────────────────────────────────────── */
export function RecommendedForYou({ limit = 8 }) {
  const { items, explanation, loading } = useRecommendations({ context: 'HOME', limit });
  return (
    <RecommendationSection
      title="Recommended For You"
      subtitle={explanation}
      items={items}
      loading={loading}
      context="HOME"
      icon={<Star size={18} style={{ color: 'var(--secondary)' }} />}
    />
  );
}

/* ── Because You Viewed (PRODUCT_PAGE or HOME) ──────────────────────────── */
export function BecauseYouViewed({ productId, limit = 8 }) {
  const activeProductId = productId || (() => {
    try {
      return localStorage.getItem('vendora_last_viewed_product_id');
    } catch (e) {
      return null;
    }
  })();

  const { items, explanation, loading } = useRecommendations({
    context: 'PRODUCT_PAGE',
    productId: activeProductId,
    limit,
    skip: !activeProductId
  });

  if (!activeProductId && !loading) return null;

  return (
    <RecommendationSection
      title="Because You Viewed"
      subtitle={explanation || "Hand-picked items aligned with your recent browsing"}
      items={items}
      loading={loading}
      context="PRODUCT_PAGE"
      icon={<Eye size={18} style={{ color: 'var(--primary)' }} />}
    />
  );
}

/* ── Similar Products (PRODUCT_PAGE or HOME) ────────────────────────────── */
export function SimilarProducts({ productId, categoryId, limit = 8 }) {
  const activeProductId = productId || (() => {
    try {
      return localStorage.getItem('vendora_last_viewed_product_id');
    } catch (e) {
      return null;
    }
  })();
  const activeCategoryId = categoryId || (() => {
    try {
      return localStorage.getItem('vendora_last_viewed_category') || 'handicrafts';
    } catch (e) {
      return 'handicrafts';
    }
  })();

  const { items, explanation, loading } = useRecommendations({
    context: 'PRODUCT_PAGE',
    productId: activeProductId,
    categoryId: activeCategoryId,
    limit,
    skip: false
  });

  return (
    <RecommendationSection
      title="Similar Products"
      subtitle={explanation || "Handcrafted pieces that share related techniques and heritage"}
      items={items}
      loading={loading}
      context="PRODUCT_PAGE"
      icon={<Zap size={18} style={{ color: 'var(--accent)' }} />}
    />
  );
}

/* ── Based on Your Interests (CATEGORY_PAGE or HOME) ────────────────────── */
export function InterestRecommendations({ categoryId, limit = 8 }) {
  const activeCategoryId = categoryId || (() => {
    try {
      return localStorage.getItem('vendora_last_viewed_category') || 'handicrafts';
    } catch (e) {
      return 'handicrafts';
    }
  })();

  const { items, explanation, loading } = useRecommendations({
    context: 'CATEGORY_PAGE',
    categoryId: activeCategoryId,
    limit,
    skip: false
  });

  return (
    <RecommendationSection
      title="Based on Your Interests"
      subtitle={explanation || `Curated selections in ${activeCategoryId}`}
      items={items}
      loading={loading}
      context="CATEGORY_PAGE"
      icon={<Heart size={18} style={{ color: 'var(--secondary)' }} />}
    />
  );
}

/* ── Trending on Vendora (universal) ────────────────────────────────────── */
export function TrendingProducts({ limit = 8 }) {
  const { items, explanation, loading } = useRecommendations({ context: 'HOME', limit });
  return (
    <RecommendationSection
      title="Trending on Vendora"
      subtitle="Popular products in our marketplace right now"
      items={items}
      loading={loading}
      context="HOME"
      icon={<TrendingUp size={18} style={{ color: 'var(--primary)' }} />}
    />
  );
}

/* ── Popular Products (Anonymous & New Arrivals) ────────────────────────── */
export function PopularProducts({ limit = 8 }) {
  const { items, loading } = useRecommendations({ context: 'HOME', limit });
  return (
    <RecommendationSection
      title="Popular Across Pakistan"
      subtitle="Most loved and highest-rated artisan craftwork"
      items={items}
      loading={loading}
      context="HOME"
      icon={<Star size={18} style={{ color: '#f59e0b' }} />}
    />
  );
}

/* ── New For You (HOME) ─────────────────────────────────────────────────── */
export function NewForYou({ limit = 8 }) {
  const { items, loading } = useRecommendations({ context: 'HOME', limit });
  return (
    <RecommendationSection
      title="New For You"
      subtitle="Fresh arrivals tailored to your tastes"
      items={items}
      loading={loading}
      context="HOME"
      icon={<Flame size={18} style={{ color: 'var(--danger)' }} />}
    />
  );
}

/* ── New Arrivals (universal) ───────────────────────────────────────────── */
export function NewArrivals({ limit = 8 }) {
  const { items, loading } = useRecommendations({ context: 'HOME', limit });
  return (
    <RecommendationSection
      title="New Arrivals"
      subtitle="Latest additions from verified Pakistani artisans"
      items={items}
      loading={loading}
      context="HOME"
      icon={<Flame size={18} style={{ color: '#ef4444' }} />}
    />
  );
}

/* ── Frequently Bought Together (CART or HOME) ──────────────────────────── */
export function FrequentlyBoughtTogether({ limit = 6 }) {
  const { items, explanation, loading } = useRecommendations({ context: 'CART', limit });
  return (
    <RecommendationSection
      title="Frequently Bought Together"
      subtitle={explanation || "Complementary artisan pairings commonly purchased together"}
      items={items}
      loading={loading}
      context="CART"
      icon={<ShoppingBag size={18} style={{ color: 'var(--primary)' }} />}
    />
  );
}

