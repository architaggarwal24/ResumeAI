// src/lib/security/app-origin.ts
// Absolute URLs we hand out (share links, post-login redirects) must come from
// configuration, not from the request's Host header — a forged Host would
// otherwise put an attacker's domain into links users trust.
//
// Order: NEXT_PUBLIC_APP_URL → Netlify `URL` → Vercel `VERCEL_PROJECT_PRODUCTION_URL`.
// The request's own origin is accepted only outside production (local dev).

type Env = Record<string, string | undefined>

function originOf(raw: string | undefined, assumeHttps = false): string | null {
  if (!raw) return null
  try {
    const u = new URL(assumeHttps && !/^[a-z]+:\/\//i.test(raw) ? `https://${raw}` : raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.origin
  } catch {
    return null
  }
}

/** Pure resolver (env passed in so it can be unit-tested). */
export function resolveAppOrigin(requestOrigin: string, env: Env): string {
  const configured =
    originOf(env.NEXT_PUBLIC_APP_URL) ??
    originOf(env.URL) ??
    originOf(env.VERCEL_PROJECT_PRODUCTION_URL, true)
  if (configured) return configured
  if (env.NODE_ENV === 'production') {
    throw new Error('Set NEXT_PUBLIC_APP_URL to the site’s public URL (absolute links are not built from the Host header).')
  }
  return originOf(requestOrigin) ?? 'http://localhost:3000'
}

/** Server-side: the public origin of this deployment. */
export function appOrigin(requestOrigin: string): string {
  return resolveAppOrigin(requestOrigin, {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    URL: process.env.URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    NODE_ENV: process.env.NODE_ENV,
  })
}

/**
 * Browser-side: configured origin if NEXT_PUBLIC_APP_URL was set at build time,
 * otherwise the page's own origin (the browser can't be Host-spoofed). Supabase
 * still checks the result against its Redirect URLs allowlist.
 */
export function clientAppOrigin(): string {
  return resolveAppOrigin(window.location.origin, { NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL })
}
