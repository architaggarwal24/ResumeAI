'use client'
import { useState, useRef, useEffect } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { MessageSquare, X, Send, Loader2, Bot, User, Sparkles, RotateCcw } from 'lucide-react'
import { cn, generateId } from '@/lib/utils'
import type { ChatMessage } from '@/types/resume'

const SUGGESTIONS = [
  'What are the weakest parts of my resume?',
  'Rewrite my summary to be more senior',
  'What keywords am I missing for a software engineer role?',
  'Make my top bullet point more impactful',
  'How would a recruiter rate this resume?',
]

export function ChatDrawer() {
  const { resumeData, byokCreds, addToast } = useResumeStore()
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
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
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(p => p.map(m => m.id === assistantMsg.id ? { ...m, content: accumulated } : m))
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
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all',
          open
            ? 'bg-[#1c1c24] border border-white/15 text-slate-400 hover:text-slate-200'
            : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-900/40'
        )}
      >
        {open ? <X size={16} /> : <MessageSquare size={16} />}
        <span className="text-sm font-medium">{open ? 'Close' : 'AI Coach'}</span>
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed right-6 bottom-16 z-40 w-[380px] h-[520px] flex flex-col bg-[#16161d] border border-white/12 rounded-2xl shadow-2xl overflow-hidden fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-violet-600/30 flex items-center justify-center">
                <Sparkles size={12} className="text-violet-400" />
              </div>
              <span className="font-semibold text-sm">AI Resume Coach</span>
            </div>
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button onClick={clearChat} className="text-slate-600 hover:text-slate-300 p-1 rounded hover:bg-white/5 transition-colors">
                  <RotateCcw size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300 p-1 rounded hover:bg-white/5 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-violet-600/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-violet-400" />
                  </div>
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-slate-300 leading-relaxed">
                    Hi! I'm your AI resume coach. I have full context of your resume and can help you improve it, identify weaknesses, rewrite sections, or just tell you how a recruiter would see it.
                  </div>
                </div>
                <div className="space-y-1.5 pt-1">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className="w-full text-left text-xs text-slate-400 hover:text-slate-200 px-3 py-2 bg-white/4 hover:bg-white/8 rounded-xl transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={cn('flex items-start gap-2.5', msg.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    msg.role === 'user' ? 'bg-slate-700' : 'bg-violet-600/30')}>
                    {msg.role === 'user'
                      ? <User size={11} className="text-slate-300" />
                      : <Bot  size={11} className="text-violet-400" />}
                  </div>
                  <div className={cn(
                    'max-w-[85%] px-3 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-violet-600/20 text-violet-100 rounded-2xl rounded-tr-sm'
                      : 'bg-white/5 text-slate-300 rounded-2xl rounded-tl-sm'
                  )}>
                    {msg.content ? (
                      <MessageContent content={msg.content} />
                    ) : (
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'0ms'}}/>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'150ms'}}/>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'300ms'}}/>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/8 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                placeholder="Ask anything about your resume…"
                rows={1}
                disabled={streaming}
                className="flex-1 bg-[#1c1c24] border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none disabled:opacity-50"
                style={{ minHeight: 38, maxHeight: 100, overflowY: 'auto' }}
              />
              <button
                onClick={streaming ? stopStreaming : () => sendMessage(input)}
                disabled={!streaming && !input.trim()}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                  streaming
                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                    : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {streaming
                  ? <X size={14} />
                  : <Send size={14} />}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 text-center">Shift+Enter for new line · Enter to send</p>
          </div>
        </div>
      )}
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
            <pre key={i} className="mt-2 mb-2 bg-black/30 rounded-lg p-2.5 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap font-mono">
              {code}
            </pre>
          )
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>
      })}
    </>
  )
}
