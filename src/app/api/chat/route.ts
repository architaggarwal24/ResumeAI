// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedOllamaUrl } from '@/lib/llm/ollama-guard'
import { CHAT_EDIT_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ChatMessage, ResumeData } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

// Build a slimmer resume context for the chat system prompt — drops fields
// the coach rarely needs (raw IDs aside from what's needed for edits, full
// certifications/awards/languages arrays) to reduce tokens reprocessed on
// every single turn of the conversation.
function buildChatResumeContext(data: ResumeData) {
  return {
    name: data.name,
    summary: data.summary,
    experience: data.experience,
    skills: data.skills,
    education: data.education,
    projects: data.projects,
    // Omit: email/phone/links/location (no editing value), certifications,
    // awards, languages (rarely discussed, can be added back if asked about)
  }
}

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
      // Prompt caching — the resume context portion of the system prompt is
      // identical across every turn of a conversation. Caching it means
      // Anthropic doesn't reprocess those tokens on every message, cutting
      // both latency and cost for multi-turn chats.
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model, max_tokens: 1536, stream: true,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
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
  const isOllama = baseUrl.includes('11434') || baseUrl.includes('ollama')
  const res = await fetch(baseUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(isOllama ? {} : { 'Authorization': `Bearer ${apiKey}` }),
      ...(baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://resumeai.app' } : {}),
    },
    body: JSON.stringify({
      model, stream: true, max_tokens: 1536,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) {
    if (isOllama) {
      const e = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(e?.error || `Ollama error ${res.status} — is the model pulled? (ollama pull ${model})`)
    }
    throw new Error(`API error ${res.status}`)
  }
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

    if (!body.creds?.provider || (body.creds.provider !== 'ollama' && !body.creds?.apiKey)) {
      return new Response('API key required', { status: 400 })
    }

    const systemPrompt = `${CHAT_EDIT_PROMPT}

Current resume:
${JSON.stringify(buildChatResumeContext(body.resumeData), null, 2)}`

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
      case 'nvidia':
        rawStream = await streamOpenAI(apiKey, model, systemPrompt, messages, request.signal, 'https://integrate.api.nvidia.com/v1/chat/completions')
        break
      case 'ollama': {
        const ollamaUrl = body.creds.baseUrl?.trim() || 'http://localhost:11434/v1/chat/completions'
        if (!isAllowedOllamaUrl(ollamaUrl)) {
          return new Response('Invalid Ollama baseUrl — only http://localhost:11434 or http://127.0.0.1:11434 are allowed', { status: 400 })
        }
        rawStream = await streamOpenAI(apiKey, model, systemPrompt, messages, request.signal, ollamaUrl)
        break
      }
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
              generationConfig: { maxOutputTokens: 1536 },
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
