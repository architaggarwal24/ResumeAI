// src/components/layout/AppShell.tsx
'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { LayoutDashboard, Upload, Briefcase, BarChart2, Wand2, LogOut, Settings, Search, PanelLeftClose, PanelLeftOpen, Plus, Menu, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SPRING } from '@/lib/motion'
import { CommandPalette, openCommandPalette } from '@/components/search/CommandPalette'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Kbd } from '@/components/ui/glass/Atoms'
import type { User } from '@supabase/supabase-js'

interface NavItem { href: string; icon: LucideIcon; label: string; soon?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/upload',    icon: Upload,          label: 'New resume' },
  { href: '/build',     icon: Wand2,           label: 'Build resume' },
  { href: '/jobs',      icon: Briefcase,       label: 'Job tracker', soon: true },
  { href: '/analytics', icon: BarChart2,       label: 'Analytics' },
]

const COLLAPSE_KEY = 'resumeai.sidebar.collapsed'

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
}

function Mark({ className }: { className?: string }) {
  return (
    <span className={cn('relative grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#c4b5fd,#7c3aed_55%,#3b0f7a)] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_20px_-6px_rgba(139,92,246,.9)]', className)}>
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M6 4h8l4 4v12H6z" /><path d="M9 13h6M9 17h4" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_2px_rgba(232,121,249,.7)]" />
    </span>
  )
}

function Avatar({ email }: { email?: string | null }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#8b5cf6,#e879f9)] text-sm font-semibold text-white ring-2 ring-white/10">
      {email?.[0]?.toUpperCase() ?? 'U'}
    </span>
  )
}

