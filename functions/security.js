const { HttpsError } = require("firebase-functions/v2/https");

// Simple in-memory rate limiter
// Key format: `${uid}_${action}`
const rateLimitCache = new Map();

/**
 * Enforce rate limit for an action.
 * @param {string} uid User ID
 * @param {string} action Action name (e.g., 'ai_assistant', 'place_order')
 * @param {number} maxRequests Maximum allowed requests in the time window
 * @param {number} windowMs Time window in milliseconds
 */
function enforceRateLimit(uid, action, maxRequests = 5, windowMs = 60000) {
  if (!uid) return;
  const now = Date.now();
  const key = `${uid}_${action}`;
  
  if (!rateLimitCache.has(key)) {
    rateLimitCache.set(key, []);
  }
  
  const timestamps = rateLimitCache.get(key);
  // Remove expired timestamps
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (validTimestamps.length >= maxRequests) {
    throw new HttpsError("resource-exhausted", `Rate limit exceeded for action: ${action}. Please try again later.`);
  }
  
  validTimestamps.push(now);
  rateLimitCache.set(key, validTimestamps);
}

// Clean up cache periodically (every 10 mins) to prevent memory leaks in long-running instances
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitCache.entries()) {
    const validTimestamps = timestamps.filter(t => now - t < 3600000); // Keep up to 1 hour max for safety
    if (validTimestamps.length === 0) {
      rateLimitCache.delete(key);
    } else {
      rateLimitCache.set(key, validTimestamps);
    }
  }
}, 10 * 60 * 1000);

module.exports = {
  enforceRateLimit
};
