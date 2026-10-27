// src/app/(auth)/signup/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/primitives'
import { AuthShell } from '@/components/auth/AuthShell'
import FloatInput from '@/components/vendor/smoothui/float-input'
import { Globe, Eye, EyeOff, MailCheck } from 'lucide-react'

const FIELD = 'h-12 rounded-xl border-white/12 bg-[#0b0c0d] text-slate-100 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0'

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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
  }

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  if (done) return (
    <AuthShell title="Check your email" subtitle="One more step.">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <div className="pop mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/15 text-violet-300"><MailCheck size={22} /></div>
        <p className="text-sm text-slate-400">We sent a confirmation link to <strong className="text-slate-200">{email}</strong></p>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever · bring your own AI key."
      footer={<>Have an account?{' '}<Link href="/login" className="text-violet-300 underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <button
        type="button" onClick={handleGoogle} disabled={loading}
        className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium transition-colors hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Globe size={16} />Continue with Google
      </button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8" /></div>
        <div className="relative flex justify-center"><span className="bg-[#0b0c0d] px-3 text-xs text-slate-500">or with email</span></div>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        <FloatInput label="Email" type="email" name="email" required autoComplete="email" value={email} onChange={setEmail} inputClassName={FIELD} />
        <FloatInput
          label="Password (8+ characters)" type={show ? 'text' : 'password'} name="password" required minLength={8} autoComplete="new-password"
          value={password} onChange={setPassword} inputClassName={`${FIELD} pr-11`}
          trailing={
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="text-slate-500 transition-colors hover:text-slate-200">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          }
        />
        {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <Button variant="primary" size="lg" className="w-full justify-center" loading={loading} type="submit">Create account</Button>
      </form>
    </AuthShell>
  )
}
export const dynamic = 'force-dynamic'
