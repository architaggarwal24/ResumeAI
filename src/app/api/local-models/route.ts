// src/app/api/local-models/route.ts
// GET /api/local-models — model ids your local server reports (Ollama, LM
// Studio, …), for the model picker. Only works when local models are enabled
// in server env; the URL is never taken from the request.
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '@/lib/security/guards'
import { localLlmEnabled, localBaseUrl, LOCAL_DISABLED_MESSAGE } from '@/lib/llm/local'

export async function GET() {
  const { user } = await getAuthedUser()
  if (!user) return unauthorized()
  if (!localLlmEnabled()) return NextResponse.json({ error: LOCAL_DISABLED_MESSAGE, models: [] }, { status: 403 })
  const base = localBaseUrl()
  if (!base) return NextResponse.json({ error: 'LOCAL_LLM_BASE_URL is not a valid http(s) URL', models: [] }, { status: 500 })
  try {
    const headers: Record<string, string> = {}
    if (process.env.LOCAL_LLM_API_KEY) headers['Authorization'] = `Bearer ${process.env.LOCAL_LLM_API_KEY}`
    const res = await fetch(`${base}/models`, { headers, redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.error(`[llm] local-models failed status=${res.status} base=${base}`)
      return NextResponse.json({ error: `Local server answered HTTP ${res.status}`, models: [] }, { status: 502 })
    }
    const d = await res.json() as { data?: Array<{ id?: unknown }> }
    const models = (d.data ?? []).map(m => m.id).filter((id): id is string => typeof id === 'string').slice(0, 200)
    return NextResponse.json({ models, baseUrl: base })
  } catch (err) {
    console.error(`[llm] local-models unreachable base=${base} — ${err instanceof Error ? err.name : 'error'}`)
    return NextResponse.json({ error: `Couldn't reach ${base} — is Ollama / LM Studio running?`, models: [] }, { status: 502 })
  }
}
