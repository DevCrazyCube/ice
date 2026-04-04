/**
 * In-memory fixed-window rate limiter.
 *
 * ⚠️  Single-instance only — not distributed. Each API process maintains its
 * own counters. This is acceptable for Phase 1 (single-process deployment).
 * For multi-instance deployments, replace with a Redis-backed implementation.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const windows = new Map<string, WindowEntry>();
  let checksSinceCleanup = 0;

  /** Remove entries whose window has expired. Runs every ~100 checks. */
  function maybeCleanup(now: number): void {
    checksSinceCleanup += 1;
    if (checksSinceCleanup < 100) return;
    checksSinceCleanup = 0;
    for (const [key, entry] of windows) {
      if (now >= entry.resetAt) windows.delete(key);
    }
  }

  return {
    /**
     * Check whether `key` is allowed to proceed.
     * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
     */
    check(key: string): { allowed: boolean; retryAfterMs: number } {
      const now = Date.now();
      maybeCleanup(now);
      const entry = windows.get(key);

      // No entry or window expired — start a new window
      if (!entry || now >= entry.resetAt) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterMs: 0 };
      }

      // Within window and under limit
      if (entry.count < maxRequests) {
        entry.count += 1;
        return { allowed: true, retryAfterMs: 0 };
      }

      // Over limit
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    },
  };
}
