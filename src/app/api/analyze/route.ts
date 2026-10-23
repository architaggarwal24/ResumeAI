// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateCreds } from '@/lib/llm/validate'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, isUuid, MAX_BODY } from '@/lib/security/guards'
import { callLLMServer } from '@/lib/llm/server'
import { LLMError } from '@/lib/llm/client'
import { SCORE_CORE_PROMPT, SCORE_ENRICHMENT_PROMPT, SUGGEST_PROMPT, POINTER_SUGGEST_PROMPT, GENERATE_SECTION_PROMPT, IMPROVE_SECTION_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ResumeData, AnalysisResult, ATSResult, PointerSuggestionResult, GenerateSectionResult, GeneratableSection, SectionImproveResult } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

// Compute overall ATS score as a weighted sum of section scores.
// This eliminates the separate verdict call and makes atsScore mathematically
// consistent with the section scores the model already produced.
// Weights reflect typical ATS and recruiter priorities:
//   experience 35% — most heavily screened for employer history
//   skills     25% — keyword matching
//   projects   20% — especially important for early-career/SWE resumes
//   summary    10%
//   education  10%
function computeAtsScore(sections: AnalysisResult['sections']): number {
  const w = { experience: 0.35, skills: 0.25, projects: 0.20, summary: 0.10, education: 0.10 }
  const keys = Object.keys(w) as Array<keyof typeof w>
  let score = 0
  let totalWeight = 0
  for (const k of keys) {
    const s = sections?.[k]
    if (s && typeof s.score === 'number') {
      score += s.score * w[k]
      totalWeight += w[k]
    }
  }
  if (totalWeight === 0) return 0
  // Normalise in case not all sections were returned
  const raw = score / totalWeight
  // Round to nearest integer but avoid multiples of 5 unless genuinely landed there
  const rounded = Math.round(raw)
  return rounded
}

// Validate and clamp section scores — prevents hallucinated values like 110
// or enum mismatches like "excellent" from breaking the UI.
function validateSections(sections: AnalysisResult['sections'] | undefined): AnalysisResult['sections'] {
  const validStrengths = new Set(['strong', 'ok', 'weak'])
  const fallback = { strength: 'ok' as const, score: 50, reasons: [], quickFix: null }
  const sectionKeys: Array<keyof AnalysisResult['sections']> = ['summary', 'experience', 'skills', 'education', 'projects']
  const result: Partial<AnalysisResult['sections']> = {}
  for (const k of sectionKeys) {
    const s = sections?.[k] ?? fallback
    const score = Math.max(0, Math.min(100, Math.round(typeof s.score === 'number' ? s.score : 50)))
    const strength: 'strong' | 'ok' | 'weak' = validStrengths.has(s.strength) ? (s.strength as 'strong' | 'ok' | 'weak') :
      score >= 70 ? 'strong' : score >= 45 ? 'ok' : 'weak'
    result[k] = {
      strength,
      score,
      reasons: Array.isArray(s.reasons) ? s.reasons.filter(r => typeof r === 'string') : [],
      quickFix: typeof s.quickFix === 'string' ? s.quickFix : null,
    }
  }
  return result as AnalysisResult['sections']
}

// Safely coerce an unknown value to string[]
function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.filter(v => typeof v === 'string')
}

