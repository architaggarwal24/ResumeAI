import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BYOKCreds, ChatMessage, ResumeData } from '@/types/resume'

const CHAT_SYSTEM = `You are an expert resume coach embedded in a resume editor. You have full access to the user's resume and can give specific, actionable advice.

Rules:
- Be concise and direct — this is a chat, not an essay
- Reference specific resume content when giving advice (quote job titles, companies, exact bullets)
- When asked to rewrite something, provide the exact replacement text ready to copy-paste
- When asked what's weak, be honest and specific
- Format rewrites in a code block so they're easy to copy
- Never give generic advice like "add more metrics" — always show HOW with the actual text`

async function streamAnthropic(
  apiKey: string, model: string, system: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: 1024, stream: true, system,
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err?.error?.message ?? `Anthropic error ${res.status}`)
  }
  return res.body!
}

async function streamOpenAI(
  apiKey: string, model: string, system: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal,
  baseUrl = 'https://api.openai.com/v1/chat/completions'
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://resumeai.app' } : {}),
    },
    body: JSON.stringify({
      model, stream: true, max_tokens: 1024,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.body!
}

// Convert provider SSE → unified text stream
function toTextStream(
  provider: string,
  rawStream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              let text = ''
              if (provider === 'anthropic') {
                if (json.type === 'content_block_delta') text = json.delta?.text ?? ''
              } else {
                text = json.choices?.[0]?.delta?.content ?? ''
              }
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* malformed chunk */ }
          }
        }
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401 })

    const body = await request.json() as {
      messages: ChatMessage[]
      resumeData: ResumeData
      creds: BYOKCreds
    }

    if (!body.creds?.apiKey) return new Response('API key required', { status: 400 })

    const systemPrompt = `${CHAT_SYSTEM}

Current resume:
${JSON.stringify(body.resumeData, null, 2)}`

    const messages = body.messages.map(m => ({ role: m.role, content: m.content }))

    let rawStream: ReadableStream<Uint8Array>
    const { provider, apiKey, model } = body.creds

    switch (provider) {
      case 'anthropic':
        rawStream = await streamAnthropic(apiKey, model, systemPrompt, messages, request.signal)
        break
      case 'openai':
        rawStream = await streamOpenAI(apiKey, model, systemPrompt, messages, request.signal)
        break
      case 'openrouter':
        rawStream = await streamOpenAI(apiKey, model, systemPrompt, messages, request.signal, 'https://openrouter.ai/api/v1/chat/completions')
        break
      case 'gemini': {
        // Gemini doesn't have great streaming — fall back to non-streaming
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
              generationConfig: { maxOutputTokens: 1024 },
            }),
            signal: request.signal,
          }
        )
        const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const encoder = new TextEncoder()
        rawStream = new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close() } })
        return new Response(rawStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
      }
      default:
        return new Response('Unknown provider', { status: 400 })
    }

    const textStream = toTextStream(provider, rawStream)
    return new Response(textStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (err: unknown) {
    console.error('[POST /api/chat]', err)
    return new Response(err instanceof Error ? err.message : 'Chat failed', { status: 500 })
  }
}
