// src/lib/security/csp.ts
// Content-Security-Policy builder (L1 / C20). Pages get a fresh nonce per
// request from src/proxy.ts; Next.js reads it from the request's CSP header
// and stamps it on its own scripts. Inline scripts without the nonce (for
// example from an HTML-injection bug) are blocked, which protects the
// script-readable session cookie (A14) and BYOK keys in sessionStorage (B19).
//
//  * 'strict-dynamic' lets the nonce'd Next.js runtime load its own chunks.
//  * style-src keeps 'unsafe-inline': resume templates and animations use
//    inline style attributes, which nonces can't cover. Styles can't run code.
//  * worker-src allows blob: for pdf.js' worker.
// Pure (no imports) so it can be unit-tested with node --test.

export interface CspOptions { nonce: string; isProd: boolean; supabaseUrl?: string }

function supabaseOrigins(raw?: string): string[] {
  try {
    const u = new URL(raw ?? '')
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return []
    return [u.origin, `wss://${u.host}`]
  } catch {
    return []
  }
}

export function buildPageCsp({ nonce, isProd, supabaseUrl }: CspOptions): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? '' : " 'unsafe-eval'"}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseOrigins(supabaseUrl).join(' ')}${isProd ? '' : ' ws: http://localhost:*'}`.replace(/\s+/g, ' ').trim(),
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

/** API responses are JSON/files, never pages: lock them down completely. */
export const API_CSP = `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`

/** 128 random bits, base64. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
