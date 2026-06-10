import { NextRequest, NextResponse } from 'next/server'
import type { BYOKCreds, LLMProvider } from '@/types/resume'

const PROVIDER_URLS: Record<string, string> = {
  anthropic:  'https://api.anthropic.com/v1/messages',
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      creds: BYOKCreds
      systemPrompt: string
      userPrompt: string
    }
    const { creds, systemPrompt, userPrompt } = body
    if (!creds?.apiKey || !creds?.provider) {
      return NextResponse.json({ error: 'Missing creds' }, { status: 400 })
    }

    // Prepend strict JSON instruction — critical for reasoning models that add thinking tags
    const strictSystem = `IMPORTANT: Return ONLY valid JSON. No explanations, no markdown fences, no <think> tags, no preamble. Start your response with { and end with }.

${systemPrompt}`

    let rawText = ''

    if (creds.provider === 'anthropic') {
      const res = await fetch(PROVIDER_URLS.anthropic, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: creds.model, max_tokens: 4096, temperature: 0, system: strictSystem, messages: [{ role: 'user', content: userPrompt }] }),
        signal: AbortSignal.timeout(180_000),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        return NextResponse.json({ error: e?.error?.message || `Anthropic ${res.status}` }, { status: res.status })
      }
      const d = await res.json() as { content: Array<{ text: string }> }
      rawText = d.content?.[0]?.text || ''
    }

    else if (creds.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${creds.model}:generateContent?key=${creds.apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: strictSystem }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(180_000),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        return NextResponse.json({ error: e?.error?.message || `Gemini ${res.status}` }, { status: res.status })
      }
      const d = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
      rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }

    else {
      const url = PROVIDER_URLS[creds.provider] || PROVIDER_URLS.openai
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
      }
      if (creds.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://resumeai.app'; headers['X-Title'] = 'ResumeAI' }

      const res = await fetch(url, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: creds.model,
          messages: [{ role: 'system', content: strictSystem }, { role: 'user', content: userPrompt }],
          temperature: 0, max_tokens: 4096,
          ...(creds.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(180_000),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
        const msg = e?.error?.message || `${creds.provider} ${res.status}`
        if (res.status === 401 || res.status === 403) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
        if (res.status === 402) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
        if (res.status === 429) return NextResponse.json({ error: 'Rate limit — wait a moment' }, { status: 429 })
        if (res.status === 404) return NextResponse.json({ error: `Model "${creds.model}" not found` }, { status: 404 })
        return NextResponse.json({ error: msg }, { status: res.status })
      }
      const d = await res.json() as { choices: Array<{ message: { content: string } }> }
      rawText = d.choices?.[0]?.message?.content || ''
    }

    // Strip reasoning/thinking tokens that some models (DeepSeek R1, NVIDIA NIM reasoning models)
    // emit before the actual response — e.g. <think>...</think> or <|thinking|>...</|thinking|>
    let processedText = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
      .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, '')
      .replace(/^\s*Thought:.*$/gm, '')
      .trim()

    const cleaned = processedText.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim()
    const start   = cleaned.indexOf('{')
    const end     = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) {
      // Log first 500 chars to help debug
      console.error('[/api/llm] No JSON found in response. Raw (first 500):', rawText.slice(0, 500))
      return NextResponse.json({
        error: 'Model did not return valid JSON. This model may not support structured output — try meta/llama-3.1-8b-instruct or gemini-2.0-flash instead.'
      }, { status: 422 })
    }
    try {
      return NextResponse.json({ result: JSON.parse(cleaned.slice(start, end + 1)) })
    } catch {
      return NextResponse.json({ error: 'Could not parse model response as JSON. Try meta/llama-3.1-8b-instruct or gemini-2.0-flash.' }, { status: 422 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'LLM proxy failed'
    if (msg.includes('timed out') || msg.includes('TimeoutError')) {
      return NextResponse.json({ error: 'Request timed out. Try a faster model.' }, { status: 408 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}