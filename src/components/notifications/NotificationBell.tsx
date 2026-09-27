// src/components/notifications/NotificationBell.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, CheckCheck, Loader2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Notification } from '@/types/resume'

const TYPE_ICON: Record<string, string> = {
  score_ready:   '📊',
  score_drop:    '📉',
  score_improve: '📈',
  job_followup:  '📅',
  resume_stale:  '⏰',
  share_viewed:  '👁',
  system:        '🔔',
}

export function NotificationBell() {
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
    // Deferred (not called synchronously from the effect body) so the state
    // updates inside fetchNotifs happen in their own task, not as part of
    // this render's commit — see react-hooks/set-state-in-effect.
    queueMicrotask(fetchNotifs)
    // Poll every 60s
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
    if (notif.href) { router.push(notif.href); setOpen(false) }
  }

  return (
    <div ref={panelRef} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/8 transition-colors text-slate-400 hover:text-slate-200">
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-violet-600 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-[#16161d] border border-white/12 rounded-2xl shadow-2xl z-50 overflow-hidden fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  <CheckCheck size={12} />Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="text-slate-600 spin" /></div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-none transition-colors',
                    notif.href ? 'cursor-pointer hover:bg-white/5' : 'cursor-default',
                    !notif.read && 'bg-violet-500/4'
                  )}>
                  <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[notif.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-tight mb-0.5', !notif.read ? 'font-semibold text-slate-200' : 'text-slate-300')}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 leading-snug">{notif.body}</p>
                    <p className="text-xs text-slate-600 mt-1">{formatDate(notif.createdAt)}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
