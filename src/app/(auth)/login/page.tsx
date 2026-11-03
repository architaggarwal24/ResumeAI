// src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormError, OAuthButton, OrDivider, RevealToggle } from '@/components/auth/AuthBits'
import { Field } from '@/components/ui/glass/Field'
import { Button } from '@/components/ui/glass/Button'
import { clientAppOrigin } from '@/lib/security/app-origin'
import { publicAuthError } from '@/lib/security/auth-messages'

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
    if (error) { setError(publicAuthError('login', error)); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${clientAppOrigin()}/auth/callback` },
    })
    if (error) { setError(publicAuthError('oauth', error)); setLoading(false) }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={<>No account?{' '}<Link href="/signup" className="font-medium text-violet-300 underline-offset-4 hover:underline">Sign up free</Link></>}
    >
      <OAuthButton onClick={handleGoogle} disabled={loading}>Continue with Google</OAuthButton>
      <OrDivider />

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <Field label="Email" type="email" name="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Field
          label="Password" type={show ? 'text' : 'password'} name="password" required autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)}
          trailing={<RevealToggle shown={show} onToggle={() => setShow(s => !s)} />}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={loading} className="w-full" trailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
export const dynamic = 'force-dynamic'
