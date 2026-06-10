'use client'
import { useState } from 'react'
import { Eye, EyeOff, Key, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useResumeStore } from '@/store/resumeStore'
import { PROVIDERS } from '@/lib/llm/client'
import { Card, Label } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { LLMProvider } from '@/types/resume'

export function BYOKPanel() {
  const { byokCreds, setProvider, setApiKey, setModel } = useResumeStore()
  const [showKey, setShowKey]         = useState(false)
  const [testing, setTesting]         = useState(false)
  const [testResult, setTestResult]   = useState<'ok' | 'fail' | null>(null)
  const [testError, setTestError]     = useState('')
  const [testLatency, setTestLatency] = useState<number | null>(null)
  const [customModel, setCustomModel] = useState('')
  const [showCustom, setShowCustom]   = useState(false)

  const cfg = PROVIDERS[byokCreds.provider]
  const isCustomModel = !cfg.models.includes(byokCreds.model)

  async function testConnection() {
    if (!byokCreds.apiKey) return
    setTesting(true); setTestResult(null); setTestError(''); setTestLatency(null)
    try {
      // Route through our API server to avoid CORS — browser can't call OpenRouter/NVIDIA directly
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byokCreds),
      })
      const data = await res.json() as { ok: boolean; error?: string; latencyMs?: number }
      if (data.ok) {
        setTestResult('ok')
        setTestLatency(data.latencyMs ?? null)
      } else {
        setTestResult('fail')
        setTestError(data.error || 'Connection failed')
      }
    } catch (err) {
      setTestResult('fail')
      setTestError('Could not reach server — is the dev server running?')
    }
    setTesting(false)
  }

  function handleProviderSwitch(p: LLMProvider) {
    setProvider(p)
    setTestResult(null); setTestError(''); setTestLatency(null)
    setCustomModel(''); setShowCustom(false)
  }

  function applyCustomModel() {
    if (!customModel.trim()) return
    setModel(customModel.trim())
    setCustomModel(''); setShowCustom(false)
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Key size={14} className="text-violet-400" />
        <span className="font-semibold text-sm">AI Provider</span>
        <span className="text-xs font-mono text-slate-500 ml-1">— BYOK · key in sessionStorage only</span>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-1 p-1 bg-[#0c0c0f] rounded-lg mb-4 overflow-x-auto">
        {(Object.keys(PROVIDERS) as LLMProvider[]).map(id => (
          <button key={id}
            className={cn(
              'flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all whitespace-nowrap',
              byokCreds.provider === id
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}
            onClick={() => handleProviderSwitch(id)}>
            {PROVIDERS[id].name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* API Key */}
        <div>
          <Label>API Key</Label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={byokCreds.apiKey}
              onChange={e => { setApiKey(e.target.value); setTestResult(null); setTestError('') }}
              placeholder={cfg.placeholder}
              className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 pr-9"
            />
            <button onClick={() => setShowKey(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1">{cfg.hint}</p>
        </div>

        {/* Model + custom model */}
        <div>
          <Label>Model</Label>
          <select
            value={isCustomModel ? '__custom_active__' : byokCreds.model}
            onChange={e => {
              if (e.target.value === '__custom__') {
                setShowCustom(true)
              } else if (e.target.value !== '__custom_active__') {
                setModel(e.target.value)
                setShowCustom(false)
                setTestResult(null)
              }
            }}
            className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 mb-2"
          >
            {cfg.models.map(m => <option key={m} value={m}>{m}</option>)}
            {isCustomModel && (
              <option value="__custom_active__">{byokCreds.model} (custom)</option>
            )}
            <option value="__custom__">+ Custom model ID…</option>
          </select>

          {/* Custom model input */}
          {showCustom && (
            <div className="flex gap-1.5 mb-2 fade-in">
              <input
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyCustomModel()}
                placeholder={byokCreds.provider === 'openrouter' ? 'e.g. deepseek/deepseek-v3:free' : byokCreds.provider === 'nvidia' ? 'e.g. meta/llama-3.1-70b-instruct' : 'model ID'}
                autoFocus
                className="flex-1 bg-[#1c1c24] border border-violet-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/70"
              />
              <button onClick={applyCustomModel}
                className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors">
                Use
              </button>
              <button onClick={() => setShowCustom(false)}
                className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-lg transition-colors">
                ✕
              </button>
            </div>
          )}

          {isCustomModel && !showCustom && (
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-violet-400 font-mono truncate">Custom: {byokCreds.model}</p>
              <button onClick={() => setShowCustom(true)} className="text-xs text-slate-500 hover:text-slate-300 ml-2 shrink-0">change</button>
            </div>
          )}

          {/* Test connection */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={testConnection}
              disabled={!byokCreds.apiKey || testing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                'bg-transparent border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {testing
                ? <><Loader2 size={12} className="spin" />Testing…</>
                : 'Test connection'}
            </button>
            {testResult === 'ok' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle size={12}/>
                Connected {testLatency != null ? `(${testLatency}ms)` : ''}
              </span>
            )}
            {testResult === 'fail' && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <XCircle size={12}/>Failed
              </span>
            )}
          </div>

          {/* Error detail */}
          {testResult === 'fail' && testError && (
            <div className="mt-2 flex items-start gap-1.5 px-2.5 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0"/>
              <p className="text-xs text-red-300 leading-snug">{testError}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}