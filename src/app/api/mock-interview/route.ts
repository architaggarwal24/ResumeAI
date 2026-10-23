// src/app/api/mock-interview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MOCK_INTERVIEW_SYSTEM_PROMPT, MOCK_INTERVIEW_DEBRIEF_PROMPT } from '@/lib/llm/prompts'
import { LLMError } from '@/lib/llm/client'
import { callLLMServer, streamLLMText, type ChatTurn } from '@/lib/llm/server'
import { validateCreds } from '@/lib/llm/validate'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, MAX_BODY } from '@/lib/security/guards'
import type { BYOKCreds, MockInterviewDebrief } from '@/types/resume'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

const MAX_TURNS = 60
const MAX_TURN_CHARS = 8000

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.ai, user.id)
    if (limited) return limited

    const parsed = await parseBody<{
      resumeData?: unknown; creds?: unknown; messages?: unknown; mode?: unknown; targetRole?: unknown
    }>(request, MAX_BODY.ai)
    if (!parsed.ok) return parsed.response
    const body = parsed.data ?? {}

    const v = validateCreds(body.creds)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const creds: BYOKCreds = v.creds

    const resume = sanitizeResumeData(body.resumeData)
    if (!resume) return NextResponse.json({ error: 'resumeData required' }, { status: 400 })

    if (!Array.isArray(body.messages) || body.messages.length > MAX_TURNS) {
      return NextResponse.json({ error: 'messages must be an array (max 60)' }, { status: 400 })
    }
    // Only interviewer/candidate turns are accepted — nothing a caller sends can become a "system" turn.
    const turns = (body.messages as Array<Record<string, unknown>>)
      .filter(m => m && (m.role === 'interviewer' || m.role === 'candidate') && typeof m.content === 'string')
      .map(m => ({ role: m.role as 'interviewer' | 'candidate', content: (m.content as string).slice(0, MAX_TURN_CHARS) }))

    const targetRole = typeof body.targetRole === 'string' ? body.targetRole.slice(0, 200) : ''
    const systemPrompt = `${MOCK_INTERVIEW_SYSTEM_PROMPT}\n\nCandidate's resume:\n${JSON.stringify(resume, null, 2)}${targetRole ? `\n\nTarget role: ${targetRole}` : ''}`

    // ── Debrief mode: final JSON analysis from the transcript ────────────────
    if (body.mode === 'debrief') {
      const transcript = turns
        .map(m => `${m.role === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`)
        .join('\n\n')

      const result = await callLLMServer<MockInterviewDebrief>({
        creds,
        systemPrompt: MOCK_INTERVIEW_DEBRIEF_PROMPT,
        userPrompt: `Candidate resume:\n${JSON.stringify(resume, null, 2)}\n\nFull interview transcript:\n${transcript}`,
        maxTokens: 2048,
        temperature: 0.3,
      })
      return NextResponse.json({ result })
    }

    // ── Chat mode: stream the interviewer's next response ────────────────────
    const chatMessages: ChatTurn[] = turns.map(m => ({
      role: m.role === 'interviewer' ? 'assistant' : 'user',
      content: m.content,
    }))
    // The interview opens with an empty history; providers (Anthropic in particular)
    // require at least one user turn, so seed one.
    if (chatMessages.length === 0) {
      chatMessages.push({ role: 'user', content: 'Please begin the interview.' })
    }

    const stream = await streamLLMText({
      creds, system: systemPrompt, messages: chatMessages, signal: request.signal, maxTokens: 1024,
    })
    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
    })
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : 502
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[POST /api/mock-interview]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Interview failed' }, { status: 500 })
  }
}
