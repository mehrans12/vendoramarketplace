import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const ERROR_CATEGORIES = {
  AUTH_ERROR: 'AUTH_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SEARCH_ERROR: 'SEARCH_ERROR',
  AI_ERROR: 'AI_ERROR',
  RAG_ERROR: 'RAG_ERROR',
  RECOMMENDATION_ERROR: 'RECOMMENDATION_ERROR',
  ORDER_ERROR: 'ORDER_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  SECURITY_ERROR: 'SECURITY_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UI_ERROR: 'UI_ERROR',
  UNKNOWN: 'UNKNOWN'
};

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'apikey', 'creditcard', 'cc', 'cvv'];

/**
 * Strips sensitive data from log payloads
 */
const sanitizePayload = (payload) => {
  if (!payload) return payload;
  if (typeof payload !== 'object') return payload;

  const sanitized = { ...payload };
  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const isSensitive = SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk));
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizePayload(sanitized[key]); // Recursive sanitize
      }
    }
  }
  return sanitized;
};

/**
 * Global Frontend Logger
 */
class Logger {
  async log(level, category, message, payload = {}, userId = null) {
    const sanitizedPayload = sanitizePayload(payload);
    const logEntry = {
      level,
      category,
      message,
      payload: sanitizedPayload,
      userId: userId || 'anonymous',
      source: 'frontend',
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log to console for local debugging
    if (level === 'error') {
      console.error(`[${category}] ${message}`, sanitizedPayload);
    } else if (level === 'warn') {
      console.warn(`[${category}] ${message}`, sanitizedPayload);
    } else {
      console.log(`[${category}] ${message}`, sanitizedPayload);
    }

    try {
      if (db) {
        await addDoc(collection(db, 'system_logs'), logEntry);
      }
    } catch (e) {
      console.error("Failed to write to system_logs:", e);
    }
  }

  error(category, message, payload = {}, userId = null) {
    return this.log('error', category, message, payload, userId);
  }

  warn(category, message, payload = {}, userId = null) {
    return this.log('warn', category, message, payload, userId);
  }

  info(category, message, payload = {}, userId = null) {
    return this.log('info', category, message, payload, userId);
  }
}

export const logger = new Logger();
