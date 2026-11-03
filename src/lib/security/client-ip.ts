// src/lib/security/client-ip.ts
// The client IP for per-IP rate limits (A16 ③). X-Forwarded-For can be set by
// the client, and some hosts append to it rather than replace it, so headers
// the platform itself sets win:
//   Netlify: x-nf-client-connection-ip · Vercel/most proxies: x-real-ip
// X-Forwarded-For (first hop) is the last resort. Values that don't look like
// an IP address are ignored, so a forged header can't create arbitrary keys.
// Pure (no imports) so it can be unit-tested with node --test.

interface HeaderBag { get(name: string): string | null }

const IP_RE = /^[0-9a-fA-F:.]{2,45}$/

function clean(v: string | null | undefined): string | null {
  const s = v?.trim()
  return s && IP_RE.test(s) ? s : null
}

export function clientIpFromHeaders(h: HeaderBag): string {
  return (
    clean(h.get('x-nf-client-connection-ip')) ??
    clean(h.get('x-real-ip')) ??
    clean(h.get('x-forwarded-for')?.split(',')[0]) ??
    'unknown'
  )
}
