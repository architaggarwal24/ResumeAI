// src/lib/security/redirect.ts
// Open-redirect guard for post-auth `next` parameters.
//
// The auth callback previously built `${origin}${next}` from an untrusted
// query value. `next=@evil.example` or `next=.evil.example` yields
// https://app.example.com@evil.example / https://app.example.com.evil.example,
// i.e. a different host. Only same-origin absolute *paths* are allowed.

export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return fallback
  // Must be an absolute path: one leading slash, not protocol-relative.
  if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return fallback
  // No backslashes (browsers treat them as slashes) or control characters
  // (tab/newline are stripped by URL parsers, turning "/\t/x" into "//x").
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback
  try {
    const base = 'http://localhost'
    const u = new URL(raw, base)
    if (u.origin !== base) return fallback
  } catch {
    return fallback
  }
  return raw
}
