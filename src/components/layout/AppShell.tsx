// src/components/layout/AppShell.tsx
'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Briefcase, BarChart2, Wand2, LogOut, Settings, Search, X } from 'lucide-react'
import { CommandPalette } from '@/components/search/CommandPalette'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/upload',    icon: Upload,          label: 'New Resume'   },
  { href: '/build',     icon: Wand2,           label: 'Build Resume' },
  { href: '/jobs',      icon: Briefcase,       label: 'Job Tracker'  },
  { href: '/analytics', icon: BarChart2,       label: 'Analytics'    },
]

function SidebarBody({ user, pathname, onNavigate, onSignOut }: {
  user: User
  pathname: string
  onNavigate?: () => void
  onSignOut: () => void
}) {
  // Gliding hover pill behind the nav items (Unlumen "highlight" idea).
  const [hl, setHl] = useState<{ top: number; height: number } | null>(null)

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-white/7 shrink-0">
        <div className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_10px_2px_rgba(251,191,36,0.5)]" />
        <span className="font-display text-lg font-semibold">ResumeAI</span>
      </div>

      {/* Search hint */}
      <button
        onClick={() => { onNavigate?.(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })) }}
        className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-[#1c1f23] border border-white/8 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:border-white/15 transition-all cursor-pointer"
      >
        <Search size={12} />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-[10px] bg-white/5 px-1 rounded border border-white/10">⌘K</kbd>
      </button>

      {/* Nav */}
      <nav className="relative flex-1 p-3 space-y-0.5 overflow-y-auto mt-1" aria-label="Primary" onPointerLeave={() => setHl(null)}>
        <span aria-hidden className="pointer-events-none absolute left-3 right-3 rounded-lg bg-white/[0.05] transition-[top,height,opacity] duration-200 ease-out"
          style={{ top: hl?.top ?? 0, height: hl?.height ?? 0, opacity: hl ? 1 : 0 }} />
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 py-2">Menu</p>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
              onPointerEnter={e => setHl({ top: e.currentTarget.offsetTop, height: e.currentTarget.offsetHeight })}
              className={cn(
                'relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-200',
                active
                  ? 'bg-violet-600/15 text-violet-200 shadow-[inset_0_0_0_1px_rgba(60,201,174,0.22)]'
                  : 'text-slate-400 hover:text-slate-100'
              )}>
              {active && <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-violet-400 shadow-[0_0_10px_2px_rgba(60,201,174,0.6)]" />}
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/7 shrink-0">
        <div className="flex items-center gap-1 px-1 mb-2">
          <NotificationBell />
          <Link href="/settings" onClick={onNavigate} aria-label="Settings"
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/8 transition-colors',
              pathname === '/settings' ? 'text-violet-300 bg-violet-600/15' : 'text-slate-400 hover:text-slate-200'
            )}>
            <Settings size={15} />
          </Link>
        </div>
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <div className="w-6 h-6 rounded-full bg-[linear-gradient(135deg,#2fbfa3,#fbbf24)] flex items-center justify-center text-xs font-bold text-white">
            {user.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-xs text-slate-400 truncate flex-1">{user.email}</span>
        </div>
        <button onClick={onSignOut}
          className="flex items-center gap-2 px-3 py-1.5 w-full rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
          <LogOut size={13} />Sign out
        </button>
      </div>
    </>
  )
}

export function AppShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [drawer, setDrawer] = useState(false)

  // Close the mobile drawer on route change and on Escape.
  useEffect(() => { setDrawer(false) }, [pathname])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#0b0c0d] overflow-hidden">
      {/* Command Palette — always mounted */}
      <CommandPalette />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col bg-[#111214] border-r border-white/7">
        <SidebarBody user={user} pathname={pathname} onSignOut={signOut} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="slide-in absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-[#111214] border-r border-white/10 shadow-2xl">
            <button aria-label="Close menu" onClick={() => setDrawer(false)}
              className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-200 transition-colors"><X size={16} /></button>
            <SidebarBody user={user} pathname={pathname} onNavigate={() => setDrawer(false)} onSignOut={signOut} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 h-12 px-4 border-b border-white/7 bg-[#111214] shrink-0">
          <button aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}
            className="text-slate-300 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_10px_2px_rgba(251,191,36,0.5)]" />
            <span className="font-bold tracking-tight text-sm">ResumeAI</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
