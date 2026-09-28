// src/lib/llm/client.ts
import type { BYOKCreds, LLMOptions, LLMProvider } from '@/types/resume'

// ─── Provider configs ─────────────────────────────────────────────────────────

export const PROVIDERS: Record<LLMProvider, {
  name: string
  placeholder: string
  hint: string
  models: string[]
  defaultModel: string
  fastModel: string
}> = {
  anthropic: {
    name: 'Anthropic',
    placeholder: 'sk-ant-…',
    hint: 'Get key at console.anthropic.com',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5-5'],
    defaultModel: 'claude-haiku-4-5-20251001',
    fastModel:    'claude-haiku-4-5-20251001',
  },
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-…',
    hint: 'Get key at platform.openai.com/api-keys',
    models: ['gpt-6-luna', 'gpt-6-sol', 'gpt-6-astra'],
    defaultModel: 'gpt-6-luna',
    fastModel:    'gpt-6-luna',
  },
  gemini: {
    name: 'Gemini',
    placeholder: 'AIza…',
    hint: 'Free key at aistudio.google.com/apikey',
    models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'],
    defaultModel: 'gemini-3.8-flash',
    fastModel:    'gemini-3.8-flash',
  },
  openrouter: {
    name: 'OpenRouter',
    placeholder: 'sk-or-…',
    hint: 'Free key at openrouter.ai/keys · browse at openrouter.ai/models',
    models: [
      'openrouter/free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-coder:free',
      'openai/gpt-oss-120b:free',
      'openrouter/auto',
      'anthropic/claude-sonnet-5',
      'openai/gpt-6-sol',
    ],
    defaultModel: 'openrouter/free',
    fastModel:    'openrouter/free',
  },
  nvidia: {
    name: 'NVIDIA NIM',
    placeholder: 'nvapi-…',
    hint: 'Free key at build.nvidia.com · browse at build.nvidia.com/explore',
    models: [
      'deepseek-ai/deepseek-v4-pro',
      'moonshotai/kimi-k2.6',
      'deepseek-ai/deepseek-v4-flash',
      'nvidia/nemotron-3-ultra-550b-a55b',
      'google/gemma-4-31b-it',
      'nvidia/nemotron-3-nano-30b-a3b',
      'stepfun-ai/step-3.7-flash',
      'minimaxai/minimax-m3',
    ],
    defaultModel: 'nvidia/nemotron-3-nano-30b-a3b',
    fastModel:    'nvidia/nemotron-3-nano-30b-a3b',
  },
}

// ─── Fast model for parsing tasks ────────────────────────────────────────────

export function getFastCreds(creds: BYOKCreds): BYOKCreds {
  const isSlowModel =
    creds.model.includes('r1') ||
    creds.model.includes('o1') ||
    creds.model.includes('o3') ||
    creds.model.includes('70b') ||
    creds.model.includes('405b') ||
    creds.model.includes('550b') ||
    creds.model.includes('v4-pro') ||
    creds.model.includes('nemotron-3-ultra') ||
    creds.model.includes('kimi-k2') ||
    creds.model === 'openrouter/auto'
  if (isSlowModel) {
    return { ...creds, model: PROVIDERS[creds.provider].fastModel }
  }
  return creds
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public code: 'auth' | 'rate_limit' | 'timeout' | 'parse' | 'unknown',
    public provider: LLMProvider
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

// ─── Main callLLM — routes through /api/llm to avoid CORS ────────────────────
// OpenRouter and NVIDIA NIM block direct browser requests.
// All providers go through our server proxy for consistency.

// 1 retry (2 attempts total) — each attempt can take up to the provider's 60s
// timeout, so this caps worst-case latency per call at ~2x the timeout instead
// of ~3x.
const MAX_RETRIES = 1

// Resolve the correct URL for /api/llm depending on context:
// - Browser: relative URL works fine
// - Server-side (API routes): must use absolute URL
function getLLMProxyUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser context — relative URL is fine
    return '/api/llm'
  }
  // Server context — build absolute URL. NEXT_PUBLIC_APP_URL should always be
  // set explicitly (see .env.example), but Vercel deployments also get
  // VERCEL_URL for free at runtime, so a forgotten env var doesn't silently
  // break every LLM-touching route by falling through to localhost in prod.
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
    || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/llm`
}

export async function callLLM<T = Record<string, unknown>>(options: LLMOptions): Promise<T> {
  const { creds, systemPrompt, userPrompt, signal: externalSignal, maxTokens, temperature, cookieHeader } = options
  let lastError: Error = new Error('Unknown error')
  const llmUrl = getLLMProxyUrl()

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check if user cancelled before each attempt
    if (externalSignal?.aborted) throw new LLMError('Cancelled', 'unknown', creds.provider)

    // On retry after a timeout, reduce the token budget — the model may have
    // been spending its whole budget on reasoning/thinking before producing
    // any output. A smaller budget can force a faster, more direct answer.
    const attemptMaxTokens = (attempt > 0 && lastError instanceof LLMError && lastError.code === 'timeout')
      ? Math.max(512, Math.floor((maxTokens ?? 4096) * 0.6))
      : (maxTokens ?? 4096)

    try {
      const res = await fetch(llmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        signal: externalSignal,
        body: JSON.stringify({ creds, systemPrompt, userPrompt, maxTokens: attemptMaxTokens, temperature }),
      })

      const data = await res.json() as { result?: T; error?: string }

      if (!res.ok) {
        const msg = data.error || `Server error ${res.status}`
        // Don't retry auth/credit/rate-limit errors — same key, same result
        if (res.status === 401 || res.status === 403) throw new LLMError(msg, 'auth', creds.provider)
        if (res.status === 402) throw new LLMError(msg, 'auth', creds.provider)
        if (res.status === 429) throw new LLMError(msg, 'rate_limit', creds.provider)
        // Timeout — DO retry once with a smaller token budget (see above)
        if (res.status === 408) {
          lastError = new LLMError(msg, 'timeout', creds.provider)
          if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 800)); continue }
          throw lastError
        }
        // 422 = model returned non-JSON. Retrying the IDENTICAL request to the
        // SAME model will almost certainly fail the same way — don't waste a
        // retry slot on it; surface the error immediately so the UI can
        // suggest switching models.
        if (res.status === 422) throw new LLMError(msg, 'parse', creds.provider)
        // Retry other 5xx (transient server errors)
        lastError = new LLMError(msg, 'unknown', creds.provider)
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
          continue
        }
        throw lastError
      }

      if (!data.result) throw new LLMError('Empty response from model', 'parse', creds.provider)
      return data.result

    } catch (err) {
      lastError = err as Error

      // Don't retry user cancellation, auth, rate-limit, or parse errors
      if ((err as { name?: string }).name === 'AbortError') throw err
      if (err instanceof LLMError && (
        err.code === 'auth' || err.code === 'rate_limit' || err.code === 'parse'
      )) throw err

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
  }

  throw lastError
}