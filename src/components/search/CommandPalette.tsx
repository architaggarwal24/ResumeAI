// src/components/search/CommandPalette.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Briefcase, X, Loader2, Hash } from 'lucide-react'
import { cn, scoreColor } from '@/lib/utils'
import type { SearchResult } from '@/types/resume'

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      // Deferred (not called synchronously from the effect body) — see
      // react-hooks/set-state-in-effect.
      queueMicrotask(() => { setQuery(''); setResults([]) })
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setCursor(0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 200)
  }, [query, search])

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) { navigate(results[cursor]); }
  }

  function navigate(result: SearchResult) {
    router.push(result.href)
    setOpen(false)
  }

  const QUICK_LINKS = [
    { label: 'Dashboard',   href: '/dashboard',  icon: <Hash size={13}/> },
    { label: 'New Resume',  href: '/upload',     icon: <FileText size={13}/> },
    { label: 'Job Tracker', href: '/jobs',       icon: <Briefcase size={13}/> },
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 bg-[#16161d] border border-white/12 rounded-2xl shadow-2xl overflow-hidden fade-in"
        onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          {loading ? <Loader2 size={16} className="text-slate-500 spin shrink-0" /> : <Search size={16} className="text-slate-500 shrink-0" />}
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search resumes, jobs…"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none" />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="text-xs text-slate-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">Esc</kbd>
            <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300"><X size={14} /></button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2">
              {/* Group by type */}
              {['resume', 'job'].map(type => {
                const group = results.filter(r => r.type === type)
                if (!group.length) return null
                return (
                  <div key={type} className="mb-2">
                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 py-1.5">
                      {type === 'resume' ? 'Resumes' : 'Jobs'}
                    </p>
                    {group.map((result) => {
                      const globalIdx = results.indexOf(result)
                      return (
                        <div key={result.id}
                          onClick={() => navigate(result)}
                          onMouseEnter={() => setCursor(globalIdx)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
                            cursor === globalIdx ? 'bg-violet-600/15 text-violet-200' : 'hover:bg-white/5 text-slate-300'
                          )}>
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            type === 'resume' ? 'bg-violet-600/15' : 'bg-blue-600/15')}>
                            {type === 'resume'
                              ? <FileText size={13} className="text-violet-400" />
                              : <Briefcase size={13} className="text-blue-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                          </div>
                          {result.score != null && (
                            <span className={cn('text-xs font-mono font-bold shrink-0', scoreColor(result.score))}>
                              {Math.round(result.score)}
                            </span>
                          )}
                          {result.status && (
                            <span className="text-xs text-slate-500 capitalize shrink-0">{result.status}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="px-4 py-8 text-center text-slate-600 text-sm">No results for &quot;{query}&quot;</div>
          ) : (
            <div className="p-2">
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 py-1.5">Quick Links</p>
              {QUICK_LINKS.map((link) => (
                <div key={link.href}
                  onClick={() => { router.push(link.href); setOpen(false) }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{link.icon}</div>
                  <span className="text-sm">{link.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/7 flex items-center gap-3 text-xs text-slate-600">
          <span><kbd className="bg-white/5 px-1 rounded border border-white/10">↑↓</kbd> navigate</span>
          <span><kbd className="bg-white/5 px-1 rounded border border-white/10">↵</kbd> open</span>
          <span><kbd className="bg-white/5 px-1 rounded border border-white/10">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  )
}
