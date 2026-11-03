// src/app/(app)/upload/page.tsx
'use client'
import { AgentProgress } from '@/components/ui/fx/AgentProgress'
import { AnimatePresence, motion } from 'motion/react'
import { GlassPanel } from '@/components/ui/glass/GlassPanel'
import { SPRING } from '@/lib/motion'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Sparkles, Link2, Clipboard, AlertTriangle, X, Clock, Lock } from 'lucide-react'
import { extractTextFromPDF, validatePDFFile } from '@/lib/pdf/extract'
import { callLLM, getFastCreds } from '@/lib/llm/client'
import { PARSE_PROMPT } from '@/lib/llm/prompts'
import { useResumeStore } from '@/store/resumeStore'
import { ProviderStatusBar } from '@/components/resume/ProviderStatusBar'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { ResumeData } from '@/types/resume'

type ImportMode = 'pdf' | 'linkedin'
type Step = 'idle' | 'reading' | 'parsing' | 'saving' | 'done'
type LinkedInStep = 'idle' | 'fetching' | 'parsing' | 'saving' | 'done'

// Slow model warning threshold
const SLOW_WARN_AFTER_MS = 20_000

const INPUT = 'h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)] disabled:opacity-50'
const TEXTAREA = 'w-full resize-none rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-slate-500 outline-none transition focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)] disabled:opacity-50'

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
    addToast(`"${parsed.name || label}" imported`, 'success')
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
    saving: 'Saving…', done: 'Done',
  }

  const modelSlowTip = MODEL_SPEED_TIPS[byokCreds.model] || null

  function formatElapsed(s: number) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void processPDF(f)
  }

  const pdfStepIndex = ['reading', 'parsing', 'saving'].indexOf(step)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      {/* Header + journey (Goal-Gradient) */}
      <div className="mb-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-violet-300">Step 1 of 3</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Import your resume</h1>
        <p className="mt-2 text-sm text-slate-400">Upload a PDF or import from LinkedIn — then score and improve it.</p>
        <ol className="mt-6 flex items-center gap-2 text-xs" aria-label="Progress">
          {['Import', 'Score', 'Improve'].map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px]', i === 0 ? 'bg-violet-500 text-white shadow-[0_0_14px_rgba(139,92,246,.8)]' : 'border border-white/15 text-slate-500')}>{i + 1}</span>
              <span className={i === 0 ? 'text-white' : 'text-slate-500'}>{s}</span>
              {i < 2 && <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-white/5" />}
            </li>
          ))}
        </ol>
      </div>

      <ProviderStatusBar />

      {/* Speed tip for known slow models */}
      <AnimatePresence>
        {modelSlowTip && !isPDFProcessing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3">
              <Clock size={14} className="mt-0.5 shrink-0 text-amber-200" />
              <p className="text-xs leading-relaxed text-amber-100/90">{modelSlowTip}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode switcher (sliding pill) */}
      <div role="tablist" aria-label="Import method" className="glass-subtle mb-5 flex gap-1 rounded-2xl p-1">
        {([
          { id: 'pdf',      icon: <FileText size={15}/>, label: 'PDF upload'      },
          { id: 'linkedin', icon: <Link2    size={15}/>, label: 'LinkedIn import' },
        ] as { id: ImportMode; icon: React.ReactNode; label: string }[]).map(m => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}
            className={cn('relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors', mode === m.id ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
            {mode === m.id && <motion.span layoutId="import-mode" transition={SPRING.snappy} className="absolute inset-0 rounded-xl border border-violet-300/30 bg-violet-500/20 shadow-[0_0_24px_-8px_rgba(139,92,246,.9)]" />}
            <span className="relative flex items-center gap-2">{m.icon}{m.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* PDF mode */}
        {mode === 'pdf' && (
          <motion.div key="pdf" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={SPRING.soft} className="mb-5">
            {isPDFProcessing ? (
              <GlassPanel variant="strong" spotlight={false} className="flex flex-col items-center gap-5 rounded-3xl px-6 py-8">
                {/* Progress ring across the three steps */}
                <div className="relative grid size-24 place-items-center">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="6" />
                    <motion.circle cx="50" cy="50" r="44" fill="none" stroke="url(#up-g)" strokeWidth="6" strokeLinecap="round" strokeDasharray={276}
                      animate={{ strokeDashoffset: 276 * (1 - (pdfStepIndex + 0.5) / 3) }} transition={SPRING.soft} />
                    <defs><linearGradient id="up-g" x1="0" x2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#e879f9" /></linearGradient></defs>
                  </svg>
                  <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="grid size-12 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
                    <Sparkles size={20} />
                  </motion.span>
                </div>
                {file && <p className="font-mono text-xs text-slate-400">{file.name}</p>}
                <AgentProgress
                  className="w-full max-w-md"
                  activeIndex={pdfStepIndex}
                  steps={[
                    { label: 'Reading the PDF in your browser', detail: ['Extracting text locally'] },
                    { label: 'Extracting structure with AI', detail: [`Model: ${getFastCreds(byokCreds).model}`] },
                    { label: 'Saving to your account', detail: ['Creating your resume'] },
                  ]}
                />

                {step === 'parsing' && (
                  <div className="space-y-0.5 text-center">
                    <p className="tabular font-mono text-xs text-slate-400">{formatElapsed(elapsed)} · {getFastCreds(byokCreds).model}</p>
                    {getFastCreds(byokCreds).model !== byokCreds.model && (
                      <p className="text-xs text-slate-500">Auto-switched for faster extraction</p>
                    )}
                  </div>
                )}

                {showSlowWarn && step === 'parsing' && (
                  <p className="fade-in max-w-xs rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-center text-xs leading-relaxed text-amber-100">
                    Still working — this model is slow. It will finish, just hang on.
                    {modelSlowTip && ' Consider switching to gemini-2.0-flash next time.'}
                  </p>
                )}

                {step === 'parsing' && (
                  <button type="button" onClick={cancelParsing} className="press flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
                    <X size={13} />Cancel
                  </button>
                )}
              </GlassPanel>
            ) : (
              <motion.label
                htmlFor="resume-file"
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                animate={{ scale: drag ? 1.015 : 1 }}
                transition={SPRING.snappy}
                className={cn(
                  'group relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                  drag ? 'border-violet-300/70 bg-violet-500/[0.12]' : 'border-white/12 bg-white/[0.025] hover:border-violet-300/40 hover:bg-violet-500/[0.05]',
                )}
              >
                <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,.28),transparent_65%)] transition-opacity duration-500', drag ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')} />
                <motion.span
                  animate={drag ? { y: -6, rotate: -6 } : { y: 0, rotate: 0 }}
                  transition={SPRING.bouncy}
                  className="relative mb-5 grid size-16 place-items-center rounded-2xl bg-[linear-gradient(145deg,#a78bfa,#6d28d9)] text-white shadow-[0_14px_40px_-10px_rgba(124,58,237,.9)]"
                >
                  <Upload size={26} />
                </motion.span>
                <span className="relative text-lg font-semibold text-white">{drag ? 'Drop it here' : 'Drop your resume PDF'}</span>
                <span className="relative mt-1 text-sm text-slate-400">or <span className="text-violet-300 underline decoration-violet-300/40 underline-offset-4">browse files</span> · PDF up to 10 MB</span>
                <span className="relative mt-5 flex items-center gap-1.5 text-[11px] text-slate-500"><Lock size={11} />Text is extracted in your browser</span>
                <input
                  id="resume-file"
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void processPDF(f); e.target.value = '' }}
                />
              </motion.label>
            )}

            {error && !isPDFProcessing && (
              <p role="alert" className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>
            )}
          </motion.div>
        )}

        {/* LinkedIn mode */}
        {mode === 'linkedin' && (
          <motion.div key="li" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={SPRING.soft} className="mb-5">
            <GlassPanel spotlight={false} className="rounded-3xl p-5 sm:p-6">
              {!showPasteFallback ? (
                <>
                  <label htmlFor="li-url" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">LinkedIn profile URL</label>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="li-url"
                      value={liUrl} onChange={e => setLiUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className={INPUT}
                      onKeyDown={e => e.key === 'Enter' && !isLIProcessing && importLinkedIn(false)}
                      disabled={isLIProcessing}
                    />
                    <Button variant="primary" size="lg" onClick={() => importLinkedIn(false)} loading={isLIProcessing} disabled={!liUrl.trim()}>
                      {isLIProcessing ? liStepLabel[liStep] : 'Import'}
                    </Button>
                  </div>
                  <p className="mb-3 text-xs text-slate-500">The profile must be public. If blocked, we&apos;ll switch to paste mode automatically.</p>
                  <button type="button" onClick={() => setShowPaste(true)} className="flex min-h-9 items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200">
                    <Clipboard size={13}/> Use manual paste instead
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2">
                    <AlertTriangle size={14} className="shrink-0 text-amber-200"/>
                    <p className="text-sm text-amber-100">LinkedIn blocked URL access. Paste your profile text below instead.</p>
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    On LinkedIn: click <strong className="text-slate-200">More → Save to PDF</strong>, open the PDF, select all (Ctrl+A), and paste here.
                  </p>
                  <textarea rows={10} value={liPaste} onChange={e => setLiPaste(e.target.value)}
                    aria-label="LinkedIn profile text"
                    placeholder="Paste your LinkedIn profile text here…"
                    className={cn(TEXTAREA, 'mb-3')}
                    disabled={isLIProcessing}/>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => importLinkedIn(true)} loading={isLIProcessing} disabled={liPaste.trim().length < 100}>
                      {isLIProcessing ? liStepLabel[liStep] : <><Sparkles size={13}/>Parse with AI</>}
                    </Button>
                    <Button onClick={() => { setShowPaste(false); setLiPaste(''); setLiError('') }}>Back to URL</Button>
                  </div>
                </>
              )}
              {liError && (
                <p role="alert" className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">{liError}</p>
              )}
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Description (progressive disclosure: optional) */}
      <GlassPanel spotlight={false} className="rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-violet-400/15 text-violet-200"><Sparkles size={14} /></span>
          <label htmlFor="jd" className="text-sm font-medium text-white">Job description</label>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">optional</span>
          <span className="text-xs text-slate-500">enables ATS keyword scoring</span>
        </div>
        <textarea id="jd" rows={5} value={jd} onChange={e => setJd(e.target.value)}
          placeholder="Paste the full job description here to get ATS scoring and keyword suggestions after import…"
          className={TEXTAREA}/>
        {jd && <p className="mt-2 text-right font-mono text-[10px] text-slate-500">{jd.trim().split(/\s+/).length} words</p>}
      </GlassPanel>
    </div>
  )
}
