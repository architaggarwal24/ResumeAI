// src/app/(auth)/signup/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/primitives'
import { AuthShell } from '@/components/auth/AuthShell'
import { Mail, Lock, Globe, Eye, EyeOff } from 'lucide-react'

const inputCls = 'w-full bg-[#101015]/80 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 transition-colors focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15'

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
    <AuthShell title="Check your email" subtitle="One more step">
      <div className="text-center">
        <div className="text-4xl mb-3">✉️</div>
        <p className="text-slate-400 text-sm">We sent a confirmation link to <strong className="text-slate-200">{email}</strong></p>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell
      title="Create account"
      subtitle="Free forever · BYOK"
      footer={<>Have an account?{' '}<Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">Sign in</Link></>}
    >
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 mb-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Globe size={16} />
        Continue with Google
      </button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8" /></div>
        <div className="relative flex justify-center"><span className="px-3 bg-[#14141a] text-xs text-slate-500 rounded">or email</span></div>
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" aria-label="Email" className={inputCls} />
        </div>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password (8+ chars)" aria-label="Password" className={`${inputCls} pr-10`} />
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
        <Button variant="primary" className="w-full justify-center" loading={loading} type="submit">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
export const dynamic = 'force-dynamic'
