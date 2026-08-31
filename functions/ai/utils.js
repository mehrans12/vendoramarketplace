/**
 * Safely executes a promise with a specified timeout limit.
 * If the promise takes longer than timeoutMs, returns defaultValue instead of hanging.
 */
async function withTimeout(promise, timeoutMs = 5000, defaultValue = null) {
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[TIMEOUT_WARNING] Async operation timed out after ${timeoutMs}ms`);
      resolve(defaultValue);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { withTimeout };
