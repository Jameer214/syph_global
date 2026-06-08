// Simple in-memory rate limiter for client-side use
// For production scale (1M users), use Upstash Redis via Vercel KV

const attempts: Map<string, number[]> = new Map();

/**
 * Check whether a key has exceeded its rate limit.
 * @param key        Unique identifier, e.g. 'login:user@email.com'
 * @param maxAttempts Maximum number of attempts allowed within the window
 * @param windowMs   Time window in milliseconds
 * @returns true if the action is allowed, false if the limit has been reached
 *
 * Example:
 *   checkRateLimit('login:user@email.com', 5, 60000)
 *   → false if 5 or more attempts were made in the last 60 seconds
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxAttempts) return false;
  timestamps.push(now);
  attempts.set(key, timestamps);
  return true;
}
