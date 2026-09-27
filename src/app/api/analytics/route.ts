// src/app/api/analytics/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AnalyticsDashboard, ResumeAnalyticsSummary, ScoreDataPoint } from '@/types/resume'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch all resumes
    const { data: resumes } = await supabase
      .from('resumes')
      .select('id, name, ats_score')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (!resumes?.length) {
      return NextResponse.json({
        totalAnalyses: 0, totalResumes: 0, avgScore: null,
        bestScore: null, mostImproved: null, resumes: [],
      } satisfies AnalyticsDashboard)
    }

    const resumeIds = resumes.map(r => r.id)

    // Fetch all analyses for these resumes (score-only, no JD)
    const { data: analyses } = await supabase
      .from('analyses')
      .select('id, resume_id, score, created_at')
      .in('resume_id', resumeIds)
      .is('job_description', null)
      .order('created_at', { ascending: true })

    const allAnalyses = analyses ?? []

    // Build per-resume summaries
    const summaries: ResumeAnalyticsSummary[] = resumes.map(resume => {
      const history = allAnalyses.filter(a => a.resume_id === resume.id)

      const scoreHistory: ScoreDataPoint[] = history.map(a => ({
        date: a.created_at,
        score: Math.round(a.score),
        label: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        analysisId: a.id,
      }))

      const scores = scoreHistory.map(s => s.score)
      const firstScore = scores[0] ?? null
      const currentScore = resume.ats_score != null ? Math.round(resume.ats_score) : (scores[scores.length - 1] ?? null)
      const peakScore = scores.length ? Math.max(...scores) : null
      const improvement = firstScore != null && currentScore != null ? currentScore - firstScore : null

      return {
        resumeId: resume.id,
        resumeName: resume.name,
        currentScore,
        peakScore,
        firstScore,
        totalAnalyses: history.length,
        improvement,
        scoreHistory,
      }
    })

    // Aggregate stats
    const totalAnalyses = allAnalyses.length
    const scored = summaries.filter(s => s.currentScore != null)
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, s) => sum + (s.currentScore ?? 0), 0) / scored.length)
      : null
    const bestScore = scored.length ? Math.max(...scored.map(s => s.currentScore ?? 0)) : null

    const improved = summaries.filter(s => s.improvement != null && s.improvement > 0)
    const mostImproved = improved.length
      ? improved.reduce((best, s) => (s.improvement ?? 0) > (best.improvement ?? 0) ? s : best)
      : null

    return NextResponse.json({
      totalAnalyses,
      totalResumes: resumes.length,
      avgScore,
      bestScore,
      mostImproved: mostImproved
        ? { resumeId: mostImproved.resumeId, resumeName: mostImproved.resumeName, improvement: mostImproved.improvement! }
        : null,
      resumes: summaries,
    } satisfies AnalyticsDashboard)
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
