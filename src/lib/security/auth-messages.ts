// src/lib/security/auth-messages.ts
// Account-enumeration guard for the auth UI.
//
// Supabase's raw errors reveal whether an email has an account: "User already
// registered" on signup (when email confirmation is off) and "Email not
// confirmed" on login. The pages used to show error.message verbatim. These
// helpers map every auth failure to a fixed, non-revealing message, keeping
// only distinctions that say nothing about a specific account (rate limit,
// network, weak password).

export type AuthAction = 'login' | 'signup' | 'oauth'

export interface AuthErrorLike {
  message?: string
  code?: string
  status?: number
}

export const AUTH_MESSAGES = {
  login: 'Email or password is incorrect. If you just signed up, confirm your email first.',
  signup: 'We couldn’t create your account. Check your details and try again.',
  oauth: 'Couldn’t start Google sign-in. Please try again.',
  rateLimited: 'Too many attempts. Wait a minute and try again.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
  weakPassword: 'Choose a stronger password: 8+ characters with a mix of letters, numbers and symbols.',
} as const

const EXISTING_CODES = new Set(['user_already_exists', 'email_exists', 'identity_already_exists'])
const RATE_CODES = new Set(['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'])

/** True when signup failed only because the email already has an account. */
export function isExistingAccountError(err: AuthErrorLike | null | undefined): boolean {
  if (!err) return false
  if (err.code && EXISTING_CODES.has(err.code)) return true
  return /already (been )?registered|already exists/i.test(err.message ?? '')
}

export function publicAuthError(action: AuthAction, err: AuthErrorLike | null | undefined): string {
  const msg = err?.message ?? ''
  if (err?.status === 429 || (err?.code && RATE_CODES.has(err.code)) || /rate limit/i.test(msg)) return AUTH_MESSAGES.rateLimited
  if (/failed to fetch|network|load failed/i.test(msg)) return AUTH_MESSAGES.network
  if (action === 'signup' && (err?.code === 'weak_password' || /password.*(at least|short|weak|characters)/i.test(msg))) {
    return AUTH_MESSAGES.weakPassword
  }
  return AUTH_MESSAGES[action]
}
