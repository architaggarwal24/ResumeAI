// src/app/api/interview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callLLMServer } from '@/lib/llm/server'
import { LLMError } from '@/lib/llm/client'
import { validateCreds } from '@/lib/llm/validate'
import { INTERVIEW_PREP_PROMPT } from '@/lib/llm/prompts'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, isUuid, MAX_BODY } from '@/lib/security/guards'
import type { InterviewPrepResult } from '@/types/resume'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.ai, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.ai)
    if (!parsed.ok) return parsed.response
    const raw = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    const v = validateCreds(raw.creds)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    if (!isUuid(raw.resumeId) || typeof raw.jobDescription !== 'string' || !raw.jobDescription.trim()) {
      return NextResponse.json({ error: 'resumeId and jobDescription are required' }, { status: 400 })
    }
    const company = typeof raw.company === 'string' ? raw.company.slice(0, 100) : ''
    const role    = typeof raw.role    === 'string' ? raw.role.slice(0, 100)    : ''

    // Load resume (ownership enforced by the query AND by RLS)
    const { data: resume } = await supabase
      .from('resumes').select('parsed_data').eq('id', raw.resumeId).eq('user_id', user.id).single()
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    const resumeData = sanitizeResumeData(resume.parsed_data)
    if (!resumeData) return NextResponse.json({ error: 'Stored resume is malformed' }, { status: 422 })

    const result = await callLLMServer<InterviewPrepResult>({
      creds: v.creds,
      systemPrompt: INTERVIEW_PREP_PROMPT,
      userPrompt: `Company: ${company || 'Unknown'}\nRole: ${role || 'Unknown'}\n\nJob Description:\n${raw.jobDescription.slice(0, 20_000)}\n\nResume:\n${JSON.stringify(resumeData, null, 2)}`,
    })

    if (!Array.isArray(result.questions)) {
      return NextResponse.json({ error: 'Model returned no interview questions — try again or switch models' }, { status: 422 })
    }
    // Add checked: false to all questions if not present
    result.questions = result.questions.map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`,
      checked: false,
    }))

    return NextResponse.json({ result })
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : err.code === 'timeout' ? 408 : err.code === 'parse' ? 422 : 502
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[POST /api/interview]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Interview prep failed' }, { status: 500 })
  }
}
