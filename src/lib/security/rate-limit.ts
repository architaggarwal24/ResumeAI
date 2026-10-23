// src/lib/security/rate-limit.ts
// Small fixed-window limiter. NOTE: state is per server instance. On
// serverless platforms this is a best-effort brake (each warm instance keeps
// its own counters), not a global quota — use an edge/WAF or a shared store
// (Redis/Upstash/Postgres) if a hard limit is required.

export interface RateDecision { allowed: boolean; remaining: number; retryAfterMs: number }

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const { limit, windowMs } = opts
  const maxKeys = opts.maxKeys ?? 5000
  const buckets = new Map<string, { count: number; resetAt: number }>()

  function sweep(now: number) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    // Still over capacity: evict oldest-inserted keys.
    while (buckets.size >= maxKeys) {
      const first = buckets.keys().next().value
      if (first === undefined) break
      buckets.delete(first)
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateDecision {
      let b = buckets.get(key)
      if (!b || b.resetAt <= now) {
        if (!b && buckets.size >= maxKeys) sweep(now)
        b = { count: 0, resetAt: now + windowMs }
        buckets.set(key, b)
      }
      if (b.count >= limit) return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, b.resetAt - now) }
      b.count++
      return { allowed: true, remaining: limit - b.count, retryAfterMs: 0 }
    },
    size: () => buckets.size,
  }
}
