// src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isCrossOriginApiWrite } from '@/lib/security/same-origin'
import { buildPageCsp, generateNonce, API_CSP } from '@/lib/security/csp'
import { logSecurityEvent } from '@/lib/security/security-log'

function allowedOrigins(request: NextRequest): string[] {
  const list = [request.nextUrl.origin]
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) list.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin)
  } catch { /* invalid config: request origin only */ }
  return list
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  // CSRF: cookie-authenticated writes must come from our own pages (A2).
  if (isCrossOriginApiWrite({
    method: request.method,
    pathname,
    secFetchSite: request.headers.get('sec-fetch-site'),
    origin: request.headers.get('origin'),
    allowedOrigins: allowedOrigins(request),
  })) {
    logSecurityEvent('cross_origin_blocked', { path: pathname, method: request.method, site: request.headers.get('sec-fetch-site') })
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403, headers: { 'Content-Security-Policy': API_CSP } })
  }

  // Nonce-based CSP for pages (L1). Next.js reads the nonce from the request's
  // CSP header while rendering and adds it to its own scripts.
  let csp = API_CSP
  if (!isApi) {
    const nonce = generateNonce()
    csp = buildPageCsp({ nonce, isProd: process.env.NODE_ENV === 'production', supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })
    request.headers.set('x-nonce', nonce)
    request.headers.set('content-security-policy', csp)
  }

  const response = await updateSession(request)
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
