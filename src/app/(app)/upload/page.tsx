// src/app/(app)/upload/page.tsx
'use client'
import { AgentProgress } from '@/components/ui/fx/AgentProgress'
import FileUpload from '@/components/vendor/kokonut/file-upload'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2, Sparkles, Link2, Clipboard, AlertTriangle, X, Clock } from 'lucide-react'
import { extractTextFromPDF, validatePDFFile } from '@/lib/pdf/extract'
import { callLLM, getFastCreds } from '@/lib/llm/client'
import { PARSE_PROMPT } from '@/lib/llm/prompts'
import { useResumeStore } from '@/store/resumeStore'
import { ProviderStatusBar } from '@/components/resume/ProviderStatusBar'
import { Button, Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { ResumeData } from '@/types/resume'

type ImportMode = 'pdf' | 'linkedin'
type Step = 'idle' | 'reading' | 'parsing' | 'saving' | 'done'
type LinkedInStep = 'idle' | 'fetching' | 'parsing' | 'saving' | 'done'

// Slow model warning threshold
const SLOW_WARN_AFTER_MS = 20_000

const MODEL_SPEED_TIPS: Record<string, string> = {
  'deepseek/deepseek-r1:free':    'DeepSeek R1 is a reasoning model — it thinks before answering and can take 2–5 min. For faster parsing use gemini-2.0-flash or gpt-4o-mini.',
  'deepseek/deepseek-v3:free':    'DeepSeek V3 free has queue delays. For faster parsing use gemini-2.0-flash or gpt-4o-mini.',
  'meta-llama/llama-3.3-70b-instruct:free': 'Llama 70B free can be slow. For faster parsing use llama-3.1-8b-instruct:free.',
}

export default function UploadPage() {
  const router = useRouter()
  const { byokCreds, addToast, setResumeData, setRawText, setResumeId, setJobDescription } = useResumeStore()

  const [mode, setMode]         = useState<ImportMode>('pdf')
  const [drag, setDrag]         = useState(false)
  const [file, setFile]         = useState<File | null>(null)
  const [step, setStep]         = useState<Step>('idle')
  const [error, setError]       = useState('')
  const [jd, setJd]             = useState('')
  const [elapsed, setElapsed]   = useState(0)
  const [showSlowWarn, setSlowWarn] = useState(false)
  const abortRef   = useRef<AbortController | null>(null)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // LinkedIn state
  const [liUrl, setLiUrl]               = useState('')
  const [liPaste, setLiPaste]           = useState('')
  const [liStep, setLiStep]             = useState<LinkedInStep>('idle')
  const [liError, setLiError]           = useState('')
  const [showPasteFallback, setShowPaste] = useState(false)

  // Elapsed timer — starts when parsing begins
  useEffect(() => {
    // Resets deferred (not called synchronously from the effect body) — see
    // react-hooks/set-state-in-effect.
    if (step === 'parsing') {
      queueMicrotask(() => { setElapsed(0); setSlowWarn(false) })
      timerRef.current = setInterval(() => {
        setElapsed(p => {
          const next = p + 1
          if (next * 1000 >= SLOW_WARN_AFTER_MS) setSlowWarn(true)
          return next
        })
      }, 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      queueMicrotask(() => { setElapsed(0); setSlowWarn(false) })
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step])

  function cancelParsing() {
    abortRef.current?.abort()
    setStep('idle'); setError(''); setElapsed(0)
    addToast('Cancelled', 'info')
  }

  async function saveAndRedirect(parsed: ResumeData, rawText: string, label: string) {
    setStep('saving')
    const res = await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: parsed.name || label, rawText, parsedData: parsed }),
    })
    if (!res.ok) throw new Error('Failed to save resume')
    const { resume } = await res.json()
    setResumeData(parsed); setRawText(rawText); setResumeId(resume.id)
    if (jd) setJobDescription(jd)
    setStep('done')
    addToast(`"${parsed.name || label}" imported ✓`, 'success')
    router.push(`/resume/${resume.id}`)
  }

  const processPDF = useCallback(async (f: File) => {
    const validError = validatePDFFile(f)
    if (validError) { setError(validError); return validError }
    if (!byokCreds.apiKey) { const m = 'Enter your API key above first.'; setError(m); return m }

    setFile(f); setError(''); setStep('reading')
    abortRef.current = new AbortController()

    try {
      const rawText = await extractTextFromPDF(f)
      setStep('parsing')

      // Truncate to 6000 chars — enough for any resume, faster on slow/free models
      const truncated = rawText.slice(0, 6000)

      // Use fast model for parsing — no need for reasoning models for extraction
      const parseCreds = getFastCreds(byokCreds)
      const parsed = await callLLM<ResumeData>({
        creds: parseCreds,
        systemPrompt: PARSE_PROMPT,
        userPrompt: `Parse this resume:\n\n${truncated}`,
        signal: abortRef.current.signal,
      })

      await saveAndRedirect(parsed, rawText, f.name.replace('.pdf', ''))
      return null
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return null // user cancelled
      setStep('idle')
      let msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.includes('timed out') || msg.includes('aborted') || msg.includes('AbortError')) {
        msg = 'Request timed out. Switch to a faster model (gemini-2.0-flash or gpt-4o-mini) and try again.'
      }
      setError(msg)
      addToast(msg, 'error', 8000)
      return msg
    }
  }, [byokCreds, jd]) // eslint-disable-line

  // Kokonut's FileUpload expects a rejected promise on failure.
  async function handleUpload(f: File) {
    const err = await processPDF(f)
    if (err) throw new Error(err)
  }

  async function importLinkedIn(usePaste = false) {
    if (!byokCreds.apiKey) { setLiError('Enter your API key above first.'); return }
    const hasInput = usePaste ? liPaste.trim().length > 100 : liUrl.trim().length > 3
    if (!hasInput) { setLiError(usePaste ? 'Paste some profile text first.' : 'Enter a LinkedIn URL first.'); return }

    setLiError(''); setLiStep('fetching')
    try {
      const body = usePaste
        ? { rawText: liPaste, creds: byokCreds }
        : { url: liUrl, creds: byokCreds }

      const res = await fetch('/api/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.fallback) setShowPaste(true)
        setLiStep('idle')
        setLiError(data.error || 'Import failed')
        return
      }

      setLiStep('parsing')
      await new Promise(r => setTimeout(r, 300))
      setLiStep('saving')
      await saveAndRedirect(data.resumeData, data.rawText, 'LinkedIn Profile')
    } catch (err: unknown) {
      setLiStep('idle')
      const msg = err instanceof Error ? err.message : 'Import failed'
      setLiError(msg); addToast(msg, 'error')
    }
  }

  const isPDFProcessing = step !== 'idle' && step !== 'done'
  const isLIProcessing  = liStep !== 'idle' && liStep !== 'done'
  const liStepLabel: Record<LinkedInStep, string> = {
    idle: '', fetching: 'Fetching profile…', parsing: 'Parsing with AI…',
    saving: 'Saving…', done: '✓ Done',
  }

  const modelSlowTip = MODEL_SPEED_TIPS[byokCreds.model] || null

  function formatElapsed(s: number) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="mx-auto px-4 sm:px-8 py-8 max-w-2xl fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold mb-1">Import Resume</h1>
        <p className="text-slate-400 text-sm">Upload a PDF or import directly from LinkedIn.</p>
      </div>

      <ProviderStatusBar />

      {/* Speed tip for known slow models */}
      {modelSlowTip && !isPDFProcessing && (
        <div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-amber-400/8 border border-amber-400/20 rounded-xl fade-in">
          <Clock size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300 leading-relaxed">{modelSlowTip}</p>
        </div>
      )}

      {/* Mode switcher */}
      <div className="flex gap-1 p-1 bg-[#111214] rounded-xl mb-5 border border-white/7">
        {([
          { id: 'pdf',      icon: <FileText size={14}/>, label: 'PDF Upload'      },
          { id: 'linkedin', icon: <Link2    size={14}/>, label: 'LinkedIn Import' },
        ] as { id: ImportMode; icon: React.ReactNode; label: string }[]).map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              mode === m.id ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>

      {/* PDF mode */}
      {mode === 'pdf' && (
        <div className="mb-5">
          {isPDFProcessing ? (
            <Card className="flex flex-col items-center gap-4 py-8">
              <AgentProgress
                className="w-full max-w-md"
                activeIndex={['reading', 'parsing', 'saving'].indexOf(step)}
                steps={[
                  { label: 'Reading the PDF in your browser', detail: ['Extracting text locally'] },
                  { label: 'Extracting structure with AI', detail: [`Model: ${getFastCreds(byokCreds).model}`] },
                  { label: 'Saving to your account', detail: ['Creating your resume'] },
                ]}
              />

              {step === 'parsing' && (
                <div className="space-y-0.5 text-center">
                  <p className="text-xs text-slate-500 font-mono tabular">{formatElapsed(elapsed)} · {getFastCreds(byokCreds).model}</p>
                  {getFastCreds(byokCreds).model !== byokCreds.model && (
                    <p className="text-xs text-slate-600">Auto-switched for faster extraction</p>
                  )}
                </div>
              )}

              {showSlowWarn && step === 'parsing' && (
                <p className="max-w-xs text-center text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 leading-relaxed fade-in">
                  Still working — this model is slow. It will finish, just hang on.
                  {modelSlowTip && ' Consider switching to gemini-2.0-flash next time.'}
                </p>
              )}

              {step === 'parsing' && (
                <button onClick={cancelParsing} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors">
                  <X size={12} />Cancel
                </button>
              )}
            </Card>
          ) : (
            <FileUpload
              multiple={false}
              maxFiles={1}
              acceptedFileTypes={['application/pdf']}
              className="max-w-none"
              maxFileSize={10 * 1024 * 1024}
              onUpload={handleUpload}
            />
          )}

          {error && !isPDFProcessing && (
            <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* LinkedIn mode */}
      {mode === 'linkedin' && (
        <Card className="mb-5">
          {!showPasteFallback ? (
            <>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 block">LinkedIn Profile URL</label>
              <div className="flex gap-2 mb-3">
                <input
                  value={liUrl} onChange={e => setLiUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="flex-1 bg-[#1c1f23] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                  onKeyDown={e => e.key === 'Enter' && !isLIProcessing && importLinkedIn(false)}
                  disabled={isLIProcessing}
                />
                <Button variant="primary" onClick={() => importLinkedIn(false)} loading={isLIProcessing} disabled={!liUrl.trim()}>
                  {isLIProcessing ? liStepLabel[liStep] : 'Import'}
                </Button>
              </div>
              <p className="text-xs text-slate-600 mb-2">The profile must be public. If blocked, we&apos;ll switch to paste mode automatically.</p>
              <button onClick={() => setShowPaste(true)} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <Clipboard size={12}/> Use manual paste instead
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-400 shrink-0"/>
                <p className="text-sm text-amber-300">LinkedIn blocked URL access. Paste your profile text below instead.</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                On LinkedIn: click <strong>More → Save to PDF</strong>, open the PDF, select all (Ctrl+A), and paste here.
              </p>
              <textarea rows={10} value={liPaste} onChange={e => setLiPaste(e.target.value)}
                placeholder="Paste your LinkedIn profile text here…"
                className="w-full bg-[#1c1f23] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none mb-3"
                disabled={isLIProcessing}/>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => importLinkedIn(true)} loading={isLIProcessing} disabled={liPaste.trim().length < 100}>
                  {isLIProcessing ? liStepLabel[liStep] : <><Sparkles size={13}/>Parse with AI</>}
                </Button>
                <Button onClick={() => { setShowPaste(false); setLiPaste(''); setLiError('') }}>Back to URL</Button>
              </div>
            </>
          )}
          {liError && (
            <div className="mt-3 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{liError}</p>
            </div>
          )}
        </Card>
      )}

      {/* Job Description */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-violet-400" />
          <span className="font-medium text-sm">Job Description</span>
          <span className="text-xs text-slate-500 ml-1">optional — enables ATS scoring</span>
        </div>
        <textarea rows={5} value={jd} onChange={e => setJd(e.target.value)}
          placeholder="Paste the full job description here to get ATS scoring and keyword suggestions after import…"
          className="w-full bg-[#1c1f23] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"/>
      </Card>
    </div>
  )
}