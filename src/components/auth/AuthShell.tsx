// src/components/auth/AuthShell.tsx
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Aurora } from '@/components/ui/fx/Aurora'

// Shared chrome for /login and /signup: aurora backdrop + glass card.
export function AuthShell({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0c0f] p-4">
      <Aurora />
      <div className="blur-in w-full max-w-sm">
        <div className="mb-7 text-center">
          <Link href="/" className="mb-4 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-500 shadow-lg shadow-violet-500/60" />
            <span className="text-xl font-bold tracking-tight">ResumeAI</span>
          </Link>
          <h1 className="mb-1 text-2xl font-bold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="glass rounded-2xl p-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  )
}
