// src/app/(app)/jobs/page.tsx
// The job tracker is paused for now and shows a "Coming soon" screen.
// The finished board lives in ./JobBoard.tsx — to bring it back, replace this
// file's contents with:  export { default } from './JobBoard'
import { Briefcase, Clock, LayoutDashboard, Zap } from 'lucide-react'
import { GlassPanel } from '@/components/ui/glass/GlassPanel'
import { Button } from '@/components/ui/glass/Button'

export const metadata = { title: 'Job tracker — coming soon · ResumeAI' }

export default function JobsComingSoon() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center sm:px-8">
      <GlassPanel variant="subtle" className="flex w-full flex-col items-center gap-5 rounded-3xl px-6 py-12 sm:px-10">
        <span className="grid size-16 place-items-center rounded-2xl bg-violet-500/15 text-violet-200 shadow-[0_0_40px_-8px_rgba(139,92,246,.8)]">
          <Briefcase size={28} />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-violet-200">
          <Clock size={12} /> Coming soon
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Job tracker</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-400">
          Track every application on one board, tailor a resume to each posting and prep for the interview — all in one place.
          We’re finishing it up.
        </p>
        <p className="max-w-md text-xs text-slate-500">
          In the meantime, paste a job description into <span className="text-slate-300">ATS vs JD</span> on any resume to check your match.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button href="/dashboard" leading={<LayoutDashboard className="size-4" />}>Back to dashboard</Button>
          <Button href="/upload" variant="secondary" leading={<Zap className="size-4" />}>Score a resume</Button>
        </div>
      </GlassPanel>
    </div>
  )
}
