// src/lib/llm/validate.ts
// Validation for BYOK credentials arriving from the browser. Provider hosts
// are fixed server-side; the model id is the only caller-controlled string
// that gets interpolated into a URL (Gemini), so it must not be able to change
// the path or query.

export const LLM_PROVIDER_IDS = ['anthropic', 'openai', 'gemini', 'openrouter', 'nvidia'] as const
export type ProviderId = (typeof LLM_PROVIDER_IDS)[number]

export interface ValidCreds { provider: ProviderId; apiKey: string; model: string }
export type CredsResult = { ok: true; creds: ValidCreds } | { ok: false; error: string }

export function isSafeModelId(provider: string, model: unknown): boolean {
  if (typeof model !== 'string' || model.length === 0 || model.length > 128) return false
  if (model.includes('..')) return false
  if (provider === 'gemini') return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)
  // OpenAI-compatible gateways use ids like "meta-llama/llama-3.3-70b-instruct:free".
  return /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/.test(model)
}

export function validateCreds(raw: unknown): CredsResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Missing creds' }
  const r = raw as Record<string, unknown>
  const provider = r.provider
  if (typeof provider !== 'string' || !(LLM_PROVIDER_IDS as readonly string[]).includes(provider)) {
    return { ok: false, error: 'Unknown provider' }
  }
  const apiKey = r.apiKey
  // Printable ASCII, no whitespace: blocks header injection and absurd payloads.
  if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 512 || !/^[\x21-\x7e]+$/.test(apiKey)) {
    return { ok: false, error: 'Invalid API key format' }
  }
  if (!isSafeModelId(provider, r.model)) return { ok: false, error: 'Invalid model id' }
  return { ok: true, creds: { provider: provider as ProviderId, apiKey, model: r.model as string } }
}
