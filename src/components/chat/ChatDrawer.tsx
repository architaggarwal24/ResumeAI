// src/components/chat/ChatDrawer.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { AnimatePresence, motion } from 'motion/react'
import { X, Send, Bot, User, Sparkles, RotateCcw, Check, RefreshCw } from 'lucide-react'
import { SPRING } from '@/lib/motion'
import { cn, generateId } from '@/lib/utils'
import { applyResumeEdit, extractProposedEdits, stripPartialEditBlock } from '@/lib/resumeEdits'
import type { ChatMessage } from '@/types/resume'

const SUGGESTIONS = [
  'What are the weakest parts of my resume?',
  'Rewrite my summary to be more senior',
  'What keywords am I missing for a software engineer role?',
  'Make my top bullet point more impactful',
  'How would a recruiter rate this resume?',
  'Improve my weakest experience bullet and let me apply it',
]

export function ChatDrawer() {
  const { resumeData, byokCreds, addToast, updateResumeFieldSilent } = useResumeStore()
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  // Tracks apply/deny state for proposed edits, keyed by `${messageId}:${editIndex}`
  const [editStatuses, setEditStatuses] = useState<Record<string, 'applied' | 'denied'>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return
    if (!byokCreds.apiKey) { addToast('Add your API key in BYOK settings first', 'error'); return }
    if (!resumeData) { addToast('Load a resume first', 'error'); return }

    const userMsg: ChatMessage = { id: generateId('msg'), role: 'user', content: text, createdAt: new Date().toISOString() }
    const assistantMsg: ChatMessage = { id: generateId('msg'), role: 'assistant', content: '', createdAt: new Date().toISOString() }

    setMessages(p => [...p, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ ...m })),
          resumeData,
          creds: byokCreds,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Error ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Append onto the previous state's content directly, rather than
        // mutating an external accumulator variable — see react-hooks/immutability.
        const chunk = decoder.decode(value, { stream: true })
        setMessages(p => p.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m))
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Chat failed'
      setMessages(p => p.map(m => m.id === assistantMsg.id ? { ...m, content: `❌ ${msg}` } : m))
      addToast(msg, 'error')
    } finally {
      setStreaming(false)
    }
  }

  function stopStreaming() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  function clearChat() {
    setMessages([])
    setEditStatuses({})
  }

  // ── AI-proposed edit handlers ────────────────────────────────────────────
  function applyEdit(key: string, edit: { targetId: string; section: string; original?: string; suggested: string }) {
    if (!resumeData) return
    const next = applyResumeEdit(resumeData, edit)
    if (!next) {
      addToast("Couldn't find that section in your resume — try editing it manually in the Edit tab", 'error')
      return
    }
    updateResumeFieldSilent(() => next)
    setEditStatuses(p => ({ ...p, [key]: 'applied' }))
    addToast('Edit applied to your resume', 'success')
  }

  function denyEdit(key: string) {
    setEditStatuses(p => ({ ...p, [key]: 'denied' }))
  }

  function resuggestEdit(label: string) {
    sendMessage(`That edit for "${label}" didn't quite work — can you suggest a different rewrite?`)
  }

  return (
    <>
      {/* Toggle — floating orb button */}
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close AI coach' : 'Open AI coach'}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING.snappy}
        className={cn(
          'fixed bottom-24 right-4 z-40 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium sm:bottom-6 sm:right-6',
          open
            ? 'glass-strong text-slate-200'
            : 'btn-sheen bg-[linear-gradient(180deg,#a78bfa,#7c3aed_60%,#6d28d9)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_0_1px_rgba(167,139,250,.5),0_14px_34px_-10px_rgba(124,58,237,.95)]'
        )}
      >
        {!open && <span aria-hidden className="absolute inset-0 animate-[ping-soft_2.6s_ease-out_infinite] rounded-full border border-violet-300/50" />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={open ? 'x' : 'c'} initial={{ rotate: -90, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: 90, scale: 0.6 }} transition={{ duration: 0.15 }}>
            {open ? <X size={16} /> : <Sparkles size={16} />}
          </motion.span>
        </AnimatePresence>
        <span>{open ? 'Close' : 'AI Coach'}</span>
      </motion.button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="AI resume coach"
            initial={{ opacity: 0, y: 24, scale: 0.94, originX: 1, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96, transition: { duration: 0.16 } }}
            transition={SPRING.soft}
            className="glass-strong fixed inset-x-3 bottom-40 top-20 z-40 flex flex-col overflow-hidden rounded-3xl sm:inset-auto sm:bottom-20 sm:right-6 sm:h-[560px] sm:w-[400px]"
          >
            <span aria-hidden className="edge" />
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="relative grid size-9 place-items-center rounded-xl bg-[linear-gradient(145deg,#a78bfa,#6d28d9)] shadow-[0_0_20px_-4px_rgba(139,92,246,.9)]">
                  <Sparkles size={15} className="text-white" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#120e1a] bg-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI Resume Coach</p>
                  <p className="text-[11px] text-slate-400">{streaming ? 'Thinking…' : 'Has read your resume'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button type="button" onClick={clearChat} aria-label="Clear conversation" title="Clear conversation" className="press grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-white">
                    <RotateCcw size={14} />
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close AI coach" className="press grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-white">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-violet-500/25">
                      <Bot size={13} className="text-violet-200" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md bg-white/[0.06] px-3.5 py-2.5 text-sm leading-relaxed text-slate-200">
                      Hi! I&apos;m your AI resume coach. I have full context of your resume — I can point out weaknesses, rewrite sections, and propose edits you can apply with one click.
                    </div>
                  </div>
                  <p className="px-1 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Try asking</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        type="button"
                        key={i}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => sendMessage(s)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:border-violet-300/35 hover:bg-violet-500/10 hover:text-white"
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}
                    className={cn('flex items-start gap-2.5', msg.role === 'user' && 'flex-row-reverse')}
                  >
                    <div className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', msg.role === 'user' ? 'bg-white/10' : 'bg-violet-500/25')}>
                      {msg.role === 'user'
                        ? <User size={12} className="text-slate-200" />
                        : <Bot  size={13} className="text-violet-200" />}
                    </div>
                    <div className={cn(
                      'max-w-[86%] px-3.5 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'rounded-2xl rounded-tr-md bg-[linear-gradient(180deg,rgba(139,92,246,.4),rgba(109,40,217,.35))] text-white'
                        : 'rounded-2xl rounded-tl-md bg-white/[0.06] text-slate-200'
                    )}>
                      {msg.content ? (
                        msg.role === 'assistant' ? (
                          <AssistantMessage
                            messageId={msg.id}
                            content={msg.content}
                            streaming={streaming}
                            editStatuses={editStatuses}
                            onApply={applyEdit}
                            onDeny={denyEdit}
                            onResuggest={resuggestEdit}
                          />
                        ) : (
                          <MessageContent content={msg.content} />
                        )
                      ) : (
                        <span className="flex gap-1 py-1" aria-label="Coach is typing">
                          {[0, 150, 300].map(d => <span key={d} className="size-1.5 animate-bounce rounded-full bg-violet-300" style={{ animationDelay: `${d}ms` }} />)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-white/[0.07] p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 transition-colors focus-within:border-violet-300/50 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,.14)]">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                  placeholder="Ask anything about your resume…"
                  aria-label="Message the AI coach"
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
                  style={{ minHeight: 38, maxHeight: 110, overflowY: 'auto' }}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={streaming ? stopStreaming : () => sendMessage(input)}
                  disabled={!streaming && !input.trim()}
                  aria-label={streaming ? 'Stop' : 'Send'}
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
                    streaming
                      ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                      : 'bg-[linear-gradient(180deg,#a78bfa,#6d28d9)] text-white disabled:cursor-not-allowed disabled:opacity-40'
                  )}
                >
                  {streaming ? <X size={15} /> : <Send size={15} />}
                </motion.button>
              </div>
              <p className="mt-1.5 text-center text-[11px] text-slate-500">Enter to send · Shift+Enter for a new line</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Render markdown-like content (code blocks + plain text)
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^[a-z]*\n/, '')
          return (
            <pre key={i} className="mt-2 mb-2 bg-black/40 rounded-xl p-3 text-xs text-violet-100 border border-white/[0.06] overflow-x-auto whitespace-pre-wrap font-mono">
              {code}
            </pre>
          )
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>
      })}
    </>
  )
}

