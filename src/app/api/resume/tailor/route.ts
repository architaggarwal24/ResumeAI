// src/app/api/resume/tailor/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/llm/client'
import { TAILOR_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ResumeData } from '@/types/resume'

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
      jobTitle?: string
      company?: string
      jobApplicationId?: string
      creds: BYOKCreds
    }

    if (!body.resumeId || !body.jobDescription || !body.creds?.apiKey) {
      return NextResponse.json({ error: 'resumeId, jobDescription, and creds.apiKey are required' }, { status: 400 })
    }

    // Load source resume
    const { data: source } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', body.resumeId)
      .eq('user_id', user.id)
      .single()

    if (!source) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    // Tailor with LLM
    const tailored = await callLLM<ResumeData>({
      creds: body.creds,
      cookieHeader: request.headers.get('cookie') ?? undefined,
      systemPrompt: TAILOR_PROMPT,
      userPrompt: `Job Description:\n${body.jobDescription}\n\nBase Resume:\n${JSON.stringify(source.parsed_data, null, 2)}`,
    })

    // Build name for the tailored clone
    const suffix = body.company
      ? ` — ${body.company}`
      : body.jobTitle
      ? ` — ${body.jobTitle}`
      : ' (Tailored)'
    const tailoredName = `${source.name}${suffix}`

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

    // Link to job application if provided
    if (body.jobApplicationId) {
      await supabase
        .from('job_applications')
        .update({ resume_id: newResume.id })
        .eq('id', body.jobApplicationId)
        .eq('user_id', user.id)
    }

    // Snapshot the source resume before tailoring
    try {
      await supabase.from('resume_versions').insert({
        resume_id: source.id,
        label: `Before tailoring for ${body.company || body.jobTitle || 'job'}`,
        parsed_data: source.parsed_data,
        ats_score: source.ats_score,
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ resume: newResume, tailoredName }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/resume/tailor]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Tailoring failed' }, { status: 500 })
  }
}