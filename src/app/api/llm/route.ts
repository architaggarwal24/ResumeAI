// src/app/api/llm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedOllamaUrl } from '@/lib/llm/ollama-guard'
import type { BYOKCreds } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

const PROVIDER_URLS: Record<string, string> = {
  anthropic:  'https://api.anthropic.com/v1/messages',
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
  ollama:     'http://localhost:11434/v1/chat/completions',
}

// Models known to use extended reasoning — these get temperature=0 forced
// regardless of what the caller requests, since most reasoning model APIs
// either reject non-zero temp or produce unstable output with it.
const REASONING_MODEL_PATTERNS = [
  'deepseek-r1', 'deepseek-v4', 'kimi-k2', 'nemotron-3-ultra',
  'o1', 'o3', '-r1', ':thinking',
]
function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase()
  return REASONING_MODEL_PATTERNS.some(p => m.includes(p))
}

// Extract text content from an OpenAI-compat response, handling reasoning
// models that return content in non-standard fields.
function extractContent(d: Record<string, unknown>): string {
  const choices = d.choices as Array<Record<string, unknown>> | undefined
  if (!choices?.length) return ''
  const msg = choices[0].message as Record<string, unknown> | undefined
  if (!msg) return ''

  // Standard field
  const content = typeof msg.content === 'string' ? msg.content.trim() : ''
  if (content) return content

  // Some OpenRouter reasoning models put output here instead
  const reasoning = typeof msg.reasoning_content === 'string' ? msg.reasoning_content.trim() : ''
  if (reasoning) return reasoning

  // DeepSeek R1 via some providers wraps it in reasoning field
  const r = msg.reasoning as string | undefined
  if (r?.trim()) return r.trim()

  return ''
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      creds: BYOKCreds
      systemPrompt: string
      userPrompt: string
      maxTokens?: number
      temperature?: number
    }
    const { creds, systemPrompt, userPrompt } = body
    const maxTokens = body.maxTokens ?? 4096

    // Reasoning models don't support non-zero temperature on most providers
    const reasoning = isReasoningModel(creds.model)
    const temperature = reasoning ? 0 : (body.temperature ?? 0)

    if (!creds?.provider || (creds.provider !== 'ollama' && !creds?.apiKey)) {
      return NextResponse.json({ error: 'Missing creds' }, { status: 400 })
    }

    // Prepend strict JSON instruction. For Nemotron-family models /no_think
    // disables extended chain-of-thought; it's a harmless no-op elsewhere.
    const noThinkPrefix = creds.provider === 'nvidia' ? '/no_think\n' : ''
    const strictSystem = `${noThinkPrefix}IMPORTANT: Return ONLY valid JSON. No explanations, no markdown fences, no <think> tags, no preamble. Start your response with { and end with }.

${systemPrompt}`

    let rawText = ''

    // ── Anthropic ────────────────────────────────────────────────────────────
    if (creds.provider === 'anthropic') {
      const res = await fetch(PROVIDER_URLS.anthropic, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: creds.model, max_tokens: maxTokens, temperature, system: strictSystem, messages: [{ role: 'user', content: userPrompt }] }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        return NextResponse.json({ error: e?.error?.message || `Anthropic ${res.status}` }, { status: res.status })
      }
      const d = await res.json() as { content: Array<{ text: string }> }
      rawText = d.content?.[0]?.text || ''
    }

    // ── Gemini ───────────────────────────────────────────────────────────────
    else if (creds.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${creds.model}:generateContent?key=${creds.apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: strictSystem }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        return NextResponse.json({ error: e?.error?.message || `Gemini ${res.status}` }, { status: res.status })
      }
      const d = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
      rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }

    // ── OpenAI / OpenRouter / NVIDIA / Ollama (OpenAI-compat) ────────────────
    else {
      const isOllama = creds.provider === 'ollama'
      const url = isOllama
        ? (creds.baseUrl?.trim() || PROVIDER_URLS.ollama)
        : (PROVIDER_URLS[creds.provider] || PROVIDER_URLS.openai)

      if (isOllama && !isAllowedOllamaUrl(url)) {
        return NextResponse.json({
          error: 'Invalid Ollama baseUrl — only http://localhost:11434 or http://127.0.0.1:11434 are allowed'
        }, { status: 400 })
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!isOllama) headers['Authorization'] = `Bearer ${creds.apiKey}`
      if (creds.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://resumeai.app'
        headers['X-Title'] = 'ResumeAI'
      }

      // json_object response_format works reliably on OpenAI + Ollama.
      // OpenRouter and NVIDIA reasoning models frequently return empty content
      // when this is forced — rely on the prompt instruction instead.
      const useJsonFormat = creds.provider === 'openai' || isOllama
      const timeoutMs = isOllama ? 180_000 : 60_000

      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST', headers,
          body: JSON.stringify({
            model: creds.model,
            messages: [{ role: 'system', content: strictSystem }, { role: 'user', content: userPrompt }],
            temperature, max_tokens: maxTokens,
            ...(useJsonFormat ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (err) {
        if (isOllama) {
          return NextResponse.json({
            error: `Could not reach Ollama at ${url}. Make sure "ollama serve" is running and the model is pulled (ollama pull ${creds.model}).`
          }, { status: 502 })
        }
        throw err
      }

      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } | string }
        const rawMsg = typeof e?.error === 'string' ? e.error : e?.error?.message
        const msg = rawMsg || `${creds.provider} ${res.status}`
        if (isOllama) {
          if (res.status === 404) return NextResponse.json({ error: `Model "${creds.model}" not found in Ollama. Run: ollama pull ${creds.model}` }, { status: 404 })
          return NextResponse.json({ error: msg }, { status: res.status })
        }
        if (res.status === 401 || res.status === 403) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
        if (res.status === 402) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
        if (res.status === 429) return NextResponse.json({ error: 'Rate limit — wait a moment' }, { status: 429 })
        if (res.status === 404) return NextResponse.json({ error: `Model "${creds.model}" not found` }, { status: 404 })
        return NextResponse.json({ error: msg }, { status: res.status })
      }

      const d = await res.json() as Record<string, unknown>
      rawText = extractContent(d)

      // Last-resort: if still empty, log the full response so we can see
      // exactly what the provider returned (not just first 500 chars)
      if (!rawText) {
        console.error('[/api/llm] Empty content from provider. Full response:', JSON.stringify(d).slice(0, 1000))
      }
    }

    // ── Strip reasoning/thinking tokens ──────────────────────────────────────
    // Some models emit <think>...</think> or similar before the actual JSON.
    // After stripping, if the remaining text contains JSON, extract it.
    const stripped = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
      .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, '')
      .replace(/^\s*Thought:.*$/gm, '')
      .trim()

    // If after stripping think tags the text is empty, but rawText had content,
    // the model output was ONLY a think block — try extracting JSON from inside it
    let textToSearch = stripped
    if (!stripped && rawText) {
      const thinkContent = rawText.match(/<think>([\s\S]*?)<\/think>/i)?.[1] || ''
      textToSearch = thinkContent.trim()
    }

    const cleaned = textToSearch.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim()
    const start   = cleaned.indexOf('{')
    const end     = cleaned.lastIndexOf('}')

    if (start === -1 || end === -1) {
      console.error(
        `[/api/llm] No JSON found. Provider: ${creds.provider}, model: ${creds.model}\n` +
        `Raw (first 500): ${rawText.slice(0, 500)}\n` +
        `Stripped (first 500): ${stripped.slice(0, 500)}`
      )
      return NextResponse.json({
        error: `Model did not return valid JSON. ` +
          (reasoning
            ? `This is a reasoning model — try switching to a non-reasoning model like nvidia/nemotron-3-nano-30b-a3b, google/gemma-4-31b-it, or stepfun-ai/step-3.7-flash.`
            : `Try nvidia/nemotron-3-nano-30b-a3b or gemini-2.0-flash.`)
      }, { status: 422 })
    }

    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      // Guard against a syntactically-valid but semantically-empty response
      // (e.g. the model returned "{}") — this is the same failure mode as no
      // JSON at all and should surface the same actionable error rather than
      // silently passing empty data up to the UI.
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length === 0) {
        return NextResponse.json({
          error: 'Model returned an empty response. Try re-running, or switch to a different model.'
        }, { status: 422 })
      }
      return NextResponse.json({ result: parsed })
    } catch {
      return NextResponse.json({ error: 'Could not parse model response as JSON. Try nvidia/nemotron-3-nano-30b-a3b or gemini-2.0-flash.' }, { status: 422 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'LLM proxy failed'
    const name = err instanceof Error ? err.name : ''
    // AbortSignal.timeout() throws a DOMException with name "TimeoutError" and
    // message "The operation was aborted due to timeout" — note: no space in
    // "timeout", so a naive `.includes('timed out')` check never matches.
    if (name === 'TimeoutError' || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
      return NextResponse.json({ error: `Request timed out — the model took too long. Try a faster model (nvidia/nemotron-3-nano-30b-a3b, google/gemma-4-31b-it).` }, { status: 408 })
    }
    console.error('[/api/llm] Unhandled error:', name, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}