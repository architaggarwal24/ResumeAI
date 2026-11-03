// src/lib/security/mfa.ts
// Two-factor (TOTP) assurance checks (L2 / B1). A user who has enrolled a
// verified factor must reach aal2 (password + code) before the app treats
// them as signed in. The database enforces the same rule in RLS
// (migration 005, public.session_meets_mfa()).
// Pure (no imports) so it can be unit-tested with node --test.

export type Aal = 'aal1' | 'aal2' | null

interface FactorLike { status?: string | null }
interface UserLike { factors?: FactorLike[] | null }

/** Reads the `aal` claim from a Supabase access token. Does NOT verify the
 *  signature: only call it on a token the server already validated (getUser). */
export function aalFromAccessToken(token: string | null | undefined): Aal {
  if (!token) return null
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
    const aal = (JSON.parse(json) as { aal?: unknown }).aal
    return aal === 'aal1' || aal === 'aal2' ? aal : null
  } catch {
    return null
  }
}

export function hasVerifiedFactor(user: UserLike | null | undefined): boolean {
  return !!user?.factors?.some(f => f.status === 'verified')
}

/** True when the user has a verified factor but this session hasn't used it yet. */
export function needsSecondFactor(user: UserLike | null | undefined, accessToken: string | null | undefined): boolean {
  return hasVerifiedFactor(user) && aalFromAccessToken(accessToken) !== 'aal2'
}

/** Client-side form of the same rule, from supabase.auth.mfa.getAuthenticatorAssuranceLevel(). */
export function shouldChallenge(level: { currentLevel?: string | null; nextLevel?: string | null } | null | undefined): boolean {
  return level?.nextLevel === 'aal2' && level.currentLevel !== 'aal2'
}
