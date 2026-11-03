// src/lib/security/same-origin.ts
// CSRF defence for cookie-authenticated API writes (A2). SameSite=Lax cookies
// already stop cross-site form posts; this also stops same-site ones (another
// subdomain of the same registrable domain), which Lax lets through.
//
// Browsers send Sec-Fetch-Site on every request (all current engines); when it
// is missing we fall back to the Origin header. Requests with neither header
// are not from a browser page, so they can't carry a victim's cookies by
// accident and are allowed through to the normal auth checks.
// Pure (no imports) so it can be unit-tested with node --test.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface WriteRequestInfo {
  method: string
  pathname: string
  secFetchSite: string | null
  origin: string | null
  /** Origins that count as "us": the configured public origin and the request's own origin. */
  allowedOrigins: readonly string[]
}

export function isCrossOriginApiWrite(r: WriteRequestInfo): boolean {
  if (!r.pathname.startsWith('/api/')) return false
  if (SAFE_METHODS.has(r.method.toUpperCase())) return false

  if (r.secFetchSite) {
    // 'none' = user-initiated (address bar, bookmark); never a page-driven write.
    return r.secFetchSite !== 'same-origin' && r.secFetchSite !== 'none'
  }
  if (r.origin) {
    if (r.origin === 'null') return true
    return !r.allowedOrigins.includes(r.origin)
  }
  return false
}
