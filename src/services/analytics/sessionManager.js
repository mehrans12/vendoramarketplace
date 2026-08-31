/**
 * Manages anonymous user IDs and session states for telemetry tracking.
 */

/**
 * Returns or creates a persistent anonymous identifier.
 * @returns {string}
 */
export function getOrCreateAnonymousId() {
  let anonId = localStorage.getItem('vendora_anonymous_id');
  if (!anonId) {
    // Generate simple stable uuid fallback
    const rand = () => Math.random().toString(36).substring(2, 15);
    anonId = `anon-${Date.now()}-${rand()}-${rand()}`;
    localStorage.setItem('vendora_anonymous_id', anonId);
  }
  return anonId;
}

/**
 * Returns or creates a session-specific identifier.
 * @returns {string}
 */
export function getOrCreateSessionId() {
  let sessId = sessionStorage.getItem('vendora_session_id');
  if (!sessId) {
    const rand = () => Math.random().toString(36).substring(2, 10);
    sessId = `sess-${Date.now()}-${rand()}`;
    sessionStorage.setItem('vendora_session_id', sessId);
  }
  return sessId;
}
