'use client'
// src/components/settings/TwoFactorCard.tsx
// Optional two-factor authentication (TOTP) — enrol, verify, disable (L2 / B1).
// Requires "TOTP" to be enabled under Supabase → Authentication → MFA.
import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Card } from '@/components/ui/primitives'

type Enrolment = { factorId: string; qr: string; secret: string }

export function TwoFactorCard() {
  const supabase = createClient()
  const [loading, setLoading]     = useState(true)
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [enrol, setEnrol]         = useState<Enrolment | null>(null)
  const [code, setCode]           = useState('')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')

  async function loadActive(): Promise<string | null | undefined> {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) return undefined
    return data?.totp?.find(f => f.status === 'verified')?.id ?? null
  }

  async function refresh() {
    const id = await loadActive()
    if (id === undefined) setError('Couldn’t load two-factor settings.')
    else setActiveId(id)
    setLoading(false)
  }

  useEffect(() => {
    let live = true
    loadActive().then(id => {
      if (!live) return
      if (id === undefined) setError('Couldn’t load two-factor settings.')
      else setActiveId(id)
      setLoading(false)
    })
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true); setError('')
    // Clear abandoned, never-verified factors first (Supabase rejects duplicates).
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all ?? []) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `ResumeAI ${new Date().toISOString().slice(0, 10)}` })
    setBusy(false)
    if (error || !data) { setError('Couldn’t start setup. Two-factor may not be enabled for this project yet.'); return }
    setEnrol({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirm() {
    if (!enrol) return
    setBusy(true); setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrol.factorId, code: code.trim() })
    setBusy(false)
    if (error) { setError('That code didn’t work. Check the time on your phone and try again.'); return }
    setEnrol(null); setCode('')
    await refresh()
  }

  async function disable() {
    if (!activeId) return
    setBusy(true); setError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId: activeId })
    setBusy(false)
    if (error) { setError('Couldn’t turn off two-factor. Sign in again and retry.'); return }
    await supabase.auth.refreshSession()
    await refresh()
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={14} className="text-violet-400"/>
        <h2 className="font-semibold text-sm">Two-factor authentication</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Ask for a code from an authenticator app (1Password, Google Authenticator, Authy…) every time you sign in.</p>

      {loading ? <p className="text-xs text-slate-500">Loading…</p> : activeId ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-emerald-400">On</span>
          <Button variant="ghost" size="sm" onClick={disable} loading={busy}><ShieldOff size={12}/>Turn off</Button>
        </div>
      ) : enrol ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrol.qr} alt="Two-factor QR code" width={176} height={176} className="rounded-xl bg-white p-2"/>
          <p className="text-xs text-slate-500">Can’t scan? Enter this key: <code className="font-mono text-slate-300 break-all">{enrol.secret}</code></p>
          <div className="flex items-center gap-2">
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Authentication code"
              className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/40 w-32 font-mono"/>
            <Button variant="primary" size="sm" onClick={confirm} loading={busy} disabled={code.length !== 6}>Turn on</Button>
            <Button variant="ghost" size="sm" onClick={() => { setEnrol(null); setCode('') }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={start} loading={busy}><ShieldCheck size={12}/>Set up two-factor</Button>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </Card>
  )
}
