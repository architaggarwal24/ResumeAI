// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CHAT_EDIT_PROMPT } from '@/lib/llm/prompts'
import { LLMError } from '@/lib/llm/client'
import { streamLLMText, type ChatTurn } from '@/lib/llm/server'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, MAX_BODY } from '@/lib/security/guards'
import type { ResumeData } from '@/types/resume'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

const MAX_TURNS = 40
const MAX_TURN_CHARS = 8000

// Slimmer resume context for the system prompt — drops fields the coach rarely
// needs to cut tokens reprocessed on every turn.
function buildChatResumeContext(data: ResumeData) {
  return {
    name: data.name,
    summary: data.summary,
    experience: data.experience,
    skills: data.skills,
    education: data.education,
    projects: data.projects,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthedUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const limited = limit(limiters.ai, user.id)
    if (limited) return limited

    const parsed = await parseBody<{ messages?: unknown; resumeData?: unknown; creds?: unknown }>(request, MAX_BODY.ai)
    if (!parsed.ok) return parsed.response
    const body = parsed.data ?? {}

    const resume = sanitizeResumeData(body.resumeData)
    if (!resume) return NextResponse.json({ error: 'resumeData required' }, { status: 400 })

    // Roles are an allowlist: a caller must not be able to inject "system" turns.
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_TURNS) {
      return NextResponse.json({ error: 'messages must be a non-empty array (max 40)' }, { status: 400 })
    }
    const messages: ChatTurn[] = []
    for (const m of body.messages as Array<Record<string, unknown>>) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
      }
      messages.push({ role: m.role, content: m.content.slice(0, MAX_TURN_CHARS) })
    }

    const system = `${CHAT_EDIT_PROMPT}\n\nCurrent resume:\n${JSON.stringify(buildChatResumeContext(resume), null, 2)}`

    const stream = await streamLLMText({
      creds: body.creds, system, messages, signal: request.signal, maxTokens: 1536, cacheSystem: true,
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
    })
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : 502
      return new Response(err.message, { status })
    }
    console.error('[POST /api/chat]', err instanceof Error ? err.name : 'unknown')
    return new Response('Chat failed', { status: 500 })
  }
}
