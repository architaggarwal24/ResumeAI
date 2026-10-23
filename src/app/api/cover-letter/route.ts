// src/app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callLLMServer } from '@/lib/llm/server'
import { LLMError } from '@/lib/llm/client'
import { validateCreds } from '@/lib/llm/validate'
import { COVER_LETTER_PROMPT } from '@/lib/llm/prompts'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, isUuid, MAX_BODY } from '@/lib/security/guards'
import type { CoverLetterTone } from '@/types/resume'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

const TONE_INSTRUCTIONS: Record<CoverLetterTone, string> = {
  professional:  'Tone: formal, polished, confident. Appropriate for corporate/enterprise roles.',
  enthusiastic:  'Tone: warm, energetic, genuine excitement. Good for startups, creative roles.',
  concise:       'Tone: brief and punchy — aim for 200-250 words total. Get to the point fast.',
  storytelling:  'Tone: narrative-driven, use a brief specific story to open. Memorable.',
}

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
    const resumeData = sanitizeResumeData(raw.resumeData)
    if (!resumeData || typeof raw.jobDescription !== 'string' || !raw.jobDescription.trim()) {
      return NextResponse.json({ error: 'resumeData and jobDescription required' }, { status: 400 })
    }
    const jobDescription = raw.jobDescription.slice(0, 20_000)

    // Tone is an allowlist (previously an unknown tone injected the literal "undefined" into the prompt).
    const tone: CoverLetterTone = typeof raw.tone === 'string' && Object.hasOwn(TONE_INSTRUCTIONS, raw.tone)
      ? raw.tone as CoverLetterTone : 'professional'

    const result = await callLLMServer<{ content: string; subjectLine: string }>({
      creds: v.creds,
      systemPrompt: COVER_LETTER_PROMPT,
      userPrompt: `${TONE_INSTRUCTIONS[tone]}\n\nResume:\n${JSON.stringify(resumeData, null, 2)}\n\nJob Description:\n${jobDescription}\n\nWrite the cover letter now.`,
    })
    if (typeof result.content !== 'string' || !result.content.trim()) {
      return NextResponse.json({ error: 'Model returned an empty cover letter — try again' }, { status: 422 })
    }
    const subjectLine = typeof result.subjectLine === 'string' ? result.subjectLine.slice(0, 300) : ''

    // Save to DB — only against a resume this user owns
    let savedId: string | null = null
    if (isUuid(raw.resumeId)) {
      const { data: owned } = await supabase
        .from('resumes').select('id').eq('id', raw.resumeId).eq('user_id', user.id).single()
      if (owned) {
        const { data } = await supabase
          .from('cover_letters')
          .insert({ resume_id: raw.resumeId, job_description: jobDescription, tone, content: result.content.slice(0, 20_000) })
          .select('id')
          .single()
        savedId = data?.id ?? null
      }
    }

    return NextResponse.json({ content: result.content, subjectLine, id: savedId })
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : err.code === 'timeout' ? 408 : err.code === 'parse' ? 422 : 502
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[POST /api/cover-letter]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Cover letter failed' }, { status: 500 })
  }
}
