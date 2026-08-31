import { app, hasFirebaseKeys } from '../firebase';
import { getOrCreateAnonymousId, getOrCreateSessionId } from './sessionManager';
import { EventTypes } from './eventTypes';

let trackEventCallable = null;

// Initialize functions reference lazily if Firebase credentials exist
const getTrackEventCallable = async () => {
  if (!hasFirebaseKeys) return null;
  if (trackEventCallable) return trackEventCallable;

  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app);
    trackEventCallable = httpsCallable(functions, 'trackEvent');
    return trackEventCallable;
  } catch (err) {
    console.error("Failed to initialize Firebase Functions for event tracking:", err);
    return null;
  }
};

/**
 * Dispatches an analytics event to the backend.
 * @param {string} eventType One of EventTypes
 * @param {Object} [payload] Optional event metadata
 * @param {string} [payload.productId] Related product ID
 * @param {string} [payload.categoryId] Related category slug
 * @param {Object} [payload.metadata] Sanitized contextual metadata
 */
export async function trackEvent(eventType, payload = {}) {
  // Prevent duplicate/empty triggers
  if (!eventType) return;

  const anonymousId = getOrCreateAnonymousId();
  const sessionId = getOrCreateSessionId();
  const timestamp = new Date().toISOString();

  // Retrieve current user ID safely from localStorage session if available
  let userId = null;
  try {
    // AuthContext caches auth state in localStorage
    // Find any key starting with vendora_role_ to get logged-in user uid
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vendora_role_')) {
        userId = key.replace('vendora_role_', '');
        break;
      }
    }
  } catch (e) {
    console.warn("Could not retrieve current user profile for event tracking:", e);
  }

  const { productId = null, categoryId = null, metadata = {} } = payload;

  const eventDoc = {
    userId,
    anonymousId,
    sessionId,
    eventType,
    productId,
    categoryId,
    timestamp,
    source: "web",
    metadata
  };

  // Log in console for development/debug
  console.log(`[VENDORA EVENT] ${eventType}:`, eventDoc);

  // If running in Mock/Demo Mode, store events in local storage
  if (!hasFirebaseKeys) {
    try {
      const mockEvents = JSON.parse(localStorage.getItem('vendora_mock_events') || '[]');
      // Limit local mock events to 200 items to prevent storage bloat
      if (mockEvents.length >= 200) {
        mockEvents.shift();
      }
      mockEvents.push(eventDoc);
      localStorage.setItem('vendora_mock_events', JSON.stringify(mockEvents));
      
      // Update mock user preferences locally
      updateLocalMockPreferences(eventDoc);
    } catch (e) {
      console.warn("Failed to write mock event to localStorage:", e);
    }
    return;
  }

  // Live Firebase execution
  try {
    const callable = await getTrackEventCallable();
    if (callable) {
      // Map event payload parameters directly to function expected schema
      // Map categoryId to category for functions/analytics/events.js compatibility
      const functionPayload = {
        userId,
        sessionId,
        anonymousId,
        eventType,
        productId,
        vendorId: payload.vendorId || null,
        category: categoryId,
        metadata
      };
      await callable(functionPayload);
    }
  } catch (err) {
    // Silent fail so tracking failures never break core UI transactions
    console.warn("Telemetry tracking event dispatch failed (silent fallback):", err.message);
  }
}

/**
 * Integrates local anonymous event history with newly logged-in user context.
 * @param {string} userId
 */
export async function mergeAnonymousHistory(userId) {
  if (!userId) return;

  const anonymousId = getOrCreateAnonymousId();

  if (!hasFirebaseKeys) {
    // Offline simulation: Update local mock events
    try {
      const mockEvents = JSON.parse(localStorage.getItem('vendora_mock_events') || '[]');
      const updated = mockEvents.map(e => {
        if (e.anonymousId === anonymousId) {
          return { ...e, userId };
        }
        return e;
      });
      localStorage.setItem('vendora_mock_events', JSON.stringify(updated));
    } catch (e) {}
    return;
  }

  // For live system, we track an association event that the preference engine calculates
  await trackEvent(EventTypes.SECURITY_EVENT, {
    metadata: {
      action: "ASSOCIATE_USER_HISTORY",
      userId,
      anonymousId
    }
  });
}

/**
 * Helper to dynamically recalculate mock user preferences in localStorage for mock mode demo.
 */
function updateLocalMockPreferences(event) {
  try {
    const userId = event.userId || event.anonymousId;
    const prefKey = `vendora_preferences_${userId}`;
    const currentPrefs = JSON.parse(localStorage.getItem(prefKey) || '{}');
    
    // Weights
    const weights = {
      PURCHASE: 10.0,
      CART_ADD: 5.0,
      WISHLIST_ADD: 3.0,
      PRODUCT_VIEW: 1.5,
      PRODUCT_CLICK: 1.0,
      CATEGORY_VIEW: 0.5,
      PRODUCT_SEARCH: 1.0
    };

    const weight = weights[event.eventType] || 0.5;
    
    // Aggregate category view counts
    if (event.categoryId) {
      const cats = currentPrefs.categories || {};
      cats[event.categoryId] = parseFloat(((cats[event.categoryId] || 0) + weight).toFixed(2));
      currentPrefs.categories = cats;
    }

    // Aggregate product view counts
    if (event.productId) {
      const interests = currentPrefs.interests || {};
      interests[event.productId] = parseFloat(((interests[event.productId] || 0) + weight).toFixed(2));
      currentPrefs.interests = interests;
    }

    currentPrefs.updatedAt = new Date().toISOString();
    localStorage.setItem(prefKey, JSON.stringify(currentPrefs));
  } catch (e) {
    console.warn("Could not update local mock preferences:", e);
  }
}
