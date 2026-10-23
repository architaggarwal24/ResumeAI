// src/app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { safeHttpUrl } from '@/lib/security/url'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, ownsResume, isUuid, MAX_BODY } from '@/lib/security/guards'
import type { JobStatus } from '@/types/resume'

const JOB_STATUSES: readonly JobStatus[] = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']
const MAX_JOBS_PER_USER = 1000

export async function GET() {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const { data, error } = await supabase
      .from('job_applications')
      .select('*, resumes(id, name, ats_score)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ jobs: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const money = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100_000_000 ? Math.round(v) : null)

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.write, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    const b = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    const company = str(b.company, 200)
    const role = str(b.role, 200)
    if (!company || !role) return NextResponse.json({ error: 'company and role are required' }, { status: 400 })

    // The posting URL is later rendered as a link: only http(s) is accepted
    // (rejects javascript:, data:, credentials in URL, etc.).
    let url: string | null = null
    if (b.url !== undefined && b.url !== null && b.url !== '') {
      url = safeHttpUrl(b.url)
      if (!url) return NextResponse.json({ error: 'url must be a valid http(s) link' }, { status: 400 })
    }

    const status = b.status === undefined ? 'saved' : b.status
    if (!JOB_STATUSES.includes(status as JobStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    let resumeId: string | null = null
    if (b.resumeId !== undefined && b.resumeId !== null && b.resumeId !== '') {
      if (!isUuid(b.resumeId) || !(await ownsResume(supabase, b.resumeId, user.id))) {
        return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
      }
      resumeId = b.resumeId
    }

    let appliedAt: string | null = null
    if (typeof b.appliedAt === 'string' && b.appliedAt) {
      const d = new Date(b.appliedAt)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid appliedAt' }, { status: 400 })
      appliedAt = d.toISOString()
    }

    const { count } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= MAX_JOBS_PER_USER) return NextResponse.json({ error: 'Job limit reached' }, { status: 409 })

    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        user_id:    user.id,
        company, role, url,
        status,
        notes:      str(b.notes, 5000),
        resume_id:  resumeId,
        salary_min: money(b.salaryMin),
        salary_max: money(b.salaryMax),
        location:   str(b.location, 200),
        applied_at: appliedAt,
      })
      .select().single()

    if (error) throw error
    return NextResponse.json({ job: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
