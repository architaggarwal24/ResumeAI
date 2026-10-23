// next.config.ts
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// Origins the browser is allowed to talk to. All LLM traffic goes through our own
// /api routes (BYOK keys are forwarded by the server, never called from the
// browser), so the only third party is Supabase (auth + REST).
function supabaseOrigins(): string[] {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    return [u.origin, `wss://${u.host}`]
  } catch {
    return []
  }
}

// CSP notes:
//  * script-src keeps 'unsafe-inline' because the App Router emits inline
//    hydration scripts; moving to nonces requires dynamic rendering for every
//    page (see Next.js "Content Security Policy" guide). Even so this blocks
//    third-party scripts (e.g. the old cdnjs pdf.js), framing, <base> and plugin
//    injection, and form posts to other origins.
//  * style-src needs 'unsafe-inline': resume templates use inline style attributes.
//  * worker-src allows blob: for pdf.js' worker.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigins().join(' ')}${isProd ? '' : ' ws: http://localhost:*'}`.trim(),
  `worker-src 'self' blob:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses carry personal data (resumes, jobs) — never cache them in shared caches.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig
