// src/app/api/llm/route.ts
// Thin HTTP wrapper around runLLM() for browser callers (OpenRouter and NVIDIA
// NIM block direct browser requests). Server routes call runLLM() directly.
import { NextRequest, NextResponse } from 'next/server'
import { runLLM } from '@/lib/llm/server'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, MAX_BODY } from '@/lib/security/guards'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthedUser()
    if (!user) return unauthorized()

    const limited = limit(limiters.llmProxy, user.id)
    if (limited) return limited

    const parsed = await parseBody<{
      creds?: unknown; systemPrompt?: unknown; userPrompt?: unknown; maxTokens?: unknown; temperature?: unknown
    }>(request, MAX_BODY.ai)
    if (!parsed.ok) return parsed.response
    const b = parsed.data ?? {}

    const out = await runLLM({
      creds: b.creds,
      systemPrompt: b.systemPrompt as string,
      userPrompt: b.userPrompt as string,
      maxTokens: typeof b.maxTokens === 'number' ? b.maxTokens : undefined,
      temperature: typeof b.temperature === 'number' ? b.temperature : undefined,
      signal: request.signal,
    })

    return out.ok
      ? NextResponse.json({ result: out.result })
      : NextResponse.json({ error: out.error }, { status: out.status === 499 ? 408 : out.status })
  } catch (err) {
    console.error('[/api/llm] unhandled:', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'LLM proxy failed' }, { status: 500 })
  }
}
