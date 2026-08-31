import { useState, useEffect, useRef } from 'react';
import { hasFirebaseKeys, app } from '../services/firebase';

/**
 * useRecommendations — Phase 2 hook
 *
 * Fetches personalised recommendations from the Firebase callable function
 * `getPersonalisedRecommendations`. Supports all contexts:
 *   HOME | PRODUCT_PAGE | CATEGORY_PAGE | CART | SEARCH
 *
 * Falls back gracefully to mock/trending data when Firebase is unavailable.
 *
 * @param {Object} params
 * @param {string} params.context            Recommendation context
 * @param {string} [params.productId]        Seed product (PRODUCT_PAGE)
 * @param {string} [params.categoryId]       Seed category (CATEGORY_PAGE)
 * @param {number} [params.limit]            Max items to return (default 8)
 * @param {boolean} [params.skip]            Skip fetching (conditional rendering)
 * @returns {{ items, explanation, loading, error, isColdStart, refresh }}
 */
export function useRecommendations({
  context = 'HOME',
  productId = null,
  categoryId = null,
  limit = 8,
  skip = false
} = {}) {
  const [items, setItems] = useState([]);
  const [explanation, setExplanation] = useState('Recommended For You');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isColdStart, setIsColdStart] = useState(true);

  // Prevent duplicate calls with same params
  const lastFetchKey = useRef(null);

  const fetchKey = `${context}:${productId}:${categoryId}:${limit}`;

  const fetchRecommendations = async (force = false) => {
    if (skip) {
      setLoading(false);
      return;
    }
    if (!force && lastFetchKey.current === fetchKey) return;
    lastFetchKey.current = fetchKey;

    setLoading(true);
    setError(null);

    try {
      if (!hasFirebaseKeys) {
        // Mock mode: serve mock trending data from localStorage
        await new Promise((r) => setTimeout(r, 600)); // Simulate latency
        const mockEvents = JSON.parse(localStorage.getItem('vendora_mock_events') || '[]');
        const productIdCounts = {};
        mockEvents.forEach((ev) => {
          if (ev.productId) {
            productIdCounts[ev.productId] = (productIdCounts[ev.productId] || 0) + 1;
          }
        });

        // Build mock items from product sync cache
        const { getMarketplaceProducts } = await import('../utils/productSync');
        const allProducts = await getMarketplaceProducts();
        const scored = allProducts
          .filter((p) => p.stock > 0)
          .map((p) => ({ ...p, _mockScore: (productIdCounts[p.id] || 0) + (p.rating || 0) }))
          .sort((a, b) => b._mockScore - a._mockScore)
          .slice(0, limit);

        setItems(scored);
        setExplanation(context === 'HOME' ? 'Recommended For You' : 'Similar Products');
        setIsColdStart(mockEvents.length < 5);
        return;
      }

      // Live Firebase callable
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, 'getPersonalisedRecommendations');

      const result = await fn({
        context,
        seedProductId: productId,
        categoryId,
        limit,
        skipCache: force
      });

      if (result.data?.success) {
        setItems(result.data.items || []);
        setExplanation(result.data.explanation || 'Recommended For You');
        setIsColdStart(result.data.isColdStart ?? true);
      }
    } catch (err) {
      console.warn('[useRecommendations] fetch failed (silent):', err.message);
      setError(err.message);
      // Silent fail — don't crash UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, skip]);

  return {
    items,
    explanation,
    loading,
    error,
    isColdStart,
    refresh: () => fetchRecommendations(true)
  };
}
