// src/app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { DashboardView } from '@/components/dashboard/DashboardView'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: resumes } = await supabase
    .from('resumes')
    .select('id, name, ats_score, template_id, created_at, updated_at')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  // Recent analysis scores for the sparkline (RLS limits this to the user's own resumes).
  const { data: runs } = await supabase
    .from('analyses')
    .select('score, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const scoreTrend = (runs ?? []).map(r => Math.round(Number(r.score))).filter(n => Number.isFinite(n)).reverse()

  return <DashboardView resumes={resumes ?? []} scoreTrend={scoreTrend} />
}
