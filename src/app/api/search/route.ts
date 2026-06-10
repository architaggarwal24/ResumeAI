import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SearchResult } from '@/types/resume'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    const pattern = `%${q}%`

    // Search resumes (name + raw_text snippet)
    const { data: resumes } = await supabase
      .from('resumes')
      .select('id, name, ats_score, template_id')
      .eq('user_id', user.id)
      .ilike('name', pattern)
      .limit(5)

    // Also search by candidate name in parsed_data
    const { data: resumesByContent } = await supabase
      .from('resumes')
      .select('id, name, ats_score, template_id, parsed_data')
      .eq('user_id', user.id)
      .limit(20)

    const contentMatches = (resumesByContent ?? []).filter(r => {
      const pd = r.parsed_data as { summary?: string; experience?: Array<{ company?: string; title?: string }> }
      const text = [
        pd?.summary,
        ...(pd?.experience ?? []).map((e) => `${e.company} ${e.title}`),
      ].join(' ').toLowerCase()
      return text.includes(q.toLowerCase())
    }).slice(0, 3)

    // Search jobs
    const { data: jobs } = await supabase
      .from('job_applications')
      .select('id, company, role, status')
      .eq('user_id', user.id)
      .or(`company.ilike.${pattern},role.ilike.${pattern}`)
      .limit(5)

    // Merge and deduplicate resume results
    const resumeMap = new Map<string, typeof resumes extends (infer T)[] | null ? T : never>()
    for (const r of [...(resumes ?? []), ...contentMatches]) {
      if (!resumeMap.has(r.id)) resumeMap.set(r.id, r)
    }

    const results: SearchResult[] = [
      ...[...resumeMap.values()].map(r => ({
        type: 'resume' as const,
        id: r.id,
        title: r.name,
        subtitle: r.ats_score != null ? `ATS ${Math.round(r.ats_score)} · ${r.template_id} template` : `${r.template_id} template`,
        href: `/resume/${r.id}`,
        score: r.ats_score,
      })),
      ...(jobs ?? []).map(j => ({
        type: 'job' as const,
        id: j.id,
        title: `${j.role} @ ${j.company}`,
        subtitle: j.status.charAt(0).toUpperCase() + j.status.slice(1),
        href: `/jobs`,
        status: j.status,
      })),
    ]

    return NextResponse.json({ results, query: q })
  } catch (err) {
    console.error('[GET /api/search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
