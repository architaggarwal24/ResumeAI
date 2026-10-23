// src/lib/llm/server.ts
// Server-only LLM access. Imported by API routes — never by client components.
//
// Why this exists: API routes used to call their OWN /api/llm endpoint over
// HTTP, forwarding the caller's session cookie to a URL derived from
// NEXT_PUBLIC_APP_URL / VERCEL_URL / (in test-connection) the request's own
// origin. That is an avoidable SSRF-shaped hop and a cookie-forwarding risk.
// Routes now call runLLM() directly; /api/llm is just a thin HTTP wrapper
// around the same function for browser callers.
import { LLMError } from './client'
import { validateCreds, type ValidCreds } from './validate'
import { extractJsonObject } from './parse'
import type { LLMOptions } from '@/types/resume'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const GEMINI_MODELS = 'https://generativelanguage.googleapis.com/v1beta/models/'
const OPENAI_COMPAT_URLS: Record<string, string> = {
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
}

const REQUEST_TIMEOUT_MS = 60_000
const MAX_PROMPT_CHARS = 250_000
const MAX_OUTPUT_TOKENS = 8192

// Models known to use extended reasoning — forced to temperature 0.
const REASONING_MODEL_PATTERNS = [
  'deepseek-r1', 'deepseek-v4', 'kimi-k2', 'nemotron-3-ultra',
  'o1', 'o3', '-r1', ':thinking',
]
export function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase()
  return REASONING_MODEL_PATTERNS.some(p => m.includes(p))
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(max, Math.max(min, n))
}

function timeoutSignal(external?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return external ? AbortSignal.any([t, external]) : t
}

function shortProviderMessage(s: unknown, fallback: string): string {
  return typeof s === 'string' && s.trim() ? s.trim().slice(0, 300) : fallback
}

// Gemini: model goes in the path (validated + encoded), the key goes in a
// header — never in the URL, where it ends up in logs and error messages.
function geminiEndpoint(model: string): string {
  return `${GEMINI_MODELS}${encodeURIComponent(model)}:generateContent`
}

