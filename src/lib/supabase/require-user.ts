// src/lib/supabase/require-user.ts
// Server-side auth gate for pages. Middleware also redirects, but every page
// that reads user data checks for itself: middleware can be skipped by matcher
// gaps or framework bugs, and layouts don't re-run on every client navigation.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isEmailVerified } from '@/lib/security/email-verified'
import { sessionNeedsSecondFactor } from '@/lib/security/guards'

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (!isEmailVerified(user)) redirect('/verify-email')
  if (await sessionNeedsSecondFactor(supabase, user)) redirect('/mfa')
  return { supabase, user }
}
