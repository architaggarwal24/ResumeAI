// src/app/api/resume/tailor/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callLLMServer } from '@/lib/llm/server'
import { LLMError } from '@/lib/llm/client'
import { validateCreds } from '@/lib/llm/validate'
import { TAILOR_PROMPT } from '@/lib/llm/prompts'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, isUuid, MAX_BODY } from '@/lib/security/guards'

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
    const jobDescription = raw.jobDescription.slice(0, 20_000)
    const company  = typeof raw.company  === 'string' ? raw.company.trim().slice(0, 100)  : ''
    const jobTitle = typeof raw.jobTitle === 'string' ? raw.jobTitle.trim().slice(0, 100) : ''
    const jobApplicationId = isUuid(raw.jobApplicationId) ? raw.jobApplicationId : null

    // Load source resume (ownership enforced by the query AND by RLS)
    const { data: source } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', raw.resumeId)
      .eq('user_id', user.id)
      .single()

    if (!source) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const sourceData = sanitizeResumeData(source.parsed_data)
    if (!sourceData) return NextResponse.json({ error: 'Stored resume is malformed' }, { status: 422 })

    // Tailor with LLM
    const tailoredRaw = await callLLMServer<Record<string, unknown>>({
      creds: v.creds,
      systemPrompt: TAILOR_PROMPT,
      userPrompt: `Job Description:\n${jobDescription}\n\nBase Resume:\n${JSON.stringify(sourceData, null, 2)}`,
    })
    // Model output is untrusted (a hostile job posting can steer it): normalise before storing.
    const tailored = sanitizeResumeData(tailoredRaw)
    if (!tailored) return NextResponse.json({ error: 'Model returned an unusable resume' }, { status: 422 })

    const suffix = company ? ` — ${company}` : jobTitle ? ` — ${jobTitle}` : ' (Tailored)'
    const tailoredName = `${String(source.name ?? 'Resume')}${suffix}`.slice(0, 200)

    // Snapshot the source resume before tailoring (non-critical)
    await supabase.from('resume_versions').insert({
      resume_id: source.id,
      label: `Before tailoring for ${company || jobTitle || 'job'}`.slice(0, 200),
      parsed_data: sourceData,
      ats_score: source.ats_score,
    })

    // Save as new resume
    const { data: newResume, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        name: tailoredName,
        raw_text: source.raw_text,
        parsed_data: tailored,
        template_id: source.template_id,
      })
      .select()
      .single()

    if (error) throw error

    // Link to job application if provided (scoped to this user)
    if (jobApplicationId) {
      await supabase
        .from('job_applications')
        .update({ resume_id: newResume.id })
        .eq('id', jobApplicationId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ resume: newResume, tailoredName }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : err.code === 'timeout' ? 408 : err.code === 'parse' ? 422 : 502
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[POST /api/resume/tailor]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Tailoring failed' }, { status: 500 })
  }
}
