// src/lib/security/caps.ts
// Per-owner row caps are enforced atomically by database triggers
// (supabase/migrations/004_atomic_caps.sql). They raise SQLSTATE 23514 with a
// message starting "limit_reached:" — this maps that to a 409 for the client.
// The routes' own count-before-insert stays as a fast path for a clear message.

export function isLimitReached(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && err.code === '23514' && (err.message ?? '').startsWith('limit_reached:')
}
