// src/lib/security/shared-rate-limit.ts
// Result parsing for the database-backed limiter, public.rate_limit_hit()
// (migration 005). Unlike the in-memory limiter it holds across every server
// instance. Pure (no imports) so it can be unit-tested with node --test.

export interface SharedDecision { allowed: boolean; remaining: number; retryAfterMs: number }

/** Database bucket names; the limits themselves live in the SQL function. */
export const SHARED_BUCKETS = {
  ai: 'ai',
  llmProxy: 'llm_proxy',
  testConn: 'test_conn',
  export: 'export',
  write: 'write',
} as const
export type SharedLimiterName = keyof typeof SHARED_BUCKETS

/**
 * Returns null when the shared store couldn't answer (migration not applied,
 * database error). Callers then rely on the in-memory limiter they already
 * checked, rather than failing every request.
 */
export function parseSharedDecision(data: unknown, error: unknown): SharedDecision | null {
  if (error || !data || typeof data !== 'object') return null
  const d = data as { allowed?: unknown; remaining?: unknown; retry_after_ms?: unknown }
  if (typeof d.allowed !== 'boolean') return null
  if (d.allowed) return { allowed: true, remaining: typeof d.remaining === 'number' ? d.remaining : 0, retryAfterMs: 0 }
  const ms = typeof d.retry_after_ms === 'number' && d.retry_after_ms > 0 ? d.retry_after_ms : 60_000
  return { allowed: false, remaining: 0, retryAfterMs: ms }
}
