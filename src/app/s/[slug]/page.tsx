import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { renderFullHTML } from '@/lib/templates/render'
import { SharePasswordGate } from '@/components/resume/SharePasswordGate'
import type { ResumeData, TemplateId } from '@/types/resume'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export default async function SharePage({ params }: Props) {
  const { slug } = await params

  // Use service-role-like anon client — no auth needed for public shares
  const supabase = await createClient()

  const { data: share } = await supabase
    .from('resume_shares')
    .select('*, resumes(parsed_data, template_id, name)')
    .eq('slug', slug)
    .single()

  if (!share) notFound()

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold mb-2 text-slate-200">Link Expired</h1>
          <p className="text-slate-400 text-sm">This resume share link has expired.</p>
        </div>
      </div>
    )
  }

  // Increment view count (fire-and-forget)
  supabase
    .from('resume_shares')
    .update({ view_count: (share.view_count ?? 0) + 1 })
    .eq('slug', slug)
    .then(() => {})

  // Password protected — show gate
  if (share.password_hash) {
    return <SharePasswordGate slug={slug} passwordHash={share.password_hash} share={share} />
  }

  const resume = share.resumes as unknown as { parsed_data: ResumeData; template_id: TemplateId; name: string }
  const html   = renderFullHTML(resume.template_id ?? 'classic', resume.parsed_data)

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Minimal header bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-sm font-semibold text-gray-700">ResumeAI</span>
          <span className="text-xs text-gray-400">· Shared Resume</span>
        </div>
        <div className="flex items-center gap-3">
          {resume.name && <span className="text-sm text-gray-500">{resume.name}</span>}
          <button
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Resume content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-10 print:shadow-none print:rounded-none print:p-0">
          <div dangerouslySetInnerHTML={{ __html: html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '') }} />
        </div>
      </div>

      <style>{`@media print { .sticky { display: none } .max-w-4xl { max-width: none; padding: 0 } .bg-white { box-shadow: none; border-radius: 0 } }`}</style>
    </div>
  )
}
