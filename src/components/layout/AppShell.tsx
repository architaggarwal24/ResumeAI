// src/components/layout/AppShell.tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Briefcase, BarChart2, Wand2, LogOut, Settings, Search } from 'lucide-react'
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

export function AppShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#0c0c0f] overflow-hidden">
      {/* Command Palette — always mounted */}
      <CommandPalette />

      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col bg-[#111116] border-r border-white/7">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-white/7 shrink-0">
          <div className="w-2 h-2 rounded-full bg-violet-500 shadow-lg shadow-violet-500/50" />
          <span className="font-bold tracking-tight">ResumeAI</span>
        </div>

        {/* Search hint */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-[#1c1c24] border border-white/8 rounded-lg text-xs text-slate-600 hover:text-slate-400 hover:border-white/15 transition-all cursor-pointer"
        >
          <Search size={12} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] bg-white/5 px-1 rounded border border-white/10">⌘K</kbd>
        </button>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 py-2">Menu</p>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                  active ? 'bg-violet-600/15 text-violet-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}>
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/7 shrink-0">
          {/* Notification bell + settings row */}
          <div className="flex items-center gap-1 px-1 mb-2">
            <NotificationBell />
            <Link href="/settings"
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/8 transition-colors',
                pathname === '/settings' ? 'text-violet-300 bg-violet-600/15' : 'text-slate-400 hover:text-slate-200'
              )}>
              <Settings size={15} />
            </Link>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="w-6 h-6 rounded-full bg-violet-600/30 flex items-center justify-center text-xs font-bold text-violet-300">
              {user.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-xs text-slate-400 truncate flex-1">{user.email}</span>
          </div>
          <button onClick={signOut}
            className="flex items-center gap-2 px-3 py-1.5 w-full rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <LogOut size={13} />Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
