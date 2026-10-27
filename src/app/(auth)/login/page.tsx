// src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/primitives'
import { AuthShell } from '@/components/auth/AuthShell'
import FloatInput from '@/components/vendor/smoothui/float-input'
import { Globe, Eye, EyeOff } from 'lucide-react'

const FIELD = 'h-12 rounded-xl border-white/12 bg-[#0b0c0d] text-slate-100 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={<>No account?{' '}<Link href="/signup" className="text-violet-300 underline-offset-4 hover:underline">Sign up free</Link></>}
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

      <form onSubmit={handleEmailLogin} className="space-y-5">
        <FloatInput label="Email" type="email" name="email" required autoComplete="email" value={email} onChange={setEmail} inputClassName={FIELD} />
        <FloatInput
          label="Password" type={show ? 'text' : 'password'} name="password" required autoComplete="current-password"
          value={password} onChange={setPassword} inputClassName={`${FIELD} pr-11`}
          trailing={
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="text-slate-500 transition-colors hover:text-slate-200">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          }
        />

        {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">{error}</p>}

        <Button variant="primary" size="lg" className="w-full justify-center" loading={loading} type="submit">Sign in</Button>
      </form>
    </AuthShell>
  )
}
export const dynamic = 'force-dynamic'
