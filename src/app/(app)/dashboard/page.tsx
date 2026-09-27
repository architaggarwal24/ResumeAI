// src/app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, scoreColor, cn } from '@/lib/utils'
import { FileText, Plus } from 'lucide-react'
import { DeleteResumeButton } from '@/components/resume/DeleteResumeButton'

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
    <div className="mx-auto px-8 py-8 max-w-5xl fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Dashboard</h1>
          <p className="text-slate-400 text-sm">
            {list.length === 0 ? 'Upload your first resume to get started.' : `${list.length} resume${list.length > 1 ? 's' : ''} · click to open`}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all hover:-translate-y-px shadow-lg shadow-violet-900/30"
        >
          <Plus size={15} />
          New Resume
        </Link>
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <div className="border-2 border-dashed border-white/10 rounded-2xl p-16 text-center">
          <div className="flex justify-center mb-4 text-slate-600">
            <FileText size={48} />
          </div>
          <h3 className="font-semibold text-lg mb-2">No resumes yet</h3>
          <p className="text-slate-400 text-sm mb-6">Upload a PDF and get instant section-level scoring with AI-powered suggestions.</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            <Plus size={15} />
            Upload first resume
          </Link>
        </div>
      )}

      {/* Resume grid */}
      {list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(resume => (
            <div key={resume.id} className="group relative bg-[#16161d] border border-white/7 rounded-xl p-5 hover:border-white/15 transition-all hover:shadow-lg hover:shadow-black/20">
              {/* Score badge */}
              {resume.ats_score != null && (
                <div className={cn(
                  'absolute top-4 right-4 font-mono text-sm font-bold',
                  scoreColor(resume.ats_score)
                )}>
                  {Math.round(resume.ats_score)}
                </div>
              )}

              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="font-semibold text-sm truncate mb-0.5">{resume.name}</h3>
                  <p className="text-xs text-slate-500">Updated {formatDate(resume.updated_at)}</p>
                </div>
              </div>

              {/* Score bar */}
              {resume.ats_score != null && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">ATS Score</span>
                    <span className={cn('text-xs font-mono font-semibold', scoreColor(resume.ats_score))}>
                      {Math.round(resume.ats_score)}/100
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${resume.ats_score}%`,
                        background: resume.ats_score >= 70 ? '#34d399' : resume.ats_score >= 45 ? '#fbbf24' : '#f87171'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Template badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-600 capitalize">{resume.template_id} template</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                  <DeleteResumeButton resumeId={resume.id} />
                </div>
              </div>

              {/* Full card link */}
              <Link href={`/resume/${resume.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${resume.name}`} />
            </div>
          ))}
        </div>
      )}

      {/* Stats strip */}
      {list.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: 'Total Resumes',  value: list.length },
            { label: 'Avg ATS Score',  value: list.filter(r => r.ats_score).length
                ? Math.round(list.reduce((s, r) => s + (r.ats_score ?? 0), 0) / list.filter(r => r.ats_score).length)
                : '—' },
            { label: 'Best Score',     value: list.filter(r => r.ats_score).length
                ? Math.round(Math.max(...list.map(r => r.ats_score ?? 0)))
                : '—' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#16161d] border border-white/7 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-mono mb-1">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}