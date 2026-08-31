/**
 * Vendora Input Validation & Sanitization Utility Suite
 * Hardens the frontend inputs against XSS injections, invalid formats, and weak credentials.
 */

/**
 * Validates email address format.
 * @param {string} email 
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Enforces strong password requirements (min 6 characters).
 * @param {string} password 
 * @returns {boolean}
 */
export function validatePassword(password) {
  if (!password) return false;
  return password.length >= 6;
}

/**
 * Validates Pakistani mobile phone numbers.
 * Supports formats: +923xxxxxxxxx, 923xxxxxxxxx, 03xxxxxxxxx, 3xxxxxxxxx
 * @param {string} phone 
 * @returns {boolean}
 */
export function validatePakPhone(phone) {
  if (!phone) return false;
  // Strip spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^(?:\+92|92|0)?3\d{9}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validates standard 5-digit Pakistani postal codes.
 * @param {string} code 
 * @returns {boolean}
 */
export function validatePostalCode(code) {
  if (!code) return false;
  const postalRegex = /^\d{5}$/;
  return postalRegex.test(code.trim());
}

/**
 * Sanitizes input strings to prevent basic cross-site scripting (XSS) HTML injections.
 * @param {string} text 
 * @returns {string}
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
