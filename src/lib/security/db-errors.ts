// src/lib/security/db-errors.ts
// Maps errors raised by the SECURITY DEFINER functions in
// supabase/migrations/005_security_remediation.sql to HTTP responses.
// Pure (no imports) so it can be unit-tested with node --test.

export interface DbError { code?: string; message?: string }
export interface MappedError { status: number; error: string; retryAfterSec?: number }

/** "rate_limited:<ms>" → seconds to wait (at least 1). */
export function retryAfterFromMessage(message: string | undefined): number {
  const ms = Number((message ?? '').split(':')[1])
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 60
}

export function mapCreateShareError(err: DbError | null | undefined, maxShares: number): MappedError {
  const code = err?.code ?? ''
  const msg = err?.message ?? ''
  if (code === 'P0001' && msg.startsWith('rate_limited:')) {
    return { status: 429, error: 'Too many share links created — try again later', retryAfterSec: retryAfterFromMessage(msg) }
  }
  if (code === '23514' && msg.startsWith('limit_reached:')) {
    return { status: 409, error: `Share link limit reached (${maxShares}). Revoke old links first.` }
  }
  if (code === 'P0002') return { status: 404, error: 'Resume not found' }
  if (code === '22023' && msg === 'invalid_password') return { status: 400, error: 'Invalid password' }
  if (code === '22023' && msg === 'invalid_expiry') return { status: 400, error: 'Invalid expiry' }
  if (code === '28000') return { status: 401, error: 'Unauthorized' }
  if (code === '42501' && msg === 'mfa_required') return { status: 403, error: 'Two-factor verification required' }
  return { status: 500, error: 'Failed to create share' }
}

export function mapDeleteAccountError(err: DbError | null | undefined): MappedError {
  const code = err?.code ?? ''
  if (code === '28000') return { status: 401, error: 'Unauthorized' }
  if (code === '42501' && err?.message === 'mfa_required') return { status: 403, error: 'Two-factor verification required' }
  return { status: 500, error: 'Account deletion failed — please try again.' }
}
