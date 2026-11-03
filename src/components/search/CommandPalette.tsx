// src/components/search/CommandPalette.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Search, FileText, Briefcase, X, Loader2, LayoutDashboard, Upload, Wand2, BarChart2, Settings, CornerDownLeft, type LucideIcon } from 'lucide-react'
import { cn, scoreColor } from '@/lib/utils'
import { SPRING } from '@/lib/motion'
import { Kbd } from '@/components/ui/glass/Atoms'
import type { SearchResult } from '@/types/resume'

/** Any component can open the palette with `openCommandPalette()`. */
export const OPEN_PALETTE_EVENT = 'resumeai:open-palette'
export function openCommandPalette() {
  document.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))
}

const QUICK_LINKS: { label: string; href: string; icon: LucideIcon; hint: string }[] = [
  { label: 'Dashboard',    href: '/dashboard', icon: LayoutDashboard, hint: 'Overview' },
  { label: 'New resume',   href: '/upload',    icon: Upload,          hint: 'Upload a PDF or DOCX' },
  { label: 'Build resume', href: '/build',     icon: Wand2,           hint: 'Start from scratch' },
  { label: 'Job tracker',  href: '/jobs',      icon: Briefcase,       hint: 'Coming soon' },
  { label: 'Analytics',    href: '/analytics', icon: BarChart2,       hint: 'Score history' },
  { label: 'Settings',     href: '/settings',  icon: Settings,        hint: 'Keys & account' },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K to toggle, Esc to close, custom event to open.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const openIt = () => setOpen(true)
    document.addEventListener('keydown', handler)
    document.addEventListener(OPEN_PALETTE_EVENT, openIt)
    return () => { document.removeEventListener('keydown', handler); document.removeEventListener(OPEN_PALETTE_EVENT, openIt) }
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      queueMicrotask(() => { setQuery(''); setResults([]); setCursor(0) })
    }
  }, [open])

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

  const showingQuick = !(results.length > 0) && !(query.length >= 2 && !loading)
  const quick = QUICK_LINKS.filter(l => !query || l.label.toLowerCase().includes(query.toLowerCase()))
  const count = showingQuick ? quick.length : results.length

  function go(href: string) { router.push(href); setOpen(false) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, Math.max(0, count - 1))) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') {
      if (showingQuick && quick[cursor]) go(quick[cursor].href)
      else if (results[cursor]) go(results[cursor].href)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#05040a]/70 backdrop-blur-md"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search and jump"
            initial={{ opacity: 0, y: -12, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={SPRING.soft}
            className="glass-strong relative w-full max-w-xl overflow-hidden rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            <span aria-hidden className="edge" />
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
              {loading ? <Loader2 size={18} className="spin shrink-0 text-violet-300" /> : <Search size={18} className="shrink-0 text-slate-400" />}
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search resumes, jobs, or jump to…"
                aria-label="Search"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                className="flex-1 bg-transparent text-[15px] text-white placeholder:text-slate-500 focus:outline-none"
              />
              <Kbd>Esc</Kbd>
              <button type="button" aria-label="Close search" onClick={() => setOpen(false)} className="press grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white"><X size={15} /></button>
            </div>

            <div id="palette-list" role="listbox" className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
              {!showingQuick && results.length > 0 ? (
                (['resume', 'job'] as const).map(type => {
                  const group = results.filter(r => r.type === type)
                  if (!group.length) return null
                  return (
                    <div key={type} className="mb-1">
                      <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{type === 'resume' ? 'Resumes' : 'Jobs'}</p>
                      {group.map(result => {
                        const idx = results.indexOf(result)
                        return (
                          <Row key={result.id} active={cursor === idx} onHover={() => setCursor(idx)} onClick={() => go(result.href)}
                            icon={type === 'resume' ? FileText : Briefcase} tone={type === 'resume' ? 'violet' : 'sky'}
                            title={result.title} subtitle={result.subtitle}
                            right={
                              result.score != null ? <span className={cn('font-mono text-xs font-bold', scoreColor(result.score))}>{Math.round(result.score)}</span>
                                : result.status ? <span className="text-xs capitalize text-slate-500">{result.status}</span> : null
                            }
                          />
                        )
                      })}
                    </div>
                  )
                })
              ) : !showingQuick ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-slate-300">No results for “{query}”</p>
                  <p className="mt-1 text-xs text-slate-500">Try a company, job title or resume name.</p>
                </div>
              ) : (
                <>
                  <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Jump to</p>
                  {quick.map((l, i) => (
                    <Row key={l.href} active={cursor === i} onHover={() => setCursor(i)} onClick={() => go(l.href)} icon={l.icon} tone="neutral" title={l.label} subtitle={l.hint} />
                  ))}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-white/[0.07] px-5 py-2.5 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>navigate</span>
              <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft size={10} /></Kbd>open</span>
              <span className="ml-auto flex items-center gap-1.5"><Kbd>⌘</Kbd><Kbd>K</Kbd>toggle</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function Row({ active, onHover, onClick, icon: Icon, tone, title, subtitle, right }: {
  active: boolean; onHover: () => void; onClick: () => void; icon: LucideIcon; tone: 'violet' | 'sky' | 'neutral'
  title: string; subtitle?: string; right?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onClick}
      className={cn('relative flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors', active ? 'text-white' : 'text-slate-300')}
    >
      {active && <motion.span layoutId="palette-cursor" transition={SPRING.snappy} className="absolute inset-0 rounded-2xl border border-violet-300/25 bg-violet-500/15" />}
      <span className={cn('relative grid size-9 shrink-0 place-items-center rounded-xl',
        tone === 'violet' ? 'bg-violet-400/15 text-violet-300' : tone === 'sky' ? 'bg-sky-400/15 text-sky-300' : 'bg-white/[0.06] text-slate-300')}>
        <Icon size={16} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
      </span>
      {right && <span className="relative shrink-0">{right}</span>}
      {active && <CornerDownLeft size={14} className="relative shrink-0 text-violet-300" />}
    </button>
  )
}
