import type { BYOKCreds, LLMOptions, LLMProvider } from '@/types/resume'

// ─── Provider configs ─────────────────────────────────────────────────────────

export const PROVIDERS: Record<LLMProvider, {
  name: string
  placeholder: string
  hint: string
  models: string[]
  defaultModel: string
  fastModel: string
  baseUrl?: string
}> = {
  anthropic: {
    name: 'Anthropic',
    placeholder: 'sk-ant-…',
    hint: 'Get key at console.anthropic.com',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5', 'claude-opus-4-5'],
    defaultModel: 'claude-haiku-4-5-20251001',
    fastModel:    'claude-haiku-4-5-20251001',
  },
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-…',
    hint: 'Get key at platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    fastModel:    'gpt-4o-mini',
  },
  gemini: {
    name: 'Gemini',
    placeholder: 'AIza…',
    hint: 'Free key at aistudio.google.com/apikey',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-lite'],
    defaultModel: 'gemini-2.0-flash',
    fastModel:    'gemini-2.0-flash',
  },
  openrouter: {
    name: 'OpenRouter',
    placeholder: 'sk-or-…',
    hint: 'Free key at openrouter.ai/keys · browse at openrouter.ai/models',
    models: [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-3-12b-it:free',
      'deepseek/deepseek-v3:free',
      'deepseek/deepseek-r1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'openrouter/auto',
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
    ],
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    fastModel:    'meta-llama/llama-3.1-8b-instruct:free',
    baseUrl:      'https://openrouter.ai/api/v1/chat/completions',
  },
  nvidia: {
    name: 'NVIDIA NIM',
    placeholder: 'nvapi-…',
    hint: 'Free key at build.nvidia.com · browse at build.nvidia.com/explore',
    models: [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'meta/llama-3.1-70b-instruct',
      'mistralai/mistral-7b-instruct-v0.3',
      'mistralai/mixtral-8x7b-instruct-v0.1',
      'deepseek-ai/deepseek-r1',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'microsoft/phi-3-mini-128k-instruct',
      'google/gemma-2-9b-it',
    ],
    defaultModel: 'meta/llama-3.1-8b-instruct',
    fastModel:    'meta/llama-3.1-8b-instruct',
    baseUrl:      'https://integrate.api.nvidia.com/v1/chat/completions',
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
    creds.model.includes('nemotron-4-340b') ||
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

const MAX_RETRIES = 2

// Resolve the correct URL for /api/llm depending on context:
// - Browser: relative URL works fine
// - Server-side (API routes): must use absolute URL
function getLLMProxyUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser context — relative URL is fine
    return '/api/llm'
  }
  // Server context — build absolute URL from env or default
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/llm`
}

export async function callLLM<T = Record<string, unknown>>(options: LLMOptions): Promise<T> {
  const { creds, systemPrompt, userPrompt, signal: externalSignal } = options
  let lastError: Error = new Error('Unknown error')
  const llmUrl = getLLMProxyUrl()

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check if user cancelled before each attempt
    if (externalSignal?.aborted) throw new LLMError('Cancelled', 'unknown', creds.provider)

    try {
      const res = await fetch(llmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: externalSignal,
        body: JSON.stringify({ creds, systemPrompt, userPrompt }),
      })

      const data = await res.json() as { result?: T; error?: string }

      if (!res.ok) {
        const msg = data.error || `Server error ${res.status}`
        // Don't retry auth/credit errors
        if (res.status === 401 || res.status === 403) throw new LLMError(msg, 'auth', creds.provider)
        if (res.status === 402) throw new LLMError(msg, 'auth', creds.provider)
        if (res.status === 429) throw new LLMError(msg, 'rate_limit', creds.provider)
        if (res.status === 408) throw new LLMError(msg, 'timeout', creds.provider)
        // Retry on 5xx or 422
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

      // Don't retry user cancellation or auth errors
      if ((err as { name?: string }).name === 'AbortError') throw err
      if (err instanceof LLMError && (err.code === 'auth' || err.code === 'rate_limit' || err.code === 'timeout')) throw err

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
  }

  throw lastError
}