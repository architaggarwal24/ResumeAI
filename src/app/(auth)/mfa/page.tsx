// src/app/(auth)/mfa/page.tsx
// Second sign-in step for accounts with two-factor authentication (TOTP).
// The middleware sends password-only (aal1) sessions here, and the API and
// database refuse them until this step succeeds (see src/lib/security/mfa.ts).
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormError } from '@/components/auth/AuthBits'
import { Field } from '@/components/ui/glass/Field'
import { Button } from '@/components/ui/glass/Button'
import { safeNextPath } from '@/lib/security/redirect'
import { shouldChallenge } from '@/lib/security/mfa'

export default function MfaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const next = () => safeNextPath(new URLSearchParams(window.location.search).get('next'))

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!shouldChallenge(level)) { router.replace(next()); return }
      const { data } = await supabase.auth.mfa.listFactors()
      const totp = data?.totp?.find(f => f.status === 'verified')
      if (!totp) { router.replace(next()); return }
      setFactorId(totp.id)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    if (error) {
      setError('That code didn’t work. Check your authenticator app and try again.')
      setLoading(false)
      return
    }
    router.replace(next())
    router.refresh()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <AuthShell title="Two-factor check" subtitle="Enter the 6-digit code from your authenticator app.">
      <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-violet-500/20 text-violet-200 shadow-[0_0_40px_-6px_rgba(139,92,246,.8)]">
        <ShieldCheck size={28} />
      </div>
      <form onSubmit={verify} className="space-y-4">
        <Field
          label="Authentication code" name="code" required autoFocus
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!factorId || code.length !== 6}>
          Verify
        </Button>
        <Button type="button" size="lg" variant="ghost" className="w-full" onClick={signOut} leading={<LogOut className="size-4" />}>
          Sign out
        </Button>
      </form>
    </AuthShell>
  )
}
