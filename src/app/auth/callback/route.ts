// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/security/redirect'
import { appOrigin } from '@/lib/security/app-origin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` is attacker-controllable: only same-origin absolute paths are honoured
  // (previously `${origin}${next}` let "@evil.example" / ".evil.example" change the host).
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${appOrigin(origin)}${next}`)
    }
  }

  return NextResponse.redirect(`${appOrigin(origin)}/login?error=auth_callback_failed`)
}