function openAiCompatHeaders(creds: ValidCreds): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${creds.apiKey}`,
  }
  if (creds.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://resumeai.app'
    headers['X-Title'] = 'ResumeAI'
  }
  return headers
}

function extractOpenAiContent(d: Record<string, unknown>): string {
  const choices = d.choices as Array<Record<string, unknown>> | undefined
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined
  if (!msg) return ''
  for (const field of ['content', 'reasoning_content', 'reasoning'] as const) {
    const v = msg[field]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

// ─── JSON-mode completion ─────────────────────────────────────────────────────

export type RunLLMResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; status: number; error: string }

export async function runLLM(input: {
  creds: unknown
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}): Promise<RunLLMResult> {
  const validated = validateCreds(input.creds)
  if (!validated.ok) return { ok: false, status: 400, error: validated.error }
  const creds = validated.creds

  if (typeof input.systemPrompt !== 'string' || typeof input.userPrompt !== 'string') {
    return { ok: false, status: 400, error: 'Prompts must be strings' }
  }
  if (input.systemPrompt.length + input.userPrompt.length > MAX_PROMPT_CHARS) {
    return { ok: false, status: 413, error: 'Prompt too large' }
  }

  const maxTokens = Math.round(clampNumber(input.maxTokens, 64, MAX_OUTPUT_TOKENS, 4096))
  const reasoning = isReasoningModel(creds.model)
  const temperature = reasoning ? 0 : clampNumber(input.temperature, 0, 1.5, 0)

  const noThinkPrefix = creds.provider === 'nvidia' ? '/no_think\n' : ''
  const strictSystem = `${noThinkPrefix}IMPORTANT: Return ONLY valid JSON. No explanations, no markdown fences, no <think> tags, no preamble. Start your response with { and end with }.\n\n${input.systemPrompt}`
  const signal = timeoutSignal(input.signal)

  try {
    let rawText = ''

    if (creds.provider === 'anthropic') {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: creds.model, max_tokens: maxTokens, temperature, system: strictSystem, messages: [{ role: 'user', content: input.userPrompt }] }),
        redirect: 'error',
        signal,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: 'Invalid API key' }
        return { ok: false, status: res.status, error: shortProviderMessage(e?.error?.message, `Anthropic ${res.status}`) }
      }
      const d = await res.json() as { content?: Array<{ text?: string }> }
      rawText = d.content?.[0]?.text || ''

    } else if (creds.provider === 'gemini') {
      const res = await fetch(geminiEndpoint(creds.model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': creds.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: strictSystem }] },
          contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
        }),
        redirect: 'error',
        signal,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: 'Invalid API key' }
        return { ok: false, status: res.status, error: shortProviderMessage(e?.error?.message, `Gemini ${res.status}`) }
      }
      const d = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || ''

    } else {
      // OpenAI / OpenRouter / NVIDIA (OpenAI-compatible)
      const res = await fetch(OPENAI_COMPAT_URLS[creds.provider], {
        method: 'POST',
        headers: openAiCompatHeaders(creds),
        body: JSON.stringify({
          model: creds.model,
          messages: [{ role: 'system', content: strictSystem }, { role: 'user', content: input.userPrompt }],
          temperature, max_tokens: maxTokens,
          // json_object works reliably on OpenAI; OpenRouter/NVIDIA reasoning models often return empty content when forced.
          ...(creds.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
        }),
        redirect: 'error',
        signal,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } | string }
        const rawMsg = typeof e?.error === 'string' ? e.error : e?.error?.message
        if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: 'Invalid API key' }
        if (res.status === 402) return { ok: false, status: 402, error: 'Insufficient credits' }
        if (res.status === 429) return { ok: false, status: 429, error: 'Rate limit — wait a moment' }
        if (res.status === 404) return { ok: false, status: 404, error: `Model "${creds.model}" not found` }
        return { ok: false, status: res.status, error: shortProviderMessage(rawMsg, `${creds.provider} ${res.status}`) }
      }
      rawText = extractOpenAiContent(await res.json() as Record<string, unknown>)
    }

    const parsed = extractJsonObject(rawText)
    if (!parsed.ok) {
      // Log shape only — never the model output, which echoes the user's resume (PII).
      console.error(`[runLLM] unusable output provider=${creds.provider} model=${creds.model} reason=${parsed.reason} chars=${rawText.length}`)
      if (parsed.reason === 'empty') {
        return { ok: false, status: 422, error: 'Model returned an empty response. Try re-running, or switch to a different model.' }
      }
      if (parsed.reason === 'invalid') {
        return { ok: false, status: 422, error: 'Could not parse model response as JSON. Try nvidia/nemotron-3-nano-30b-a3b or gemini-3.8-flash.' }
      }
      return {
        ok: false, status: 422,
        error: 'Model did not return valid JSON. ' + (reasoning
          ? 'This is a reasoning model — try switching to a non-reasoning model like nvidia/nemotron-3-nano-30b-a3b, google/gemma-4-31b-it, or stepfun-ai/step-3.7-flash.'
          : 'Try nvidia/nemotron-3-nano-30b-a3b or gemini-3.8-flash.'),
      }
    }
    return { ok: true, result: parsed.value }

  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError') {
      return { ok: false, status: 408, error: 'Request timed out — the model took too long. Try a faster model (nvidia/nemotron-3-nano-30b-a3b, google/gemma-4-31b-it).' }
    }
    if (name === 'AbortError') return { ok: false, status: 499, error: 'Cancelled' }
    console.error('[runLLM] unhandled:', name, err instanceof Error ? err.message.slice(0, 200) : '')
    return { ok: false, status: 502, error: 'Could not reach the model provider' }
  }
}

// ─── Server-side caller with the same retry semantics as the browser's callLLM ─

const MAX_RETRIES = 1
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function callLLMServer<T = Record<string, unknown>>(options: LLMOptions): Promise<T> {
  const { creds, systemPrompt, userPrompt, signal, maxTokens, temperature } = options
  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new LLMError('Cancelled', 'unknown', creds.provider)

    // After a timeout, retry with a smaller token budget.
    const attemptMax = attempt > 0 && lastError instanceof LLMError && lastError.code === 'timeout'
      ? Math.max(512, Math.floor((maxTokens ?? 4096) * 0.6))
      : (maxTokens ?? 4096)

    const out = await runLLM({ creds, systemPrompt, userPrompt, maxTokens: attemptMax, temperature, signal })
    if (out.ok) return out.result as T

    const { status, error } = out
    if (status === 401 || status === 403 || status === 402) throw new LLMError(error, 'auth', creds.provider)
    if (status === 429) throw new LLMError(error, 'rate_limit', creds.provider)
    if (status === 422) throw new LLMError(error, 'parse', creds.provider)
    if (status === 400 || status === 413) throw new LLMError(error, 'unknown', creds.provider)
    if (status === 499) throw new LLMError(error, 'unknown', creds.provider)

    lastError = new LLMError(error, status === 408 ? 'timeout' : 'unknown', creds.provider)
    if (attempt < MAX_RETRIES) { await sleep(status === 408 ? 800 : 1500 * (attempt + 1)); continue }
    throw lastError
  }
  throw lastError
}

// ─── Streaming chat (shared by /api/chat and /api/mock-interview) ─────────────

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

function sseToTextStream(provider: string, raw: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''
  return new ReadableStream({
    async start(controller) {
      const reader = raw.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const t = line.trim()
            if (!t.startsWith('data:')) continue
            const data = t.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              const text: string = provider === 'anthropic'
                ? (json.type === 'content_block_delta' ? json.delta?.text ?? '' : '')
                : json.choices?.[0]?.delta?.content ?? ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* partial SSE line */ }
          }
        }
        controller.close()
      } catch (e) {
        try { controller.error(e) } catch { /* already closed */ }
      } finally {
        reader.releaseLock()
      }
    },
  })
}

export async function streamLLMText(input: {
  creds: unknown
  system: string
  messages: ChatTurn[]
  signal?: AbortSignal
  maxTokens?: number
  cacheSystem?: boolean
}): Promise<ReadableStream<Uint8Array>> {
  const validated = validateCreds(input.creds)
  if (!validated.ok) throw new LLMError(validated.error, 'unknown', 'anthropic')
  const creds = validated.creds
  const maxTokens = Math.round(clampNumber(input.maxTokens, 64, 4096, 1536))
  const common = { redirect: 'error' as const, signal: input.signal }

  if (creds.provider === 'anthropic') {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
        // Prompt caching: the resume context is identical on every turn.
        ...(input.cacheSystem ? { 'anthropic-beta': 'prompt-caching-2024-07-31' } : {}),
      },
      body: JSON.stringify({
        model: creds.model, max_tokens: maxTokens, stream: true,
        system: input.cacheSystem
          ? [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }]
          : input.system,
        messages: input.messages,
      }),
      ...common,
    })
    if (!res.ok || !res.body) {
      const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limit' : 'unknown'
      throw new LLMError(code === 'auth' ? 'Invalid API key' : `Provider error ${res.status}`, code, creds.provider)
    }
    return sseToTextStream('anthropic', res.body)
  }

  if (creds.provider === 'gemini') {
    // Gemini streaming is more involved — use the non-streaming endpoint.
    const res = await fetch(geminiEndpoint(creds.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': creds.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: input.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      ...common,
    })
    if (!res.ok) {
      const code = res.status === 400 || res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limit' : 'unknown'
      throw new LLMError(code === 'auth' ? 'Invalid API key or model' : `Provider error ${res.status}`, code, creds.provider)
    }
    const d = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const bytes = new TextEncoder().encode(text)
    return new ReadableStream({ start(c) { c.enqueue(bytes); c.close() } })
  }

  const res = await fetch(OPENAI_COMPAT_URLS[creds.provider], {
    method: 'POST',
    headers: openAiCompatHeaders(creds),
    body: JSON.stringify({
      model: creds.model, stream: true, max_tokens: maxTokens,
      messages: [{ role: 'system', content: input.system }, ...input.messages],
    }),
    ...common,
  })
  if (!res.ok || !res.body) {
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limit' : 'unknown'
    throw new LLMError(code === 'auth' ? 'Invalid API key' : `Provider error ${res.status}`, code, creds.provider)
  }
  return sseToTextStream(creds.provider, res.body)
}
