'use client'
import { useState, useEffect } from 'react'
import { useResumeStore, getStoredKey } from '@/store/resumeStore'
import { PROVIDERS } from '@/lib/llm/client'
import { CheckCircle, XCircle, AlertCircle, Loader2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { LLMProvider } from '@/types/resume'

export function ProviderStatusBar() {
  const { byokCreds, setProvider, hydrated } = useResumeStore()
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [testError, setTestError]   = useState('')
  const [savedKeys, setSavedKeys]   = useState<Partial<Record<LLMProvider, boolean>>>({})

  // Load which providers have keys after hydration
  useEffect(() => {
    if (!hydrated) return
    const keys: Partial<Record<LLMProvider, boolean>> = {}
    ;(Object.keys(PROVIDERS) as LLMProvider[]).forEach(id => {
      keys[id] = !!getStoredKey(id)
    })
    setSavedKeys(keys)
  }, [hydrated, byokCreds.provider, byokCreds.apiKey])

  async function testConnection() {
    if (!byokCreds.apiKey) return
    setTesting(true); setTestResult(null); setTestError('')
    try {
      const res  = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byokCreds),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) setTestResult('ok')
      else { setTestResult('fail'); setTestError(data.error || 'Failed') }
    } catch { setTestResult('fail'); setTestError('Server unreachable') }
    setTesting(false)
  }

  function switchProvider(id: LLMProvider) {
    setProvider(id)
    setTestResult(null); setTestError('')
  }

  if (!hydrated) return null

  const anyKeySaved = Object.values(savedKeys).some(Boolean)

  return (
    <div className="mb-5 space-y-2">
      {/* Provider chips — click to select active provider */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(PROVIDERS) as LLMProvider[]).map(id => {
          const hasKey   = !!savedKeys[id]
          const isActive = byokCreds.provider === id
          return (
            <button
              key={id}
              onClick={() => switchProvider(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                isActive
                  ? hasKey
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                  : hasKey
                    ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/15'
                    : 'bg-white/4 border-white/8 text-slate-500 hover:bg-white/8 hover:text-slate-400'
              )}
            >
              {hasKey
                ? <CheckCircle size={11} className={isActive ? 'text-white' : 'text-emerald-400'} />
                : <XCircle    size={11} className="text-slate-600" />}
              {PROVIDERS[id].name}
              {isActive && <span className="ml-0.5 text-[10px] opacity-70">active</span>}
            </button>
          )
        })}

        <Link href="/settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15 transition-all ml-auto">
          <Settings size={11}/> Manage keys
        </Link>
      </div>

      {/* Active provider status */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm',
        byokCreds.apiKey
          ? 'bg-[#16161d] border-white/8'
          : 'bg-amber-400/5 border-amber-400/20'
      )}>
        {byokCreds.apiKey ? (
          <>
            <div className="flex-1 min-w-0">
              <span className="text-slate-300 text-xs">
                Using <span className="font-medium text-slate-200">{PROVIDERS[byokCreds.provider].name}</span>
                <span className="text-slate-500 ml-2 font-mono">{byokCreds.model}</span>
              </span>
            </div>

            <button onClick={testConnection} disabled={testing}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-white/8 hover:border-white/20 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50 shrink-0">
              {testing ? <Loader2 size={11} className="spin"/> : null}
              {testing ? 'Testing…' : 'Test'}
            </button>

            {testResult === 'ok'   && <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0"><CheckCircle size={12}/>OK</span>}
            {testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400 shrink-0"><XCircle size={12}/>Failed</span>}
          </>
        ) : (
          <>
            <AlertCircle size={14} className="text-amber-400 shrink-0"/>
            <p className="flex-1 text-amber-300 text-xs">
              {anyKeySaved
                ? `No key for ${PROVIDERS[byokCreds.provider].name} — click a green provider above to switch`
                : 'No API key saved — go to Settings to add your key'}
            </p>
          </>
        )}
      </div>

      {testResult === 'fail' && testError && (
        <div className="flex items-start gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0"/>
          <p className="text-xs text-red-300">{testError}</p>
        </div>
      )}

      {/* Warn if using a custom model that looks wrong for the provider */}
      {byokCreds.apiKey && (() => {
        const knownModels = PROVIDERS[byokCreds.provider]?.models ?? []
        const isCustom = !knownModels.includes(byokCreds.model)
        const looksWrong =
          (byokCreds.provider === 'nvidia' && !byokCreds.model.includes('/') && !byokCreds.model.startsWith('meta/') && !byokCreds.model.startsWith('nvidia/') && !byokCreds.model.startsWith('mistralai/') && !byokCreds.model.startsWith('deepseek-ai/')) ||
          (byokCreds.provider === 'openrouter' && !byokCreds.model.includes('/'))
        return isCustom && looksWrong ? (
          <div className="flex items-start gap-1.5 px-3 py-2 bg-amber-400/8 border border-amber-400/20 rounded-lg fade-in">
            <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0"/>
            <p className="text-xs text-amber-300">
              <strong>{byokCreds.model}</strong> doesn&apos;t look like a valid {PROVIDERS[byokCreds.provider].name} model ID.
              {byokCreds.provider === 'nvidia' && ' NVIDIA NIM format: provider/model-name e.g. meta/llama-3.1-8b-instruct'}
              {byokCreds.provider === 'openrouter' && ' OpenRouter format: provider/model-name e.g. meta-llama/llama-3.1-8b-instruct:free'}
            </p>
          </div>
        ) : null
      })()}
    </div>
  )
}