// src/app/(auth)/signup/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/primitives'
import { Mail, Lock, Globe } from 'lucide-react'

export default function SignupPage() {
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
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
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  if (done) return (
    <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center p-4">
      <div className="text-center fade-in">
        <div className="text-4xl mb-4">✉️</div>
        <h2 className="text-xl font-bold mb-2">Check your email</h2>
        <p className="text-slate-400 text-sm">We sent a confirmation link to <strong>{email}</strong></p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-violet-500 shadow-lg shadow-violet-500/50" />
            <span className="font-bold text-xl tracking-tight">ResumeAI</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">Create account</h1>
          <p className="text-slate-400 text-sm">Free forever · BYOK</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 mb-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Globe size={16} />
          Continue with Google
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8" /></div>
          <div className="relative flex justify-center"><span className="px-3 bg-[#0c0c0f] text-xs text-slate-500">or email</span></div>
        </div>

        <form onSubmit={handleSignup} className="space-y-3">
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="w-full bg-[#16161d] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (8+ chars)"
              className="w-full bg-[#16161d] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
          <Button variant="primary" className="w-full justify-center" loading={loading} type="submit">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Have an account?{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
