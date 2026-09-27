// src/app/api/mock-interview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/llm/client'
import { MOCK_INTERVIEW_SYSTEM_PROMPT, MOCK_INTERVIEW_DEBRIEF_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ResumeData, InterviewMessage, MockInterviewDebrief } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

// Streaming helper — same pattern as /api/chat
async function streamOpenAICompat(
  creds: BYOKCreds,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const urlMap: Record<string, string> = {
    openai:     'https://api.openai.com/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
    ollama:     creds.baseUrl?.trim() || 'http://localhost:11434/v1/chat/completions',
  }
  const url = urlMap[creds.provider] || urlMap.openai
  const isOllama = creds.provider === 'ollama'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!isOllama) headers['Authorization'] = `Bearer ${creds.apiKey}`
  if (creds.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://resumeai.app'; headers['X-Title'] = 'ResumeAI' }

  const res = await fetch(url, {
    method: 'POST', signal, headers,
    body: JSON.stringify({
      model: creds.model, stream: true, max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`Provider error ${res.status}`)
  return res.body!
}

// Convert SSE stream → ReadableStream of text deltas (OpenAI format)
function toTextStream(rawStream: ReadableStream<Uint8Array>, provider: string): ReadableStream<Uint8Array> {
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
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              const delta = provider === 'anthropic'
                ? json.delta?.text
                : json.choices?.[0]?.delta?.content
              if (delta) controller.enqueue(encoder.encode(delta))
            } catch { /* partial SSE line */ }
          }
        }
      } finally { controller.close() }
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeData: ResumeData
      creds: BYOKCreds
      messages: InterviewMessage[]   // full conversation history so far
      mode: 'chat' | 'debrief'
      targetRole?: string
    }

    if (!body.creds?.apiKey && body.creds?.provider !== 'ollama') {
      return NextResponse.json({ error: 'API key required' }, { status: 400 })
    }
    if (!body.resumeData) {
      return NextResponse.json({ error: 'resumeData required' }, { status: 400 })
    }

    // Build the system prompt with resume context injected
    const systemPrompt = `${MOCK_INTERVIEW_SYSTEM_PROMPT}

Candidate's resume:
${JSON.stringify(body.resumeData, null, 2)}${body.targetRole ? `\n\nTarget role: ${body.targetRole}` : ''}`

    // ── Debrief mode: generate final JSON analysis from transcript ────────────
    if (body.mode === 'debrief') {
      const transcript = body.messages
        .filter(m => m.role === 'interviewer' || m.role === 'candidate')
        .map(m => `${m.role === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`)
        .join('\n\n')

      const result = await callLLM<MockInterviewDebrief>({
        creds: body.creds,
        cookieHeader: request.headers.get('cookie') ?? undefined,
        systemPrompt: MOCK_INTERVIEW_DEBRIEF_PROMPT,
        userPrompt: `Candidate resume:\n${JSON.stringify(body.resumeData, null, 2)}\n\nFull interview transcript:\n${transcript}`,
        maxTokens: 2048,
        temperature: 0.3,
      })
      return NextResponse.json({ result })
    }

    // ── Chat mode: stream the interviewer's next response ────────────────────
    // Convert InterviewMessage[] to the openai-compat messages format
    // (system is handled separately above)
    const chatMessages = body.messages
      .filter(m => m.role === 'interviewer' || m.role === 'candidate')
      .map(m => ({
        role: m.role === 'interviewer' ? 'assistant' : 'user',
        content: m.content,
      }))

    // Handle Anthropic separately (different streaming format)
    if (body.creds.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: request.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': body.creds.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: body.creds.model, stream: true, max_tokens: 1024,
          system: systemPrompt,
          messages: chatMessages,
        }),
      })
      if (!res.ok) throw new Error(`Anthropic error ${res.status}`)
      return new NextResponse(toTextStream(res.body!, 'anthropic'), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' }
      })
    }

    // Gemini — non-streaming fallback (Gemini streaming is more complex)
    if (body.creds.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${body.creds.model}:generateContent?key=${body.creds.apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: chatMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: 1024 },
        }),
        signal: request.signal,
      })
      if (!res.ok) throw new Error(`Gemini error ${res.status}`)
      const d = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    // OpenAI / OpenRouter / NVIDIA / Ollama — streaming
    const rawStream = await streamOpenAICompat(body.creds, systemPrompt, chatMessages, request.signal)
    return new NextResponse(toTextStream(rawStream, body.creds.provider), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' }
    })

  } catch (err: unknown) {
    console.error('[POST /api/mock-interview]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Interview failed' }, { status: 500 })
  }
}