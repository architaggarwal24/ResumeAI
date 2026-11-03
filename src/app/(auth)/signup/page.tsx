// src/app/(auth)/signup/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormError, OAuthButton, OrDivider, RevealToggle, StrengthMeter } from '@/components/auth/AuthBits'
import { Field } from '@/components/ui/glass/Field'
import { Button } from '@/components/ui/glass/Button'
import { SPRING } from '@/lib/motion'
import { clientAppOrigin } from '@/lib/security/app-origin'
import { isExistingAccountError, publicAuthError } from '@/lib/security/auth-messages'

export default function SignupPage() {
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${clientAppOrigin()}/auth/callback` },
    })
    // An existing account gets the same "check your email" screen as a new one,
    // so signup can't be used to probe which emails are registered.
    if (error && !isExistingAccountError(error)) { setError(publicAuthError('signup', error)); setLoading(false); return }
    setDone(true)
  }

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${clientAppOrigin()}/auth/callback` },
    })
    if (error) { setError(publicAuthError('oauth', error)); setLoading(false) }
  }

  if (done) return (
    <AuthShell title="Check your email" subtitle="One more step and you’re in.">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={SPRING.bouncy}
          className="relative mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-violet-500/20 text-violet-200 shadow-[0_0_40px_-6px_rgba(139,92,246,.8)]"
        >
          <span aria-hidden className="absolute inset-0 animate-[ping-soft_2s_ease-out_infinite] rounded-2xl border border-violet-300/50" />
          <MailCheck size={28} />
        </motion.div>
        <p className="text-sm text-slate-300">If this address can be used, a confirmation link is on its way to</p>
        <p className="mt-1 font-mono text-sm text-white">{email}</p>
        <p className="mt-5 text-xs text-slate-500">Can’t find it? Check spam. Already have an account? <Link href="/login" className="text-violet-300 hover:underline">Sign in</Link>.</p>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever · bring your own AI key."
      footer={<>Have an account?{' '}<Link href="/login" className="font-medium text-violet-300 underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <OAuthButton onClick={handleGoogle} disabled={loading}>Continue with Google</OAuthButton>
      <OrDivider />

      <form onSubmit={handleSignup} className="space-y-4">
        <Field label="Email" type="email" name="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Field
          label="Password" type={show ? 'text' : 'password'} name="password" required minLength={8} autoComplete="new-password"
          value={password} onChange={e => setPassword(e.target.value)}
          trailing={<RevealToggle shown={show} onToggle={() => setShow(s => !s)} />}
          hint={<StrengthMeter password={password} />}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={loading} className="w-full" trailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
export const dynamic = 'force-dynamic'