// Minimal safe verdict when the model doesn't return one
function fallbackVerdict(): AnalysisResult['recruiterVerdict'] {
  return { verdict: 'maybe', headline: 'Analysis complete — see section scores for details.', strengths: [], gaps: [] }
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

    // Everything below is untrusted browser input: validate shape and bound sizes.
    const v = validateCreds(raw.creds)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const resumeData = sanitizeResumeData(raw.resumeData)
    if (!resumeData) return NextResponse.json({ error: 'resumeData is required' }, { status: 400 })

    const TYPES = ['score', 'ats', 'pointer', 'generate_section', 'improve_section'] as const
    const SECTIONS = ['summary', 'experience', 'education', 'projects', 'skills'] as const
    const rawPointer = (raw.pointer && typeof raw.pointer === 'object' ? raw.pointer : null) as Record<string, unknown> | null

    const body = {
      type: (TYPES as readonly unknown[]).includes(raw.type) ? raw.type as typeof TYPES[number] : undefined,
      resumeId: isUuid(raw.resumeId) ? raw.resumeId : undefined,
      resumeData,
      creds: v.creds as BYOKCreds,
      jobDescription: typeof raw.jobDescription === 'string' && raw.jobDescription.trim() ? raw.jobDescription.slice(0, 20_000) : undefined,
      section: (SECTIONS as readonly unknown[]).includes(raw.section) ? raw.section as GeneratableSection : undefined,
      pointer: rawPointer && typeof rawPointer.targetId === 'string' && typeof rawPointer.currentText === 'string'
        ? {
            targetId: rawPointer.targetId.slice(0, 64),
            currentText: rawPointer.currentText.slice(0, 2000),
            sectionContext: typeof rawPointer.sectionContext === 'string' ? rawPointer.sectionContext.slice(0, 100) : '',
          }
        : undefined,
    }

    // A supplied resumeId must be a well-formed UUID that this user owns.
    if (raw.resumeId !== undefined && raw.resumeId !== null && raw.resumeId !== '' && !body.resumeId) {
      return NextResponse.json({ error: 'Invalid resumeId' }, { status: 400 })
    }
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
      const resumeFull = JSON.stringify(body.resumeData, null, 2)
      const resumeBlock = `Score this resume:\n\n${resumeFull}`

      // Call 1 (required): section scores + recruiter verdict. This is the
      // smaller, critical call — atsScore is computed server-side from the
      // section scores it returns, so it's always mathematically consistent
      // and never a hallucinated guess.
      const coreResult = await callLLMServer<Pick<AnalysisResult, 'sections' | 'recruiterVerdict'>>({
        creds: body.creds,
        systemPrompt: SCORE_CORE_PROMPT,
        userPrompt: resumeBlock,
        maxTokens: 2560,
        temperature: 0.4,
      })

      const validatedSections = validateSections(coreResult.sections)

      const result: AnalysisResult = {
        atsScore:          computeAtsScore(validatedSections),
        recruiterVerdict:  coreResult.recruiterVerdict ?? fallbackVerdict(),
        sections:          validatedSections,
        missingKeywords:   [],
        topWins:           [],
        topFixes:          [],
        buzzwordsToRemove: [],
        trendingSkills:    [],
      }

      // Call 2 (optional): supplementary insights — top fixes, buzzwords,
      // trending skills, missing keywords. This is genuinely extra content
      // (the Insights accordion), not needed for the score itself, so if it
      // fails or times out we still return a fully usable result from call 1
      // rather than failing the whole analysis.
      try {
        const enrichment = await callLLMServer<Pick<AnalysisResult,
          'missingKeywords' | 'topWins' | 'topFixes' | 'buzzwordsToRemove' | 'trendingSkills'
        >>({
          creds: body.creds,
          systemPrompt: SCORE_ENRICHMENT_PROMPT,
          userPrompt: resumeBlock,
          maxTokens: 2048,
          temperature: 0.4,
        })
        result.missingKeywords   = asStringArray(enrichment.missingKeywords)
        result.topWins           = asStringArray(enrichment.topWins)
        result.topFixes          = Array.isArray(enrichment.topFixes) ? enrichment.topFixes : []
        result.buzzwordsToRemove = asStringArray(enrichment.buzzwordsToRemove)
        result.trendingSkills    = asStringArray(enrichment.trendingSkills)
      } catch (enrichErr) {
        console.error('[POST /api/analyze] Enrichment call failed (non-fatal):', enrichErr)
        // result already has safe empty-array defaults — analysis still succeeds
      }

      // Save analysis to DB
      if (body.resumeId) {
        await supabase.from('analyses').insert({
          resume_id: body.resumeId,
          job_description: null,
          score: result.atsScore,
          result,
        })
        await supabase
          .from('resumes')
          .update({ ats_score: result.atsScore })
          .eq('id', body.resumeId)
        const { error: countErr } = await supabase.rpc('increment_analyses_count')
        if (countErr) console.error('[POST /api/analyze] increment_analyses_count:', countErr.code)
      }

      return NextResponse.json({ result })
    }

    // ─── ATS vs JD analysis ───────────────────────────────────────────────────
    if (body.type === 'ats') {
      if (!body.jobDescription) {
        return NextResponse.json({ error: 'jobDescription required for ATS analysis' }, { status: 400 })
      }

      const result = await callLLMServer<ATSResult>({
        creds: body.creds,
        systemPrompt: SUGGEST_PROMPT,
        userPrompt: `Job Description:\n${body.jobDescription}\n\nResume:\n${JSON.stringify(body.resumeData, null, 2)}`,
        maxTokens: 3072,
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

    // ─── Single-pointer suggestion (Score tab — per-bullet) ──────────────────
    if (body.type === 'pointer') {
      if (!body.pointer?.targetId || body.pointer.currentText == null) {
        return NextResponse.json({ error: 'pointer.targetId and pointer.currentText are required' }, { status: 400 })
      }

      const jdBlock = body.jobDescription
        ? `\n\nTarget job description (for keyword alignment):\n${body.jobDescription.slice(0, 800)}`
        : ''

      // Send only what's needed for one-line rewriting:
      // - The section the bullet belongs to (for tone/context)
      // - Skills (for keyword consistency — don't add tech not already on the resume)
      // - The summary (for positioning context)
      // Omit full experience/projects/education — they're not needed to rewrite one line
      // and bloat the prompt for weaker models.
      const minimalContext = {
        name: body.resumeData.name,
        targetSection: body.pointer.sectionContext,
        summary: body.resumeData.summary,
        skills: body.resumeData.skills,
      }

      const result = await callLLMServer<PointerSuggestionResult>({
        creds: body.creds,
        systemPrompt: POINTER_SUGGEST_PROMPT,
        userPrompt: `Resume context:\n${JSON.stringify(minimalContext, null, 2)}${jdBlock}\n\nLine to improve:\n"${body.pointer.currentText}"`,
        maxTokens: 512,
        temperature: 0.3,
      })

      // Validate the result — ensure suggested is a non-empty string
      if (!result.suggested?.trim()) {
        return NextResponse.json({ error: 'Model returned an empty suggestion — try re-suggesting' }, { status: 422 })
      }

      return NextResponse.json({ result })
    }

    // ─── Generate empty section (Score tab — "Generate this section") ────────
    if (body.type === 'generate_section') {
      if (!body.section) {
        return NextResponse.json({ error: 'section is required' }, { status: 400 })
      }

      const jdBlock = body.jobDescription
        ? `\n\nTarget job description (use for positioning/keywords):\n${body.jobDescription}`
        : ''

      const result = await callLLMServer<GenerateSectionResult>({
        creds: body.creds,
        systemPrompt: GENERATE_SECTION_PROMPT,
        userPrompt: `Full resume (for context):\n${JSON.stringify(body.resumeData, null, 2)}${jdBlock}\n\nGenerate content for the "${body.section}" section, which is currently empty or near-empty.`,
        maxTokens: 2048,
        // Low temperature — this is a fact-grounded generation task where
        // hallucination (inventing employers/dates/metrics) is the primary
        // risk, not repetitive output. Lower temp keeps it closer to what's
        // actually implied by the resume.
        temperature: 0.2,
      })

      return NextResponse.json({ result })
    }

    // ─── Improve existing section (Score tab — Skills/Education, any strength) ─
    if (body.type === 'improve_section') {
      if (body.section !== 'skills' && body.section !== 'education') {
        return NextResponse.json({ error: 'section must be "skills" or "education"' }, { status: 400 })
      }

      const jdBlock = body.jobDescription
        ? `\n\nTarget job description (use for keyword alignment):\n${body.jobDescription}`
        : ''

      const result = await callLLMServer<SectionImproveResult>({
        creds: body.creds,
        systemPrompt: IMPROVE_SECTION_PROMPT,
        userPrompt: `Full resume (for context):\n${JSON.stringify(body.resumeData, null, 2)}${jdBlock}\n\nImprove the "${body.section}" section.`,
        maxTokens: 2048,
        temperature: 0.2,
      })

      return NextResponse.json({ result })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err: unknown) {
    // LLMError messages are safe to show (provider/model guidance). Anything else stays server-side.
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : err.code === 'timeout' ? 408 : err.code === 'parse' ? 422 : 502
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[POST /api/analyze]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