/* ─── Desktop sidebar ────────────────────────────────────────────────────── */
function Sidebar({ user, pathname, collapsed, onToggle, onSignOut }: {
  user: User; pathname: string; collapsed: boolean; onToggle: () => void; onSignOut: () => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  return (
    <motion.aside
      animate={{ width: collapsed ? 84 : 256 }}
      transition={SPRING.soft}
      className="relative z-20 m-3 mr-0 hidden shrink-0 md:block"
    >
      <div className="glass relative flex h-full flex-col rounded-3xl p-3">
        <span aria-hidden className="edge" />

        {/* Brand + collapse */}
        <div className={cn('mb-3 flex h-11 items-center', collapsed ? 'justify-center' : 'justify-between pl-1')}>
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="ResumeAI dashboard">
            <Mark />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="text-[17px] font-semibold tracking-tight text-white">
                  Resume<span className="text-violet-300">AI</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          {!collapsed && (
            <button type="button" onClick={onToggle} aria-label="Collapse sidebar" className="press grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-white">
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>

        {/* Primary action (the one thing) */}
        <Link
          href="/upload"
          className={cn(
            'btn-sheen press group mb-2 flex h-11 items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#a78bfa_0%,#7c3aed_60%,#6d28d9_100%)] text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_0_1px_rgba(167,139,250,.45),0_10px_28px_-10px_rgba(124,58,237,.9)]',
            collapsed ? 'justify-center' : 'px-4',
          )}
          aria-label="New resume"
        >
          <Plus size={17} className="transition-transform duration-300 group-hover:rotate-90" />
          {!collapsed && <span>New resume</span>}
        </Link>

        {/* Search */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search (Command K)"
          className={cn('press mb-4 flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-slate-400 hover:border-white/15 hover:text-slate-200', collapsed ? 'justify-center' : 'px-3')}
        >
          <Search size={15} />
          {!collapsed && <><span className="flex-1 text-left">Search…</span><Kbd>⌘K</Kbd></>}
        </button>

        {/* Nav */}
        <nav aria-label="Primary" className="flex-1 overflow-y-auto" onMouseLeave={() => setHover(null)}>
          {!collapsed && <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Workspace</p>}
          <ul className="space-y-1">
            {NAV.map(({ href, icon: Icon, label, soon }) => {
              const active = isActive(pathname, href)
              return (
                <li key={href} className="relative">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onMouseEnter={() => setHover(href)}
                    onFocus={() => setHover(href)}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'relative z-10 flex h-11 items-center gap-3 rounded-xl text-sm transition-colors',
                      collapsed ? 'justify-center' : 'px-3',
                      active ? 'text-white' : 'text-slate-400 hover:text-slate-100',
                    )}
                  >
                    <Icon size={18} className={cn('shrink-0 transition-colors', active && 'text-violet-200')} />
                    {!collapsed && <span>{label}</span>}
                    {!collapsed && soon && <SoonTag />}
                  </Link>
                  {active && (
                    <motion.span layoutId="nav-active" transition={SPRING.snappy}
                      className="absolute inset-0 rounded-xl border border-violet-300/25 bg-violet-500/[0.16] shadow-[0_0_24px_-8px_rgba(139,92,246,.8)]">
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-[1px] -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_10px_2px_rgba(167,139,250,.8)]" />
                    </motion.span>
                  )}
                  {hover === href && !active && (
                    <motion.span layoutId="nav-hover" transition={SPRING.snappy} className="absolute inset-0 rounded-xl bg-white/[0.05]" />
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="mt-3 border-t border-white/[0.07] pt-3">
          <div className={cn('mb-2 flex items-center gap-1', collapsed ? 'flex-col' : '')}>
            <NotificationBell placement="top-start" />
            <Link href="/settings" aria-label="Settings" title="Settings"
              className={cn('press grid size-10 place-items-center rounded-xl hover:bg-white/[0.07]', pathname === '/settings' ? 'bg-violet-500/15 text-violet-200' : 'text-slate-300 hover:text-white')}>
              <Settings size={17} />
            </Link>
            {collapsed ? (
              <button type="button" onClick={onToggle} aria-label="Expand sidebar" className="press grid size-10 place-items-center rounded-xl text-slate-300 hover:bg-white/[0.07] hover:text-white">
                <PanelLeftOpen size={17} />
              </button>
            ) : (
              <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out" className="press ml-auto grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
                <LogOut size={16} />
              </button>
            )}
          </div>
          <div className={cn('flex items-center gap-2.5 rounded-2xl bg-white/[0.03] p-2', collapsed && 'justify-center bg-transparent p-0')}>
            <Avatar email={user.email} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-200">{user.email?.split('@')[0]}</span>
                <span className="block truncate text-[11px] text-slate-500">{user.email}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  )
}

/* ─── Mobile: top bar + floating dock + sheet ────────────────────────────── */
const DOCK: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/jobs',      icon: Briefcase,       label: 'Jobs' },
  { href: '/upload',    icon: Plus,            label: 'New' },
  { href: '/analytics', icon: BarChart2,       label: 'Stats' },
]

function MobileChrome({ user, pathname, onSignOut }: { user: User; pathname: string; onSignOut: () => void }) {
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheet])

  return (
    <>
      <header className="glass-strong sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 rounded-none border-x-0 border-t-0 px-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="ResumeAI dashboard">
          <Mark className="size-8" />
          <span className="text-[15px] font-semibold text-white">Resume<span className="text-violet-300">AI</span></span>
        </Link>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={openCommandPalette} aria-label="Search" className="press grid size-10 place-items-center rounded-xl text-slate-300 hover:bg-white/[0.07]"><Search size={17} /></button>
          <NotificationBell />
        </div>
      </header>

      {/* Dock (≤5 items) */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
        <div className="glass-strong relative flex w-full max-w-sm items-center justify-between rounded-[22px] p-1.5">
          <span aria-hidden className="edge" />
          {DOCK.map(({ href, icon: Icon, label }) => {
            const active = isActive(pathname, href)
            const primary = href === '/upload'
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} aria-label={label}
                className={cn('press relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px]', active ? 'text-white' : 'text-slate-400')}>
                {active && !primary && <motion.span layoutId="dock-active" transition={SPRING.snappy} className="absolute inset-0 rounded-2xl bg-violet-500/20" />}
                {primary ? (
                  <span className="relative grid size-10 place-items-center rounded-2xl bg-[linear-gradient(180deg,#a78bfa,#6d28d9)] text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,.9)]"><Icon size={20} /></span>
                ) : (
                  <><Icon size={19} className="relative" /><span className="relative">{label}</span></>
                )}
              </Link>
            )
          })}
          <button type="button" onClick={() => setSheet(true)} aria-label="More" aria-expanded={sheet}
            className="press relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] text-slate-400">
            <Menu size={19} /><span>More</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {sheet && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More">
            <motion.button aria-label="Close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheet(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%', transition: { duration: 0.2 } }} transition={SPRING.soft}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) setSheet(false) }}
              className="glass-strong absolute inset-x-0 bottom-0 rounded-t-[28px] p-4 pb-[max(env(safe-area-inset-bottom),20px)]"
            >
              <span aria-hidden className="edge" />
              <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
                <Avatar email={user.email} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{user.email}</span>
                <button type="button" aria-label="Close" onClick={() => setSheet(false)} className="press grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07]"><X size={17} /></button>
              </div>
              <SheetLink href="/build" icon={Wand2} label="Build resume" onClick={() => setSheet(false)} />
              <SheetLink href="/settings" icon={Settings} label="Settings" onClick={() => setSheet(false)} />
              <button type="button" onClick={onSignOut} className="press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] text-rose-300 active:bg-rose-500/10">
                <LogOut size={18} />Sign out
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function SheetLink({ href, icon: Icon, label, soon, onClick }: { href: string; icon: LucideIcon; label: string; soon?: boolean; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="press flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] text-slate-200 active:bg-white/[0.06]">
      <Icon size={18} className="text-violet-300" />{label}{soon && <SoonTag />}
    </Link>
  )
}

function SoonTag() {
  return <span className="ml-auto rounded-full border border-violet-300/20 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-violet-200">Soon</span>
}

/* ─── Shell ──────────────────────────────────────────────────────────────── */
export function AppShell({ children, user }: { children: ReactNode; user: User }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)

  // Restore the per-viewer sidebar preference (best-effort; storage may be blocked).
  useEffect(() => {
    try { if (localStorage.getItem(COLLAPSE_KEY) === '1') queueMicrotask(() => setCollapsed(true)) } catch { /* ignore */ }
  }, [])
  function toggle() {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ }
      return !c
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-ink">
      {/* Ambient light (CSS only — cheap enough for every app screen) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60">
        <div className="aurora-field aurora-static"><i /><i /><i /></div>
      </div>
      <div aria-hidden className="grid-bg opacity-60" />

      <CommandPalette />
      <Sidebar user={user} pathname={pathname} collapsed={collapsed} onToggle={toggle} onSignOut={signOut} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <MobileChrome user={user} pathname={pathname} onSignOut={signOut} />
        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
