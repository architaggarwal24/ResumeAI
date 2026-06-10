import { NextRequest, NextResponse } from 'next/server'
import type { BYOKCreds } from '@/types/resume'

// Server-side connection test — avoids CORS issues with OpenRouter and NVIDIA NIM
// The browser cannot call these APIs directly; they must go through our server

export async function POST(request: NextRequest) {
  try {
    const creds = await request.json() as BYOKCreds
    if (!creds?.apiKey || !creds?.provider) {
      return NextResponse.json({ ok: false, error: 'Missing apiKey or provider' }, { status: 400 })
    }

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
          if (res.status === 401 || res.status === 403) return NextResponse.json({ ok: false, error: 'Invalid API key' })
          return NextResponse.json({ ok: false, error: e?.error?.message || `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, latencyMs: Date.now() - start })
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
          if (res.status === 400 || res.status === 403) return NextResponse.json({ ok: false, error: 'Invalid API key' })
          if (res.status === 404) return NextResponse.json({ ok: false, error: `Model "${creds.model}" not found` })
          if (res.status === 429) return NextResponse.json({ ok: false, error: 'Rate limit — wait a moment' })
          return NextResponse.json({ ok: false, error: `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, latencyMs: Date.now() - start })
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
          if (res.status === 401 || res.status === 403) return NextResponse.json({ ok: false, error: 'Invalid API key' })
          if (res.status === 402) return NextResponse.json({ ok: false, error: 'Insufficient credits — add credits to your account' })
          if (res.status === 404) return NextResponse.json({ ok: false, error: `Model "${creds.model}" not found — check the model ID` })
          if (res.status === 429) return NextResponse.json({ ok: false, error: 'Rate limit — wait a moment and retry' })
          if (res.status === 400 && msg.includes('model')) return NextResponse.json({ ok: false, error: `Model "${creds.model}" not supported — try a different model` })
          return NextResponse.json({ ok: false, error: msg || `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, latencyMs: Date.now() - start })
      }

      default:
        return NextResponse.json({ ok: false, error: 'Unknown provider' }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test failed'
    if (msg.includes('timed out') || msg.includes('TimeoutError')) {
      return NextResponse.json({ ok: false, error: 'Connection timed out — check your API key and try again' })
    }
    return NextResponse.json({ ok: false, error: msg })
  }
}
