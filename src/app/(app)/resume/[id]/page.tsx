export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ResumeShell } from '@/components/resume/ResumeShell'

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: resume } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!resume) notFound()

  // Load most recent analysis if exists
  const { data: latestAnalysis } = await supabase
    .from('analyses')
    .select('*')
    .eq('resume_id', id)
    .is('job_description', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ResumeShell
      resume={resume}
      initialAnalysis={latestAnalysis?.result ?? null}
    />
  )
}
