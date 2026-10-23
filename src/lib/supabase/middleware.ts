// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must call getUser() not getSession()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users from protected routes
  const isProtected = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/resume') ||
    request.nextUrl.pathname.startsWith('/upload') ||
    request.nextUrl.pathname.startsWith('/jobs') ||
    request.nextUrl.pathname.startsWith('/analytics') ||
    request.nextUrl.pathname.startsWith('/build') ||
    request.nextUrl.pathname.startsWith('/interview') ||
    request.nextUrl.pathname.startsWith('/settings')

  // Redirects must carry any session cookies refreshed by getUser() above,
  // otherwise a refreshed token is dropped and the user is logged out early.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c))
    return res
  }

  if (!user && isProtected) return redirectTo('/login')

  // Redirect logged-in users away from auth pages
  const isAuthPage = request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'

  if (user && isAuthPage) return redirectTo('/dashboard')

  return supabaseResponse
}
