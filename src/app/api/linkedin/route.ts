import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/llm/client'
import { LINKEDIN_PARSE_PROMPT } from '@/lib/llm/prompts'
import type { BYOKCreds, ResumeData } from '@/types/resume'

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
  if (t.startsWith('http')) return t
  if (t.startsWith('/in/')) return `https://www.linkedin.com${t}`
  if (t.startsWith('in/')) return `https://www.linkedin.com/${t}`
  return `https://www.linkedin.com/in/${t.replace(/^@/, '')}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { url: string; creds: BYOKCreds; rawText?: string }

    if (!body.creds?.apiKey) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

    // ── Manual paste mode (fallback) ─────────────────────────────────────────
    if (body.rawText) {
      const parsed = await callLLM<ResumeData>({
        creds: body.creds,
        systemPrompt: LINKEDIN_PARSE_PROMPT,
        userPrompt: `LinkedIn profile text (manually pasted):\n\n${body.rawText.slice(0, 12000)}`,
      })
      return NextResponse.json({ resumeData: parsed, rawText: body.rawText, confidence: 'medium', warnings: [] })
    }

    // ── URL fetch mode ────────────────────────────────────────────────────────
    if (!body.url?.trim()) return NextResponse.json({ error: 'URL or rawText is required' }, { status: 400 })

    const profileUrl = normalizeLinkedInUrl(body.url)
    if (!profileUrl.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'Enter a valid LinkedIn profile URL (linkedin.com/in/username)' }, { status: 400 })
    }

    let html: string
    try {
      const res = await fetch(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        if (res.status === 404) return NextResponse.json({ error: 'Profile not found. Check the URL and make sure the profile is public.', fallback: true }, { status: 404 })
        if (res.status === 999 || res.status === 429) return NextResponse.json({ error: 'LinkedIn is blocking automated access. Use the manual paste option.', fallback: true }, { status: 429 })
        return NextResponse.json({ error: `LinkedIn returned ${res.status}. Use manual paste.`, fallback: true }, { status: 422 })
      }
      html = await res.text()
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

    const parsed = await callLLM<ResumeData>({
      creds: body.creds,
      systemPrompt: LINKEDIN_PARSE_PROMPT,
      userPrompt: `LinkedIn profile URL: ${profileUrl}\n\nExtracted text:\n${rawText}`,
    })

    return NextResponse.json({ resumeData: parsed, rawText, profileUrl, confidence: 'high', warnings: [] })
  } catch (err: unknown) {
    console.error('[POST /api/linkedin]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 })
  }
}
