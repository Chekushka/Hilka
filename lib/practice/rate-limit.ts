/**
 * A fixed-window rate limiter, keyed by caller.
 *
 * Used to throttle `/api/progress` and `/api/progress/restore`: a progress
 * code is a bearer credential with no other guard (docs/AI_CONTEXT.md,
 * "Progress Codes"), so the entry point that accepts one from a client must
 * make guessing all 31^8 combinations impractical.
 *
 * In-memory and per-instance, not shared across Vercel function instances —
 * a real limit at this deployment's scale (~25 concurrent users), but not a
 * hard guarantee under multiple warm instances. A durable store (Neon,
 * Upstash) would close that gap; not worth the dependency yet.
 */
export interface RateLimiter {
  /** Records one attempt for `key`; returns false once the window's limit is spent. */
  attempt(key: string, now?: number): boolean;
}

export function createFixedWindowLimiter(maxAttempts: number, windowMs: number): RateLimiter {
  const windows = new Map<string, { count: number; windowStart: number }>();

  return {
    attempt(key: string, now: number = Date.now()): boolean {
      const entry = windows.get(key);
      if (!entry || now - entry.windowStart >= windowMs) {
        windows.set(key, { count: 1, windowStart: now });
        return true;
      }
      if (entry.count >= maxAttempts) return false;
      entry.count += 1;
      return true;
    }
  };
}
