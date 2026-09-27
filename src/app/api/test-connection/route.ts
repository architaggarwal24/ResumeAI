// src/app/api/test-connection/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedOllamaUrl } from '@/lib/llm/ollama-guard'
import type { BYOKCreds } from '@/types/resume'

// Vercel's default Serverless Function timeout (10s on Hobby) is well
// under what a slow LLM provider or a chained multi-call analysis action
// can take. 60s is the max Hobby plan allows; Pro/Enterprise can go higher
// if you configure a longer timeout for this route in Project Settings.
export const maxDuration = 60

// Server-side connection test — avoids CORS issues with OpenRouter and NVIDIA NIM
// The browser cannot call these APIs directly; they must go through our server
//
// Runs two checks:
//   1. Basic connectivity — can we reach the provider and get a response at all?
//   2. JSON capability — can the model follow a "return only JSON" instruction
//      and produce parseable structured output? This is required for scoring,
//      suggestions, and the AI coach's edit proposals. Only run if (1) passes.

type CheckResult = { ok: boolean; error?: string; latencyMs?: number }

async function checkBasicConnection(creds: BYOKCreds): Promise<CheckResult> {
  const start = Date.now()

  switch (creds.provider) {
    case 'anthropic': {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': creds.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: creds.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid API key' }
        return { ok: false, error: e?.error?.message || `HTTP ${res.status}` }
      }
      return { ok: true, latencyMs: Date.now() - start }
    }

    case 'gemini': {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${creds.model}:generateContent?key=${creds.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
          signal: AbortSignal.timeout(15000),
        }
      )
      if (!res.ok) {
        if (res.status === 400 || res.status === 403) return { ok: false, error: 'Invalid API key' }
        if (res.status === 404) return { ok: false, error: `Model "${creds.model}" not found` }
        if (res.status === 429) return { ok: false, error: 'Rate limit — wait a moment' }
        return { ok: false, error: `HTTP ${res.status}` }
      }
      return { ok: true, latencyMs: Date.now() - start }
    }

    case 'ollama': {
      const url = (creds.baseUrl?.trim() || 'http://localhost:11434/v1/chat/completions')
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: creds.model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: AbortSignal.timeout(20000),
        })
      } catch {
        return { ok: false, error: `Could not reach Ollama at ${url}. Is "ollama serve" running?` }
      }

      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } | string }
        const msg = typeof e?.error === 'string' ? e.error : e?.error?.message
        if (res.status === 404) return { ok: false, error: `Model "${creds.model}" not found — run: ollama pull ${creds.model}` }
        return { ok: false, error: msg || `HTTP ${res.status}` }
      }
      return { ok: true, latencyMs: Date.now() - start }
    }

    case 'openai':
    case 'openrouter':
    case 'nvidia': {
      const urls: Record<string, string> = {
        openai:     'https://api.openai.com/v1/chat/completions',
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
      }
      const url = urls[creds.provider]
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
      }
      if (creds.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://resumeai.app'
        headers['X-Title'] = 'ResumeAI'
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: creds.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
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
        return { ok: false, error: msg || `HTTP ${res.status}` }
      }
      return { ok: true, latencyMs: Date.now() - start }
    }

    default:
      return { ok: false, error: 'Unknown provider' }
  }
}

// Sends a trivial "return only JSON" prompt through /api/llm — which performs
// the same <think>-stripping and JSON extraction used by scoring/suggestions —
// and checks whether the model actually returns parseable JSON.
async function checkJsonCapability(creds: BYOKCreds, request: NextRequest): Promise<CheckResult> {
  const start = Date.now()
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    // /api/llm now requires an authenticated session (see auth check in that
    // route). This is a server-to-server call, so the caller's session cookie
    // must be forwarded explicitly or Supabase won't see it and this will
    // start failing with 401 even though the outer request was authenticated.
    const res = await fetch(`${base.replace(/\/$/, '')}/api/llm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        creds,
        systemPrompt: 'Return ONLY valid JSON matching this schema: {"ok": true}. No explanation, no markdown.',
        userPrompt: 'Respond now with the JSON object described in your instructions.',
        maxTokens: 256,
      }),
      signal: AbortSignal.timeout(45000),
    })
    const data = await res.json().catch(() => ({})) as { result?: unknown; error?: string }
    if (!res.ok || !data.result || typeof data.result !== 'object') {
      return { ok: false, error: data.error || 'Model did not return valid JSON' }
    }
    return { ok: true, latencyMs: Date.now() - start }
  } catch (err) {
    const msg  = err instanceof Error ? err.message : 'JSON check failed'
    const name = err instanceof Error ? err.name : ''
    const isTimeout = name === 'TimeoutError' || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')
    return { ok: false, error: isTimeout ? 'JSON check timed out' : msg }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const creds = await request.json() as BYOKCreds
    if (!creds?.provider || (creds.provider !== 'ollama' && !creds?.apiKey)) {
      return NextResponse.json({ ok: false, error: 'Missing apiKey or provider' }, { status: 400 })
    }

    if (creds.provider === 'ollama') {
      const url = creds.baseUrl?.trim() || 'http://localhost:11434/v1/chat/completions'
      if (!isAllowedOllamaUrl(url)) {
        return NextResponse.json({
          ok: false,
          error: 'Invalid Ollama baseUrl — only http://localhost:11434 or http://127.0.0.1:11434 are allowed'
        }, { status: 400 })
      }
    }

    const basic = await checkBasicConnection(creds)
    if (!basic.ok) {
      return NextResponse.json({
        ok: false,
        error: basic.error,
        basic,
        json: null,
      })
    }

    const json = await checkJsonCapability(creds, request)

    return NextResponse.json({
      // Overall "ok" reflects basic connectivity — JSON capability is reported
      // separately so the UI can show "connected but JSON unsupported" distinctly
      // from "can't connect at all".
      ok: true,
      latencyMs: basic.latencyMs,
      basic,
      json,
    })
  } catch (err: unknown) {
    const msg  = err instanceof Error ? err.message : 'Test failed'
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
      return NextResponse.json({ ok: false, error: 'Connection timed out — check your API key and try again' })
    }
    return NextResponse.json({ ok: false, error: msg })
  }
}