import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/llm/client'
import { SCORE_PROMPT, SUGGEST_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ResumeData, AnalysisResult, ATSResult } from '@/types/resume'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeId: string
      resumeData: ResumeData
      jobDescription?: string
      creds: BYOKCreds
      type: 'score' | 'ats'
    }

    if (!body.resumeData || !body.creds?.apiKey) {
      return NextResponse.json({ error: 'resumeData and creds.apiKey are required' }, { status: 400 })
    }

    // Verify resume ownership
    if (body.resumeId) {
      const { data: resume } = await supabase
        .from('resumes')
        .select('id')
        .eq('id', body.resumeId)
        .eq('user_id', user.id)
        .single()

      if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    // ─── Score analysis ───────────────────────────────────────────────────────
    if (body.type === 'score') {
      const result = await callLLM<AnalysisResult>({
        creds: body.creds,
        systemPrompt: SCORE_PROMPT,
        userPrompt: `Score this resume:\n\n${JSON.stringify(body.resumeData, null, 2)}`,
      })

      // Save analysis to DB
      if (body.resumeId) {
        await supabase.from('analyses').insert({
          resume_id: body.resumeId,
          job_description: null,
          score: result.atsScore,
          result,
        })

        // Update resume ats_score cache
        await supabase
          .from('resumes')
          .update({ ats_score: result.atsScore })
          .eq('id', body.resumeId)

        // Increment user analyses count
        await supabase.rpc('increment_analyses_count', { user_id: user.id })
      }

      return NextResponse.json({ result })
    }

    // ─── ATS vs JD analysis ───────────────────────────────────────────────────
    if (body.type === 'ats') {
      if (!body.jobDescription) {
        return NextResponse.json({ error: 'jobDescription required for ATS analysis' }, { status: 400 })
      }

      const result = await callLLM<ATSResult>({
        creds: body.creds,
        systemPrompt: SUGGEST_PROMPT,
        userPrompt: `Job Description:\n${body.jobDescription}\n\nResume:\n${JSON.stringify(body.resumeData, null, 2)}`,
      })

      // Save ATS analysis to DB
      if (body.resumeId) {
        await supabase.from('analyses').insert({
          resume_id: body.resumeId,
          job_description: body.jobDescription,
          score: result.atsScore?.before ?? 0,
          result,
        })
      }

      return NextResponse.json({ result })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[POST /api/analyze]', err)
    const message = err instanceof Error ? err.message : 'Analysis failed'
    const status = message.includes('Invalid') && message.includes('key') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
