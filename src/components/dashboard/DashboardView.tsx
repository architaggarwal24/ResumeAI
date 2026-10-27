// src/components/dashboard/DashboardView.tsx
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { DeleteResumeButton } from '@/components/resume/DeleteResumeButton'
import { BlurFade } from '@/components/ui/fx/BlurFade'
import { MiniRing } from '@/components/ui/viz/MiniRing'
import { SpotCard } from '@/components/ui/SpotCard'
import BlurText from '@/components/vendor/react-bits/BlurText'
import CountUp from '@/components/vendor/react-bits/CountUp'
import Magnet from '@/components/vendor/react-bits/Magnet'
import ShinyText from '@/components/vendor/react-bits/ShinyText'
import { AreaSparkline } from '@/components/vendor/bklit'

export interface DashboardResume {
  id: string
  name: string
  ats_score: number | null
  template_id: string
  updated_at: string
}

// Presentational dashboard. Data loading stays in app/(app)/dashboard/page.tsx.
export function DashboardView({ resumes, scoreTrend }: { resumes: DashboardResume[]; scoreTrend: number[] }) {
  const scored = resumes.filter(r => r.ats_score != null)
  const avg  = scored.length ? Math.round(scored.reduce((s, r) => s + (r.ats_score ?? 0), 0) / scored.length) : null
  const best = scored.length ? Math.round(Math.max(...scored.map(r => r.ats_score ?? 0))) : null
  const trend = scoreTrend.map((value, i) => ({ i, value }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <BlurText text="Your resumes" animateBy="words" delay={90} className="font-display text-4xl font-semibold" />
          <p className="mt-1 text-sm text-slate-400">
            {resumes.length === 0 ? 'Upload your first resume to get started.' : `${resumes.length} resume${resumes.length > 1 ? 's' : ''} · click one to open it`}
          </p>
        </div>
        <Magnet magnetStrength={5}>
          <Link href="/upload" className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-900/40 ring-1 ring-inset ring-white/15 transition-colors hover:bg-violet-500">
            <Plus size={15} />New resume
          </Link>
        </Magnet>
      </div>

      {/* Stats */}
      {resumes.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-[#111214] p-4">
            <p className="text-xs text-slate-500">Resumes</p>
            <p className="mt-1 font-display text-4xl font-semibold"><CountUp to={resumes.length} duration={1.2} /></p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#111214] p-4">
            <p className="text-xs text-slate-500">Average ATS score</p>
            <p className="mt-1 font-display text-4xl font-semibold">{avg === null ? '—' : <CountUp to={avg} duration={1.4} />}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#111214] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">Best score</p>
                <p className="mt-1 font-display text-4xl font-semibold">{best === null ? '—' : <CountUp to={best} duration={1.4} />}</p>
              </div>
              {trend.length > 1 && (
                <div className="w-24">
                  <p className="mb-1 text-right text-[10px] uppercase tracking-wider text-slate-600">Recent runs</p>
                  <AreaSparkline data={trend} dataKey="value" height={34} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {resumes.length === 0 && (
        <div className="rounded-2xl border border-white/8 bg-[#111214] p-16 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/15 ring-1 ring-inset ring-violet-400/20 shadow-[0_0_40px_-8px_rgba(60,201,174,0.5)]">
              <FileText size={30} className="text-violet-300" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold"><ShinyText text="No resumes yet" speed={4} color="#e6ebee" shineColor="#72e0c8" /></h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-slate-400">Upload a PDF and get instant section-level scoring with AI-powered suggestions.</p>
          <Link href="/upload" className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-violet-500">
            <Plus size={15} />Upload first resume
          </Link>
        </div>
      )}

      {/* Resume grid */}
      {resumes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume, i) => (
            <BlurFade key={resume.id} delay={Math.min(i, 8) * 55}>
              <SpotCard className="group relative h-full">
                <div className="mb-4 flex items-start gap-3">
                  {resume.ats_score != null ? (
                    <MiniRing score={resume.ats_score} />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-white/15" title="Not scored yet">
                      <FileText size={16} className="text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-0.5 truncate text-sm font-semibold">{resume.name}</h3>
                    <p className="text-xs text-slate-500">
                      {resume.ats_score != null ? 'ATS score' : 'Not scored yet'} · Updated {formatDate(resume.updated_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs capitalize text-slate-600">{resume.template_id} template</span>
                  <div className="relative z-10 flex items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <DeleteResumeButton resumeId={resume.id} />
                  </div>
                </div>

                <Link href={`/resume/${resume.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${resume.name}`} />
              </SpotCard>
            </BlurFade>
          ))}
        </div>
      )}
    </div>
  )
}
