// src/lib/llm/local.ts
// Local models (Ollama, LM Studio, llama.cpp server, vLLM — anything that
// speaks the OpenAI chat-completions API). Off unless the operator turns it on:
//
//   NEXT_PUBLIC_ENABLE_LOCAL_LLM=true                 # shows "Local" in the UI
//   LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1      # Ollama default; LM Studio: http://127.0.0.1:1234/v1
//   LOCAL_LLM_API_KEY=...                             # optional, only if your server wants one
//
// The URL comes only from server env, never from the browser, so this can't be
// used to make the server fetch arbitrary addresses (SSRF).
// Pure (no imports) so it can be unit-tested with node --test.

type Env = Record<string, string | undefined>

export const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:11434/v1'

export function localLlmEnabled(env: Env = process.env): boolean {
  return env.NEXT_PUBLIC_ENABLE_LOCAL_LLM === 'true'
}

/** Base URL without trailing slash, or null if the configured value isn't an http(s) URL. */
export function localBaseUrl(env: Env = process.env): string | null {
  const raw = (env.LOCAL_LLM_BASE_URL || DEFAULT_LOCAL_BASE_URL).trim()
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    return u.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export const LOCAL_DISABLED_MESSAGE =
  'Local models are turned off. Add NEXT_PUBLIC_ENABLE_LOCAL_LLM=true (and LOCAL_LLM_BASE_URL if not Ollama on 127.0.0.1:11434) to .env.local, then restart `npm run dev`.'

/** Per-call deadline. Local CPU/GPU models are slower, so they get longer by default. */
export function llmTimeoutMs(provider: string, env: Env = process.env): number {
  const configured = Number(env.LLM_TIMEOUT_MS)
  if (Number.isFinite(configured) && configured >= 5_000) return Math.min(configured, 600_000)
  return provider === 'local' ? 180_000 : 60_000
}