// Render an assistant message: prose + code blocks, plus any ```edit
// proposal blocks rendered as apply/deny cards.
function AssistantMessage({
  messageId, content, streaming, editStatuses, onApply, onDeny, onResuggest,
}: {
  messageId: string
  content: string
  streaming: boolean
  editStatuses: Record<string, 'applied' | 'denied'>
  onApply: (key: string, edit: { targetId: string; section: string; original?: string; suggested: string }) => void
  onDeny: (key: string) => void
  onResuggest: (label: string) => void
}) {
  // While the model is still streaming, hide any in-progress ```edit block
  // so the user doesn't see raw JSON being typed out.
  const visibleContent = streaming ? stripPartialEditBlock(content) : content
  const { text, edits } = extractProposedEdits(visibleContent)

  return (
    <>
      {text && <MessageContent content={text} />}
      {edits.map((edit, i) => {
        const key = `${messageId}:${i}`
        const status = editStatuses[key]
        return (
          <div key={key} className={cn(
            'mt-2 border rounded-xl overflow-hidden',
            status === 'applied' ? 'border-emerald-500/25 bg-emerald-500/5' :
            status === 'denied'  ? 'border-white/5 opacity-50' :
                                    'border-violet-500/25 bg-[#1c1f23]'
          )}>
            <div className="px-3 py-1.5 bg-violet-500/10 border-b border-white/[0.07]">
              <span className="text-xs font-mono text-violet-200">✦ {edit.label}</span>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              {edit.original && (
                <div className="text-xs text-rose-300/80 line-through opacity-70 leading-relaxed">{edit.original}</div>
              )}
              <div className="text-xs text-emerald-300 leading-relaxed">{edit.suggested}</div>
              {edit.reason && <p className="text-xs text-slate-500 leading-relaxed pt-0.5">{edit.reason}</p>}
            </div>
            {status === 'applied' ? (
              <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/7 text-xs text-emerald-400">
                <Check size={11} />Applied to your resume
              </div>
            ) : status === 'denied' ? (
              <div className="px-3 py-2 border-t border-white/7 text-xs text-slate-500">Dismissed</div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/7 bg-white/2">
                <button
                  onClick={() => onApply(key, edit)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                >
                  <Check size={11} />Apply
                </button>
                <button
                  onClick={() => onResuggest(edit.label)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-transparent hover:bg-white/5 text-slate-300 border border-white/8 hover:border-white/15 transition-colors"
                >
                  <RefreshCw size={11} />Re-suggest
                </button>
                <button
                  onClick={() => onDeny(key)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors ml-auto"
                >
                  <X size={11} />Deny
                </button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
