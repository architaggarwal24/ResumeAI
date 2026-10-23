// src/lib/security/url.ts
// Validators for user-supplied URLs that are later rendered as links.

const MAX_URL = 2048

/** Returns a normalised http(s) URL, or null. Rejects javascript:, data:, credentials, etc. */
export function safeHttpUrl(raw: unknown, maxLen = MAX_URL): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s || s.length > maxLen) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(s)) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    // Bare host like "example.com/careers" — only accept when it looks like one.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(s)) return null
    s = `https://${s}`
  }
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  return u.href
}

/** Returns the value if it is a same-origin absolute path (e.g. "/jobs"), else null. */
export function safeInternalHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL) return null
  if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return null
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const base = 'http://localhost'
    if (new URL(raw, base).origin !== base) return null
  } catch { return null }
  return raw
}
