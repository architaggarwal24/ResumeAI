// src/components/resume/InterviewTab.tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button } from '@/components/ui/primitives'
import { cn, generateId, scoreColor } from '@/lib/utils'
import { BriefcaseIcon, Send, Loader2, RotateCcw, TrendingUp, BookOpen, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { InterviewMessage, MockInterviewDebrief } from '@/types/resume'

const DEBRIEF_TRIGGERS = ['debrief', 'show debrief', 'show results', 'get results', 'see results']
const QUESTION_COUNT = 8  // hiring manager skill: 5 technical + 3 behavioural

export function InterviewTab() {
  const { resumeData, byokCreds, addToast } = useResumeStore()

  const [targetRole, setTargetRole]   = useState('')
  const [started, setStarted]         = useState(false)
  const [messages, setMessages]       = useState<InterviewMessage[]>([])
  const [input, setInput]             = useState('')
  const [streaming, setStreaming]      = useState(false)
  const [debrief, setDebrief]         = useState<MockInterviewDebrief | null>(null)
  const [debriefing, setDebriefing]   = useState(false)
  const [expandedWeakness, setExpandedWeakness] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, debrief])

  async function startInterview() {
    if (!byokCreds.apiKey) {
      addToast('Add your API key in Settings first', 'error'); return
    }
    if (!resumeData) { addToast('No resume loaded', 'error'); return }
    setStarted(true)
    setMessages([])
    setDebrief(null)
    await sendTurn([])
  }

  function resetInterview() {
    abortRef.current?.abort()
    setStarted(false)
    setMessages([])
    setDebrief(null)
    setInput('')
    setStreaming(false)
  }

  const sendTurn = useCallback(async (history: InterviewMessage[], userContent?: string) => {
    if (!resumeData) return

    const newMessages: InterviewMessage[] = userContent
      ? [...history, { id: generateId('msg'), role: 'candidate' as const, content: userContent }]
      : history

    // Add placeholder for streaming interviewer response
    const placeholderId = generateId('msg')
    setMessages([...newMessages, { id: placeholderId, role: 'interviewer', content: '' }])
    setStreaming(true)

    abortRef.current = new AbortController()
    let accumulated = ''

    try {
      const res = await fetch('/api/mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          resumeData,
          creds: byokCreds,
          messages: newMessages,
          mode: 'chat',
          targetRole: targetRole.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error || `Error ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: accumulated } : m
        ))
      }

      // Finalise the streaming message
      const finalMsg: InterviewMessage = { id: placeholderId, role: 'interviewer', content: accumulated }
      const finalHistory = [...newMessages, finalMsg]
      setMessages(finalHistory)

      // Detect end-of-interview signal from the model
      const interviewerTurns = finalHistory.filter(m => m.role === 'interviewer').length

      // Detect end-of-interview signal from the model
      if (accumulated.toLowerCase().includes("type 'debrief'") || interviewerTurns > QUESTION_COUNT) {
        setMessages(prev => [
          ...prev,
          {
            id: generateId('sys'),
            role: 'system',
            content: '✓ Interview complete. Type "debrief" or click the button below to see your results.',
          },
        ])
      }

    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      addToast(err instanceof Error ? err.message : 'Interview failed', 'error')
      setMessages(prev => prev.filter(m => m.id !== placeholderId))
    }
    setStreaming(false)
  }, [resumeData, byokCreds, targetRole, addToast])

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    // Check for debrief trigger
    if (DEBRIEF_TRIGGERS.some(t => text.toLowerCase().includes(t))) {
      await generateDebrief()
      return
    }

    await sendTurn(messages.filter(m => m.role !== 'system'), text)
  }

  async function generateDebrief() {
    if (!resumeData) return
    setDebriefing(true)
    try {
      const res = await fetch('/api/mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData, creds: byokCreds,
          messages: messages.filter(m => m.role !== 'system'),
          mode: 'debrief',
          targetRole: targetRole.trim() || undefined,
        }),
      })
      const data = await res.json() as { result?: MockInterviewDebrief; error?: string }
      if (!res.ok || !data.result) throw new Error(data.error || 'Debrief failed')
      setDebrief(data.result)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Debrief failed', 'error')
    }
    setDebriefing(false)
  }

  const interviewerTurns = messages.filter(m => m.role === 'interviewer' && m.content).length
  const showDebriefButton = interviewerTurns >= QUESTION_COUNT && !debrief

  // ── Pre-start screen ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="mx-auto px-6 py-10 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <BriefcaseIcon size={18} className="text-violet-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Mock Interview</h2>
            <p className="text-xs text-slate-500 mt-0.5">8-round simulation with a real hiring manager lens</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-[#16161d] border border-white/7 rounded-xl p-4 space-y-2.5">
            <InfoRow icon="🎯" label="5 technical questions" sub="Role-specific, tailored to your actual resume and stack" />
            <InfoRow icon="💬" label="3 behavioural questions" sub="STAR-format, with real interviewer pushback" />
            <InfoRow icon="📊" label="Per-answer ratings" sub="Scored out of 10, with coaching after each response" />
            <InfoRow icon="📋" label="Full debrief" sub="Hireability score, weakest answers, personalized study plan" />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">Target role <span className="text-slate-600">(optional — helps calibrate questions)</span></label>
          <input
            type="text"
            value={targetRole}
            onChange={e => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer, Product Manager, Data Scientist"
            className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
            onKeyDown={e => e.key === 'Enter' && startInterview()}
          />
        </div>

        <Button variant="primary" onClick={startInterview} className="w-full justify-center py-3">
          <BriefcaseIcon size={15} />
          Start Interview
        </Button>
        <p className="text-xs text-slate-600 text-center mt-3">Uses your connected AI provider · ~10-15 minutes</p>
      </div>
    )
  }

  // ── Chat interface ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/7 shrink-0">
        <div className="flex items-center gap-2">
          <BriefcaseIcon size={15} className="text-violet-400" />
          <span className="text-sm font-medium">Mock Interview</span>
          {targetRole && <span className="text-xs text-slate-500">· {targetRole}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {Math.min(interviewerTurns, QUESTION_COUNT)}/{QUESTION_COUNT} questions
          </span>
          <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500/60 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((interviewerTurns / QUESTION_COUNT) * 100, 100)}%` }}
            />
          </div>
          <button onClick={resetInterview} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <RotateCcw size={12} />Reset
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} streaming={streaming && msg === messages[messages.length - 1]} />
        ))}

        {/* Debrief trigger button */}
        {showDebriefButton && !debriefing && (
          <div className="flex justify-center py-2">
            <button
              onClick={generateDebrief}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 text-sm font-medium rounded-xl transition-colors"
            >
              <TrendingUp size={14} />
              See your debrief & hireability score
            </button>
          </div>
        )}

        {debriefing && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 size={14} className="spin" />Generating debrief…
          </div>
        )}

        {/* Debrief card */}
        {debrief && <DebriefCard debrief={debrief} expandedWeakness={expandedWeakness} setExpandedWeakness={setExpandedWeakness} />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!debrief && (
        <div className="px-6 py-4 border-t border-white/7 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={streaming ? 'Interviewer is responding…' : showDebriefButton ? "Type 'debrief' or click the button above…" : 'Your answer…'}
              disabled={streaming}
              className="flex-1 bg-[#1c1c24] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none disabled:opacity-50 leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {streaming ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base shrink-0">{icon}</span>
      <div>
        <p className="text-sm text-slate-200 font-medium">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  )
}

