// src/app/api/linkedin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callLLMServer } from '@/lib/llm/server'
import { LLMError } from '@/lib/llm/client'
import { validateCreds } from '@/lib/llm/validate'
import { LINKEDIN_PARSE_PROMPT } from '@/lib/llm/prompts'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, MAX_BODY } from '@/lib/security/guards'

// 60s is the max the Hobby plan allows; raise on Pro/Enterprise if needed.
export const maxDuration = 60

const MAX_HTML_BYTES = 2 * 1024 * 1024

function extractLinkedInText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 12000)
}

function normalizeLinkedInUrl(input: string): string {
  const t = input.trim()
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/in/')) return `https://www.linkedin.com${t}`
  if (t.startsWith('in/')) return `https://www.linkedin.com/${t}`
  return `https://www.linkedin.com/in/${t.replace(/^@/, '')}`
}

// Read at most `max` bytes of the response body.
async function readTextLimited(res: Response, max: number): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) { await reader.cancel().catch(() => {}); break }
    chunks.push(value)
  }
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.byteLength }
  return new TextDecoder().decode(buf)
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.ai, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.small * 4)
    if (!parsed.ok) return parsed.response
    const body = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    const v = validateCreds(body.creds)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    // ── Manual paste mode (fallback) ─────────────────────────────────────────
    if (typeof body.rawText === 'string' && body.rawText) {
      const rawText = body.rawText.slice(0, 12000)
      const out = await callLLMServer<Record<string, unknown>>({
        creds: v.creds,
        systemPrompt: LINKEDIN_PARSE_PROMPT,
        userPrompt: `LinkedIn profile text (manually pasted):\n\n${rawText}`,
      })
      const resumeData = sanitizeResumeData(out)
      if (!resumeData) return NextResponse.json({ error: 'Model returned an unusable resume' }, { status: 422 })
      return NextResponse.json({ resumeData, rawText, confidence: 'medium', warnings: [] })
    }

    // ── URL fetch mode ────────────────────────────────────────────────────────
    if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 300) {
      return NextResponse.json({ error: 'URL or rawText is required' }, { status: 400 })
    }

    const invalid = () => NextResponse.json({ error: 'Enter a valid LinkedIn profile URL (linkedin.com/in/username)' }, { status: 400 })
    let parsedUrl: URL
    try {
      parsedUrl = new URL(normalizeLinkedInUrl(body.url))
    } catch {
      return invalid()
    }
    // https only, exact LinkedIn host, no credentials/port, profile path only.
    const isLinkedInHost = parsedUrl.hostname === 'www.linkedin.com' || parsedUrl.hostname === 'linkedin.com'
    if (parsedUrl.protocol !== 'https:' || !isLinkedInHost || parsedUrl.username || parsedUrl.password || parsedUrl.port
        || !parsedUrl.pathname.startsWith('/in/')) {
      return invalid()
    }
    const profileUrl = parsedUrl.href

    let html: string
    try {
      const res = await fetch(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
        // Never follow redirects: a redirect (e.g. via an open redirect on the
        // host) must not be able to steer this server-side fetch elsewhere.
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status >= 300 && res.status < 400) {
        return NextResponse.json({ error: 'LinkedIn redirected the request. Use the manual paste option.', fallback: true }, { status: 422 })
      }
      if (!res.ok) {
        if (res.status === 404) return NextResponse.json({ error: 'Profile not found. Check the URL and make sure the profile is public.', fallback: true }, { status: 404 })
        if (res.status === 999 || res.status === 429) return NextResponse.json({ error: 'LinkedIn is blocking automated access. Use the manual paste option.', fallback: true }, { status: 429 })
        return NextResponse.json({ error: `LinkedIn returned ${res.status}. Use manual paste.`, fallback: true }, { status: 422 })
      }
      html = await readTextLimited(res, MAX_HTML_BYTES)
    } catch (err: unknown) {
      const name = (err as { name?: string }).name
      if (name === 'TimeoutError' || name === 'AbortError') {
        return NextResponse.json({ error: 'LinkedIn request timed out. Use the manual paste option.', fallback: true }, { status: 408 })
      }
      throw err
    }

    const isLoginWall = html.includes('authwall') || html.includes('join LinkedIn') || html.length < 5000
    if (isLoginWall) {
      return NextResponse.json({ error: 'LinkedIn requires login for this profile. Use the manual paste option.', fallback: true }, { status: 403 })
    }

    const rawText = extractLinkedInText(html)
    if (rawText.length < 200) {
      return NextResponse.json({ error: 'Could not extract enough content. Use the manual paste option.', fallback: true }, { status: 422 })
    }

    const out = await callLLMServer<Record<string, unknown>>({
      creds: v.creds,
      systemPrompt: LINKEDIN_PARSE_PROMPT,
      userPrompt: `LinkedIn profile URL: ${profileUrl}\n\nExtracted text:\n${rawText}`,
    })
    const resumeData = sanitizeResumeData(out)
    if (!resumeData) return NextResponse.json({ error: 'Model returned an unusable resume' }, { status: 422 })

    return NextResponse.json({ resumeData, rawText, profileUrl, confidence: 'high', warnings: [] })
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      const status = err.code === 'auth' ? 401 : err.code === 'rate_limit' ? 429 : err.code === 'timeout' ? 408 : err.code === 'parse' ? 422 : 502
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[POST /api/linkedin]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
