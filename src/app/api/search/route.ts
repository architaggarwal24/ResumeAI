// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { escapeLikePattern } from '@/lib/security/postgrest'
import { getAuthedUser, unauthorized } from '@/lib/security/guards'
import type { JobStatus, SearchResult } from '@/types/resume'

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) ?? ''
    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    // LIKE wildcards are escaped so they match literally. User input is never
    // interpolated into a PostgREST `.or()` string (where `,` `(` `)` change the
    // filter structure) — jobs are matched with two separate ilike queries instead.
    const pattern = `%${escapeLikePattern(q)}%`

    // Search resumes by name
    const { data: resumes } = await supabase
      .from('resumes')
      .select('id, name, ats_score, template_id')
      .eq('user_id', user.id)
      .ilike('name', pattern)
      .limit(5)

    // Also search by content in parsed_data
    const { data: resumesByContent } = await supabase
      .from('resumes')
      .select('id, name, ats_score, template_id, parsed_data')
      .eq('user_id', user.id)
      .limit(20)

    const needle = q.toLowerCase()
    const contentMatches = (resumesByContent ?? []).filter(r => {
      const pd = (r.parsed_data ?? {}) as { summary?: unknown; experience?: unknown }
      const exp = Array.isArray(pd.experience) ? pd.experience as Array<{ company?: unknown; title?: unknown }> : []
      const text = [
        typeof pd.summary === 'string' ? pd.summary : '',
        ...exp.map(e => `${typeof e?.company === 'string' ? e.company : ''} ${typeof e?.title === 'string' ? e.title : ''}`),
      ].join(' ').toLowerCase()
      return text.includes(needle)
    }).slice(0, 3)

    // Search jobs (company OR role)
    const [byCompany, byRole] = await Promise.all([
      supabase.from('job_applications').select('id, company, role, status')
        .eq('user_id', user.id).ilike('company', pattern).limit(5),
      supabase.from('job_applications').select('id, company, role, status')
        .eq('user_id', user.id).ilike('role', pattern).limit(5),
    ])
    const jobMap = new Map<string, { id: string; company: string; role: string; status: JobStatus }>()
    for (const j of [...(byCompany.data ?? []), ...(byRole.data ?? [])]) if (!jobMap.has(j.id)) jobMap.set(j.id, j)
    const jobs = [...jobMap.values()].slice(0, 5)

    // Merge and deduplicate resume results
    const resumeMap = new Map<string, { id: string; name: string; ats_score: number | null; template_id: string }>()
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
      ...jobs.map(j => ({
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
    console.error('[GET /api/search]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
