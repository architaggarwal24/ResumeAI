// src/app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/llm/client'
import { COVER_LETTER_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ResumeData, CoverLetterTone } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

const TONE_INSTRUCTIONS: Record<CoverLetterTone, string> = {
  professional:  'Tone: formal, polished, confident. Appropriate for corporate/enterprise roles.',
  enthusiastic:  'Tone: warm, energetic, genuine excitement. Good for startups, creative roles.',
  concise:       'Tone: brief and punchy — aim for 200-250 words total. Get to the point fast.',
  storytelling:  'Tone: narrative-driven, use a brief specific story to open. Memorable.',
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeId: string
      resumeData: ResumeData
      jobDescription: string
      tone: CoverLetterTone
      creds: BYOKCreds
    }

    if (!body.resumeData || !body.jobDescription || !body.creds?.apiKey) {
      return NextResponse.json({ error: 'resumeData, jobDescription, and creds.apiKey required' }, { status: 400 })
    }

    const tone = body.tone || 'professional'
    const toneInstruction = TONE_INSTRUCTIONS[tone]

    const result = await callLLM<{ content: string; subjectLine: string }>({
      creds: body.creds,
      cookieHeader: request.headers.get('cookie') ?? undefined,
      systemPrompt: COVER_LETTER_PROMPT,
      userPrompt: `${toneInstruction}

Resume:
${JSON.stringify(body.resumeData, null, 2)}

Job Description:
${body.jobDescription}

Write the cover letter now.`,
    })

    // Save to DB
    let savedId: string | null = null
    if (body.resumeId) {
      const { data } = await supabase
        .from('cover_letters')
        .insert({
          resume_id: body.resumeId,
          job_description: body.jobDescription,
          tone,
          content: result.content,
        })
        .select('id')
        .single()
      savedId = data?.id ?? null
    }

    return NextResponse.json({ content: result.content, subjectLine: result.subjectLine, id: savedId })
  } catch (err: unknown) {
    console.error('[POST /api/cover-letter]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}