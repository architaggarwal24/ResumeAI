// src/components/notifications/NotificationBell.tsx
'use client'
import { safeInternalHref } from '@/lib/security/url'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, X, CheckCheck, Loader2, BarChart3, TrendingDown, TrendingUp, CalendarClock, Clock, Eye, BellRing, type LucideIcon } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { SPRING } from '@/lib/motion'
import type { Notification } from '@/types/resume'

const TYPE_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  score_ready:   { icon: BarChart3,     tone: 'text-violet-300 bg-violet-400/15' },
  score_drop:    { icon: TrendingDown,  tone: 'text-rose-300 bg-rose-400/15' },
  score_improve: { icon: TrendingUp,    tone: 'text-emerald-300 bg-emerald-400/15' },
  job_followup:  { icon: CalendarClock, tone: 'text-sky-300 bg-sky-400/15' },
  resume_stale:  { icon: Clock,         tone: 'text-amber-200 bg-amber-300/15' },
  share_viewed:  { icon: Eye,           tone: 'text-fuchsia-300 bg-fuchsia-400/15' },
  system:        { icon: BellRing,      tone: 'text-slate-300 bg-white/10' },
}

export function NotificationBell({ placement = 'bottom-end' }: { placement?: 'bottom-end' | 'top-start' }) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [notifications, setNotifs]    = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading]         = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  async function fetchNotifs() {
    setLoading(true)
    try {
      const res  = await fetch('/api/notifications')
      const data = await res.json()
      setNotifs(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    // Deferred (not called synchronously from the effect body) — see
    // react-hooks/set-state-in-effect.
    queueMicrotask(fetchNotifs)
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    setNotifs(p => p.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  function handleClick(notif: Notification) {
    if (!notif.read) markRead(notif.id)
    const dest = safeInternalHref(notif.href)
    if (dest) { router.push(dest); setOpen(false) }
  }

  const pos = placement === 'top-start' ? 'bottom-full left-0 mb-2 origin-bottom-left' : 'right-0 top-full mt-2 origin-top-right'

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        className={cn('press relative grid size-10 place-items-center rounded-xl text-slate-300 hover:bg-white/[0.07] hover:text-white', open && 'bg-white/[0.08] text-white')}
      >
        <motion.span animate={unreadCount ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.7, repeat: unreadCount ? Infinity : 0, repeatDelay: 6 }}>
          <Bell size={17} />
        </motion.span>
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING.bouncy}
              className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(232,121,249,.7)]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: placement === 'top-start' ? 8 : -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
            transition={SPRING.soft}
            className={cn('glass-strong absolute z-[90] w-[min(88vw,22rem)] overflow-hidden rounded-2xl', pos)}
            role="dialog"
            aria-label="Notifications"
          >
            <span aria-hidden className="edge" />
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="press flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs text-violet-300 hover:bg-white/[0.06] hover:text-violet-200">
                    <CheckCheck size={13} />Mark all read
                  </button>
                )}
                <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="press grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"><X size={14} /></button>
              </div>
            </div>

            <div className="max-h-[22rem] overflow-y-auto p-1.5">
              {loading && notifications.length === 0 ? (
                <div className="space-y-2 p-2">{[0, 1, 2].map(i => <div key={i} className="skeleton h-14" />)}</div>
              ) : notifications.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-white/[0.05] text-slate-500"><Bell size={20} /></div>
                  <p className="text-sm text-slate-300">You’re all caught up</p>
                  <p className="mt-1 text-xs text-slate-500">Score changes and job follow-ups land here.</p>
                </div>
              ) : (
                notifications.map((notif, i) => {
                  const t = TYPE_ICON[notif.type] ?? TYPE_ICON.system
                  const Icon = t.icon
                  return (
                    <motion.button
                      type="button"
                      key={notif.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => handleClick(notif)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                        notif.href ? 'hover:bg-white/[0.05]' : 'cursor-default',
                        !notif.read && 'bg-violet-500/[0.06]',
                      )}
                    >
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', t.tone)}><Icon size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('mb-0.5 block text-sm leading-tight', !notif.read ? 'font-semibold text-white' : 'text-slate-300')}>{notif.title}</span>
                        <span className="block text-xs leading-snug text-slate-400">{notif.body}</span>
                        <span className="mt-1 block font-mono text-[10px] text-slate-500">{formatDate(notif.createdAt)}</span>
                      </span>
                      {!notif.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,.8)]" />}
                    </motion.button>
                  )
                })
              )}
              {loading && notifications.length > 0 && <div className="flex justify-center py-2"><Loader2 size={14} className="spin text-slate-500" /></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
