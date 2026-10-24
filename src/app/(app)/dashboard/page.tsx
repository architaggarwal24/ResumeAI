// src/app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, scoreColor, cn } from '@/lib/utils'
import { FileText, Plus } from 'lucide-react'
import { DeleteResumeButton } from '@/components/resume/DeleteResumeButton'
import { SpotlightCard } from '@/components/ui/fx/SpotlightCard'
import { BlurFade } from '@/components/ui/fx/BlurFade'
import { AnimatedNumber } from '@/components/ui/fx/AnimatedNumber'
import { MiniRing } from '@/components/ui/viz/MiniRing'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: resumes } = await supabase
    .from('resumes')
    .select('id, name, ats_score, template_id, created_at, updated_at')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const list = resumes || []

  return (
    <div className="mx-auto px-4 sm:px-8 py-8 max-w-5xl fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Dashboard</h1>
          <p className="text-slate-400 text-sm">
            {list.length === 0 ? 'Upload your first resume to get started.' : `${list.length} resume${list.length > 1 ? 's' : ''} · click to open`}
          </p>
        </div>
        <Link
          href="/upload"
          className="btn-sheen inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all hover:-translate-y-px shadow-lg shadow-violet-900/40 ring-1 ring-inset ring-white/15"
        >
          <Plus size={15} />
          New Resume
        </Link>
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <div className="glass rounded-2xl p-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/15 ring-1 ring-inset ring-violet-400/20 shadow-[0_0_40px_-8px_rgba(60,201,174,0.5)]">
              <FileText size={30} className="text-violet-300" />
            </div>
          </div>
          <h3 className="font-semibold text-lg mb-2">No resumes yet</h3>
          <p className="text-slate-400 text-sm mb-6">Upload a PDF and get instant section-level scoring with AI-powered suggestions.</p>
          <Link
            href="/upload"
            className="btn-sheen inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all ring-1 ring-inset ring-white/15"
          >
            <Plus size={15} />
            Upload first resume
          </Link>
        </div>
      )}

      {/* Resume grid */}
      {list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((resume, i) => (
            <BlurFade key={resume.id} delay={Math.min(i, 8) * 55}>
            <SpotlightCard className="group relative h-full p-5">
              <div className="flex items-start gap-3 mb-4">
                {resume.ats_score != null ? (
                  <MiniRing score={resume.ats_score} />
                ) : (
                  <div className="w-11 h-11 rounded-full border border-dashed border-white/15 flex items-center justify-center shrink-0" title="Not scored yet">
                    <FileText size={16} className="text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate mb-0.5">{resume.name}</h3>
                  <p className="text-xs text-slate-500">
                    {resume.ats_score != null ? 'ATS score' : 'Not scored yet'} · Updated {formatDate(resume.updated_at)}
                  </p>
                </div>
              </div>

              {/* Template badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-600 capitalize">{resume.template_id} template</span>
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity relative z-10">
                  <DeleteResumeButton resumeId={resume.id} />
                </div>
              </div>

              {/* Full card link */}
              <Link href={`/resume/${resume.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${resume.name}`} />
            </SpotlightCard>
            </BlurFade>
          ))}
        </div>
      )}

      {/* Stats strip */}
      {list.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Resumes',  value: list.length },
            { label: 'Avg ATS Score',  value: list.filter(r => r.ats_score).length
                ? Math.round(list.reduce((s, r) => s + (r.ats_score ?? 0), 0) / list.filter(r => r.ats_score).length)
                : '—' },
            { label: 'Best Score',     value: list.filter(r => r.ats_score).length
                ? Math.round(Math.max(...list.map(r => r.ats_score ?? 0)))
                : '—' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#16181b] border border-white/7 rounded-xl p-4 text-center transition-colors hover:border-white/12">
              <p className="text-2xl font-bold font-mono mb-1">{typeof stat.value === 'number' ? <AnimatedNumber value={stat.value} initialFrom={0} /> : stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}