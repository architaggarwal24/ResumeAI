// src/app/(auth)/verify-email/page.tsx
// Shown when a signed-in account hasn't confirmed its email yet. The app layout
// and every API route refuse unconfirmed accounts, so this is the only screen
// they can reach until the link in the confirmation email is clicked.
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MailCheck, RefreshCw, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormError } from '@/components/auth/AuthBits'
import { Button } from '@/components/ui/glass/Button'
import { clientAppOrigin } from '@/lib/security/app-origin'
import { isEmailVerified } from '@/lib/security/email-verified'
import { publicAuthError } from '@/lib/security/auth-messages'

export default function VerifyEmailPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail]   = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      if (isEmailVerified(user)) { router.replace('/dashboard'); return }
      setEmail(user.email ?? null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function resend() {
    if (!email) return
    setSending(true); setError('')
    const { error } = await supabase.auth.resend({
      type: 'signup', email,
      options: { emailRedirectTo: `${clientAppOrigin()}/auth/callback` },
    })
    setSending(false)
    if (error) { setError(publicAuthError('signup', error)); return }
    setSent(true)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <AuthShell title="Confirm your email" subtitle="One last step before you can use ResumeAI.">
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-violet-500/20 text-violet-200 shadow-[0_0_40px_-6px_rgba(139,92,246,.8)]">
          <MailCheck size={28} />
        </div>
        <p className="text-sm text-slate-300">Open the confirmation link we sent to</p>
        <p className="mt-1 min-h-5 font-mono text-sm text-white">{email ?? ' '}</p>
        <p className="mt-3 text-xs text-slate-500">Then come back here — or refresh this page once you’ve clicked it.</p>
      </div>
      <div className="mt-6 space-y-3">
        <FormError message={error} />
        <Button size="lg" className="w-full" onClick={resend} loading={sending} disabled={!email || sent} leading={<RefreshCw className="size-4" />}>
          {sent ? 'Link sent — check your inbox' : 'Resend confirmation link'}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={signOut} leading={<LogOut className="size-4" />}>
          Use a different account
        </Button>
      </div>
    </AuthShell>
  )
}