function MessageBubble({ message, streaming }: { message: InterviewMessage; streaming: boolean }) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-slate-500 bg-white/4 border border-white/8 rounded-full px-3 py-1">
          {message.content}
        </span>
      </div>
    )
  }

  const isInterviewer = message.role === 'interviewer'
  return (
    <div className={cn('flex gap-3', isInterviewer ? 'justify-start' : 'justify-end')}>
      {isInterviewer && (
        <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <BriefcaseIcon size={12} className="text-violet-400" />
        </div>
      )}
      <div className={cn(
        'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
        isInterviewer
          ? 'bg-[#1c1c24] border border-white/7 text-slate-200 rounded-tl-sm'
          : 'bg-violet-600/20 border border-violet-500/20 text-violet-100 rounded-tr-sm'
      )}>
        {message.content || (streaming ? (
          <span className="flex gap-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
        ) : null)}
      </div>
    </div>
  )
}

function DebriefCard({
  debrief, expandedWeakness, setExpandedWeakness
}: {
  debrief: MockInterviewDebrief
  expandedWeakness: number | null
  setExpandedWeakness: (i: number | null) => void
}) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, debrief.hireabilityScore) / 100)
  const ringCol = debrief.hireabilityScore >= 70 ? '#34d399' : debrief.hireabilityScore >= 45 ? '#fbbf24' : '#f87171'

  const verdictStyles: Record<string, string> = {
    strong_yes: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
    yes:        'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    maybe:      'bg-amber-400/10 text-amber-400 border-amber-400/20',
    no:         'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const verdictLabels: Record<string, string> = {
    strong_yes: 'Strong Yes', yes: 'Yes', maybe: 'Maybe', no: 'No'
  }

  return (
    <div className="border border-violet-500/20 bg-[#16161d] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/7 bg-violet-500/5">
        <p className="text-xs font-mono text-violet-400/70 uppercase tracking-wider mb-3">Interview Debrief</p>
        <div className="flex items-center gap-5">
          {/* Score ring */}
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 84 84" className="w-20 h-20 -rotate-90">
              <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
              <circle cx="42" cy="42" r={r} fill="none" stroke={ringCol} strokeWidth="6"
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-xl font-bold font-mono', scoreColor(debrief.hireabilityScore))}>
                {debrief.hireabilityScore}
              </span>
              <span className="text-[9px] text-slate-500">/ 100</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-semibold text-slate-200">Hireability Score</span>
              {debrief.verdict && (
                <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full border', verdictStyles[debrief.verdict] || verdictStyles.maybe)}>
                  {verdictLabels[debrief.verdict] || debrief.verdict}
                </span>
              )}
            </div>
            {debrief.verdictReason && (
              <p className="text-sm text-slate-400 leading-relaxed">{debrief.verdictReason}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Weakest answers */}
        {debrief.weakestAnswers?.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-mono text-slate-500 mb-2.5">
              <AlertTriangle size={11} />Answers to Improve
            </p>
            <div className="space-y-2">
              {debrief.weakestAnswers.map((w, i) => (
                <div key={i} className="border border-white/7 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedWeakness(expandedWeakness === i ? null : i)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
                  >
                    <span className="text-xs font-mono text-red-400/70 shrink-0 mt-0.5">#{i + 1}</span>
                    <p className="text-xs text-slate-300 flex-1 leading-relaxed">{w.question}</p>
                    {expandedWeakness === i ? <ChevronUp size={13} className="text-slate-500 shrink-0 mt-0.5" /> : <ChevronDown size={13} className="text-slate-500 shrink-0 mt-0.5" />}
                  </button>
                  {expandedWeakness === i && (
                    <div className="px-4 pb-4 border-t border-white/7 pt-3 space-y-3">
                      <div>
                        <p className="text-xs font-mono text-slate-500 mb-1">What was weak</p>
                        <p className="text-xs text-red-400/80 bg-red-400/5 border border-red-400/15 rounded-lg px-3 py-2 leading-relaxed">{w.issue}</p>
                      </div>
                      <div>
                        <p className="text-xs font-mono text-slate-500 mb-1">What a top candidate would say</p>
                        <p className="text-xs text-emerald-400 bg-emerald-400/5 border border-emerald-400/15 rounded-lg px-3 py-2 leading-relaxed">{w.betterAnswer}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questions to rehearse */}
        {debrief.questionsToRehearse?.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-mono text-slate-500 mb-2.5">
              <BookOpen size={11} />Questions to Rehearse
            </p>
            <div className="space-y-1.5">
              {debrief.questionsToRehearse.map((q, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-400 bg-white/3 border border-white/7 rounded-lg px-3 py-2">
                  <span className="text-amber-400/60 font-mono shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{q}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Study plan */}
        {debrief.studyPlan?.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-mono text-slate-500 mb-2.5">
              <CheckCircle size={11} />Study Plan
            </p>
            <div className="space-y-1.5">
              {debrief.studyPlan.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="w-4 h-4 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-mono">{i + 1}</span>
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
