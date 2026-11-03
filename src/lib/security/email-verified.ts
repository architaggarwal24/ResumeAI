// src/lib/security/email-verified.ts
// An account may use the app only once its email is confirmed. Supabase's
// "Confirm email" setting enforces this at sign-in; this check is the app's own
// backstop in case that setting is ever switched off, or a session predates it.
// OAuth sign-ins (e.g. Google) arrive with the email already confirmed.

export interface MaybeVerifiedUser {
  email?: string | null
  email_confirmed_at?: string | null
  confirmed_at?: string | null
}

export function isEmailVerified(user: MaybeVerifiedUser | null | undefined): boolean {
  if (!user) return false
  return Boolean(user.email_confirmed_at || user.confirmed_at)
}
