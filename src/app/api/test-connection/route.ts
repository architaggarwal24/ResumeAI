// src/app/api/test-connection/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { runLLM } from '@/lib/llm/server'
import { validateCreds, type ValidCreds } from '@/lib/llm/validate'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, MAX_BODY } from '@/lib/security/guards'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

// Server-side connection test — avoids CORS issues with OpenRouter and NVIDIA NIM.
// Two checks:
//   1. Basic connectivity — can we reach the provider and get a response at all?
//   2. JSON capability — can the model return parseable JSON? (needed for scoring,
//      suggestions and the AI coach). Only runs if (1) passes.
// Provider hosts are fixed; nothing here fetches a caller-supplied URL.

type CheckResult = { ok: boolean; error?: string; latencyMs?: number }

async function checkBasicConnection(creds: ValidCreds): Promise<CheckResult> {
  const start = Date.now()

  if (creds.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: creds.model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
      if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid API key' }
      return { ok: false, error: (e?.error?.message || `HTTP ${res.status}`).slice(0, 300) }
    }
    return { ok: true, latencyMs: Date.now() - start }
  }

  if (creds.provider === 'gemini') {
    // Model is validated (no path/query characters); the key travels in a header, not the URL.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(creds.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': creds.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    )
    if (!res.ok) {
      if (res.status === 400 || res.status === 403) return { ok: false, error: 'Invalid API key' }
      if (res.status === 404) return { ok: false, error: `Model "${creds.model}" not found` }
      if (res.status === 429) return { ok: false, error: 'Rate limit — wait a moment' }
      return { ok: false, error: `HTTP ${res.status}` }
    }
    return { ok: true, latencyMs: Date.now() - start }
  }

  const urls: Record<string, string> = {
    openai:     'https://api.openai.com/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${creds.apiKey}`,
  }
  if (creds.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://resumeai.app'
    headers['X-Title'] = 'ResumeAI'
  }
  const res = await fetch(urls[creds.provider], {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: creds.model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = e?.error?.message || ''
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid API key' }
    if (res.status === 402) return { ok: false, error: 'Insufficient credits — add credits to your account' }
    if (res.status === 404) return { ok: false, error: `Model "${creds.model}" not found — check the model ID` }
    if (res.status === 429) return { ok: false, error: 'Rate limit — wait a moment and retry' }
    if (res.status === 400 && msg.includes('model')) return { ok: false, error: `Model "${creds.model}" not supported — try a different model` }
    return { ok: false, error: (msg || `HTTP ${res.status}`).slice(0, 300) }
  }
  return { ok: true, latencyMs: Date.now() - start }
}

// Calls runLLM() directly (same JSON extraction as scoring) — no HTTP hop to
// our own /api/llm, so no session cookie is forwarded anywhere.
async function checkJsonCapability(creds: ValidCreds): Promise<CheckResult> {
  const start = Date.now()
  const out = await runLLM({
    creds,
    systemPrompt: 'Return ONLY valid JSON matching this schema: {"ok": true}. No explanation, no markdown.',
    userPrompt: 'Respond now with the JSON object described in your instructions.',
    maxTokens: 256,
  })
  if (!out.ok) {
    return { ok: false, error: out.status === 408 ? 'JSON check timed out' : out.error }
  }
  return { ok: true, latencyMs: Date.now() - start }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.testConn, user.id)
    if (limited) return limited

    const parsed = await parseBody(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response

    const v = validateCreds(parsed.data)
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })

    const basic = await checkBasicConnection(v.creds)
    if (!basic.ok) {
      return NextResponse.json({ ok: false, error: basic.error, basic, json: null })
    }

    const json = await checkJsonCapability(v.creds)
    return NextResponse.json({
      // Overall "ok" reflects basic connectivity — JSON capability is reported
      // separately so the UI can show "connected but JSON unsupported".
      ok: true,
      latencyMs: basic.latencyMs,
      basic,
      json,
    })
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError') {
      return NextResponse.json({ ok: false, error: 'Connection timed out — check your API key and try again' })
    }
    console.error('[POST /api/test-connection]', name)
    return NextResponse.json({ ok: false, error: 'Connection test failed' })
  }
}
