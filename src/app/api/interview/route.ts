// src/app/api/interview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/llm/client'
import { INTERVIEW_PREP_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, InterviewPrepResult } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeId: string
      jobDescription: string
      company?: string
      role?: string
      creds: BYOKCreds
    }

    if (!body.resumeId || !body.jobDescription || !body.creds?.apiKey) {
      return NextResponse.json({ error: 'resumeId, jobDescription, and creds.apiKey are required' }, { status: 400 })
    }

    // Load resume
    const { data: resume } = await supabase
      .from('resumes').select('parsed_data').eq('id', body.resumeId).eq('user_id', user.id).single()

    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const result = await callLLM<InterviewPrepResult>({
      creds: body.creds,
      cookieHeader: request.headers.get('cookie') ?? undefined,
      systemPrompt: INTERVIEW_PREP_PROMPT,
      userPrompt: `Company: ${body.company || 'Unknown'}\nRole: ${body.role || 'Unknown'}\n\nJob Description:\n${body.jobDescription}\n\nResume:\n${JSON.stringify(resume.parsed_data, null, 2)}`,
    })

    // Add checked: false to all questions if not present
    result.questions = result.questions.map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`,
      checked: false,
    }))

    return NextResponse.json({ result })
  } catch (err: unknown) {
    console.error('[POST /api/interview]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}