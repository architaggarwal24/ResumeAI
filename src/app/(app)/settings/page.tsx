// src/app/(app)/settings/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useResumeStore, getStoredKey } from '@/store/resumeStore'
import { PROVIDERS } from '@/lib/llm/client'
import { TEMPLATES } from '@/lib/templates/render'
import { Button, Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  Settings, User, Layout, AlertTriangle, Check,
  Loader2, Trash2, Eye, EyeOff, Key, CheckCircle, XCircle, AlertCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { LLMProvider, TemplateId } from '@/types/resume'

export default function SettingsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { byokCreds, setProvider, setApiKey, setModel, setBaseUrl, hydrated } = useResumeStore()

  const [userEmail, setEmail]               = useState('')
  const [defaultTemplate, setTemplate]      = useState<TemplateId>('classic')
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [deleteConfirm, setDeleteConfirm]   = useState('')
  const [deleting, setDeleting]             = useState(false)
  const [loadingUser, setLoadingUser]       = useState(true)

  // Per-provider key state — synced from store after hydration
  const [showKeys, setShowKeys]             = useState<Partial<Record<LLMProvider, boolean>>>({})
  const [customModel, setCustomModel]       = useState('')
  const [showCustom, setShowCustom]         = useState(false)
  const [testing, setTesting]               = useState(false)
  const [testResult, setTestResult]         = useState<'ok' | 'fail' | null>(null)
  const [testError, setTestError]           = useState('')
  const [testLatency, setTestLatency]       = useState<number | null>(null)
  const [jsonResult, setJsonResult]         = useState<'ok' | 'fail' | null>(null)
  const [jsonError, setJsonError]           = useState('')

  const cfg = PROVIDERS[byokCreds.provider]
  const isCustomModel = !cfg.models.includes(byokCreds.model)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')
      setLoadingUser(false)
    }
    load()
  }, []) // eslint-disable-line

  async function testConnection() {
    if (byokCreds.provider !== 'ollama' && !byokCreds.apiKey) return
    setTesting(true); setTestResult(null); setTestError(''); setTestLatency(null); setJsonResult(null); setJsonError('')
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byokCreds),
      })
      const data = await res.json() as {
        ok: boolean; error?: string; latencyMs?: number
        basic?: { ok: boolean; error?: string; latencyMs?: number }
        json?: { ok: boolean; error?: string; latencyMs?: number } | null
      }
      if (data.ok) {
        setTestResult('ok'); setTestLatency(data.basic?.latencyMs ?? data.latencyMs ?? null)
        if (data.json) {
          setJsonResult(data.json.ok ? 'ok' : 'fail')
          if (!data.json.ok) setJsonError(data.json.error || 'JSON output not supported')
        }
      }
      else { setTestResult('fail'); setTestError(data.error || 'Failed') }
    } catch { setTestResult('fail'); setTestError('Server unreachable') }
    setTesting(false)
  }

  function applyCustomModel() {
    if (!customModel.trim()) return
    setModel(customModel.trim())
    setCustomModel(''); setShowCustom(false)
  }

  async function saveSettings() {
    setSaving(true)
    // Nothing to save to DB for BYOK (keys stay local) — just save template preference
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('users').update({ provider: byokCreds.provider, model: byokCreds.model }).eq('id', user!.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function deleteAllData() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('users').delete().eq('id', user!.id)
    await supabase.auth.signOut()
    router.push('/signup')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loadingUser || !hydrated) return (
    <div className="p-8 flex items-center justify-center h-full">
      <Loader2 size={24} className="text-violet-400 spin" />
    </div>
  )

  return (
    <div className="mx-auto px-8 py-8 max-w-2xl fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-1">
          <Settings size={20} className="text-violet-400"/>Settings
        </h1>
        <p className="text-slate-400 text-sm">API keys, preferences, and account management.</p>
      </div>

      {/* Account */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User size={14} className="text-slate-400"/>
          <h2 className="font-semibold text-sm">Account</h2>
        </div>
        <div>
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">Email</label>
          <input value={userEmail} disabled
            className="w-full bg-[#1c1c24]/50 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"/>
        </div>
      </Card>

      {/* AI Keys — full BYOK panel */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Key size={14} className="text-violet-400"/>
          <h2 className="font-semibold text-sm">AI Provider &amp; API Keys</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Keys are saved in your browser&apos;s sessionStorage — they persist across refreshes but clear when you close this tab, and stay on this device only. Never sent to our servers.
        </p>

        {/* Provider tabs */}
        <div className="flex gap-1 p-1 bg-[#0c0c0f] rounded-lg mb-4 overflow-x-auto">
          {(Object.keys(PROVIDERS) as LLMProvider[]).map(id => (
            <button key={id}
              className={cn(
                'flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                byokCreds.provider === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
              onClick={() => { setProvider(id); setTestResult(null); setTestError('') }}>
              {PROVIDERS[id].name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* API Key / Server URL */}
          <div>
            {byokCreds.provider === 'ollama' ? (
              <>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Server URL — {cfg.name}
                </label>
                <input
                  type="text"
                  value={byokCreds.baseUrl ?? cfg.baseUrl ?? ''}
                  onChange={e => { setBaseUrl(e.target.value); setTestResult(null) }}
                  placeholder="http://localhost:11434/v1/chat/completions"
                  className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                />
                <p className="text-xs text-slate-600 mt-1">{cfg.hint}</p>
              </>
            ) : (
              <>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">
                  API Key — {cfg.name}
                </label>
                <div className="relative">
                  <input
                    type={showKeys[byokCreds.provider] ? 'text' : 'password'}
                    value={byokCreds.apiKey}
                    onChange={e => { setApiKey(e.target.value); setTestResult(null) }}
                    placeholder={cfg.placeholder}
                    className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 pr-9"
                  />
                  <button
                    onClick={() => setShowKeys(p => ({ ...p, [byokCreds.provider]: !p[byokCreds.provider] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showKeys[byokCreds.provider] ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">{cfg.hint}</p>
              </>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">Model</label>
            <select
              value={isCustomModel ? '__custom_active__' : byokCreds.model}
              onChange={e => {
                if (e.target.value === '__custom__') setShowCustom(true)
                else if (e.target.value !== '__custom_active__') { setModel(e.target.value); setShowCustom(false) }
              }}
              className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 mb-2"
            >
              {cfg.models.map(m => <option key={m} value={m}>{m}</option>)}
              {isCustomModel && <option value="__custom_active__">{byokCreds.model} (custom)</option>}
              <option value="__custom__">+ Custom model ID…</option>
            </select>

            {showCustom && (
              <div className="flex gap-1.5 mb-2 fade-in">
                <input value={customModel} onChange={e => setCustomModel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyCustomModel()}
                  placeholder={byokCreds.provider === 'openrouter' ? 'e.g. deepseek/deepseek-v3:free' : byokCreds.provider === 'nvidia' ? 'e.g. nvidia/nemotron-3-nano-30b-a3b' : byokCreds.provider === 'ollama' ? 'e.g. llama3.1:8b' : 'model ID'} autoFocus
                  className="flex-1 bg-[#1c1c24] border border-violet-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/70"/>
                <button onClick={applyCustomModel} className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg">Use</button>
                <button onClick={() => setShowCustom(false)} className="px-2 py-1.5 bg-white/5 text-slate-400 text-xs rounded-lg">✕</button>
              </div>
            )}
            {isCustomModel && !showCustom && (
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-violet-400 font-mono truncate">Custom: {byokCreds.model}</p>
                <button onClick={() => setShowCustom(true)} className="text-xs text-slate-500 hover:text-slate-300 ml-2">change</button>
              </div>
            )}

            {/* Test connection */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={testConnection} disabled={!byokCreds.apiKey || testing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {testing ? <><Loader2 size={12} className="spin"/>Testing…</> : 'Test connection'}
              </button>
              {testResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12}/>Connected {testLatency ? `(${testLatency}ms)` : ''}</span>}
              {testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12}/>Failed</span>}
              {jsonResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12}/>JSON output OK</span>}
              {jsonResult === 'fail' && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={12}/>JSON output unreliable</span>}
            </div>
            {testResult === 'fail' && testError && (
              <div className="mt-2 flex items-start gap-1.5 px-2.5 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0"/>
                <p className="text-xs text-red-300 leading-snug">{testError}</p>
              </div>
            )}
            {jsonResult === 'fail' && jsonError && (
              <div className="mt-2 flex items-start gap-1.5 px-2.5 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0"/>
                <p className="text-xs text-amber-300 leading-snug">
                  Connected, but this model didn&apos;t return valid JSON — scoring, suggestions, and the AI coach&apos;s edit proposals may fail. {jsonError}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Keys status for all providers */}
        <div className="mt-4 pt-4 border-t border-white/7">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-2">Saved Keys</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PROVIDERS) as LLMProvider[]).map(id => {
              const hasKey = !!getStoredKey(id)
              return (
                <div key={id} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border',
                  hasKey ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-white/7 text-slate-600')}>
                  {hasKey ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                  {PROVIDERS[id].name}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Default Template */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Layout size={14} className="text-slate-400"/>
          <h2 className="font-semibold text-sm">Default Template</h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Object.values(TEMPLATES).map(t => (
            <button key={t.id} onClick={() => setTemplate(t.id)}
              className={cn('px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                defaultTemplate === t.id
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                  : 'border-white/8 text-slate-400 hover:border-white/15')}>
              {t.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3 mb-10">
        <Button variant="primary" onClick={saveSettings} loading={saving}>
          {saved ? <><Check size={13}/>Saved!</> : 'Save Preferences'}
        </Button>
        {saved && <span className="text-sm text-emerald-400">Saved ✓</span>}
      </div>

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-red-400"/>
          <h2 className="font-semibold text-sm text-red-300">Danger Zone</h2>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-300 mb-1">Sign out</p>
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </div>
          <div className="border-t border-red-500/15 pt-4">
            <p className="text-sm text-red-300 mb-1">Delete account &amp; all data</p>
            <p className="text-xs text-slate-500 mb-3">Permanently deletes everything. Cannot be undone.</p>
            <div className="flex items-center gap-2">
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="bg-[#1c1c24] border border-red-500/20 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/40 w-48"/>
              <Button variant="danger" size="sm" disabled={deleteConfirm !== 'DELETE' || deleting}
                onClick={deleteAllData} loading={deleting}>
                <Trash2 size={12}/>Delete Everything
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}