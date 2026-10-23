// src/app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { safeHttpUrl } from '@/lib/security/url'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, ownsResume, isUuid, MAX_BODY } from '@/lib/security/guards'
import type { JobStatus } from '@/types/resume'

type Params = { params: Promise<{ id: string }> }

const STATUSES: readonly JobStatus[] = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']
const bad = (error: string) => NextResponse.json({ error }, { status: 400 })
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const money = (v: unknown): number | null | undefined =>
  v === null ? null : (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100_000_000 ? Math.round(v) : undefined)

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!isUuid(id)) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const limited = limit(limiters.write, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    const b = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    if (b.company !== undefined) { const v = text(b.company, 200); if (!v) return bad('Invalid company'); updates.company = v }
    if (b.role    !== undefined) { const v = text(b.role, 200);    if (!v) return bad('Invalid role');    updates.role = v }
    if (b.url !== undefined) {
      if (b.url === null || b.url === '') updates.url = null
      else { const u = safeHttpUrl(b.url); if (!u) return bad('url must be a valid http(s) link'); updates.url = u }
    }
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status as JobStatus)) return bad('Invalid status')
      updates.status = b.status
    }
    if (b.notes    !== undefined) updates.notes    = text(b.notes, 5000)
    if (b.location !== undefined) updates.location = text(b.location, 200)
    if (b.resumeId !== undefined) {
      if (b.resumeId === null || b.resumeId === '') updates.resume_id = null
      else {
        if (!isUuid(b.resumeId) || !(await ownsResume(supabase, b.resumeId, user.id))) {
          return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
        }
        updates.resume_id = b.resumeId
      }
    }
    if (b.salaryMin !== undefined) { const m = money(b.salaryMin); if (m === undefined) return bad('Invalid salaryMin'); updates.salary_min = m }
    if (b.salaryMax !== undefined) { const m = money(b.salaryMax); if (m === undefined) return bad('Invalid salaryMax'); updates.salary_max = m }
    if (b.appliedAt !== undefined) {
      if (b.appliedAt === null || b.appliedAt === '') updates.applied_at = null
      else {
        const d = new Date(String(b.appliedAt))
        if (Number.isNaN(d.getTime())) return bad('Invalid appliedAt')
        updates.applied_at = d.toISOString()
      }
    }

    // Auto-set applied_at when status moves to 'applied'
    if (b.status === 'applied' && b.appliedAt === undefined) {
      updates.applied_at = new Date().toISOString()
    }
    if (Object.keys(updates).length === 0) return bad('Nothing to update')

    const { data, error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', id).eq('user_id', user.id)
      .select().single()

    if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ job: data })
  } catch {
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!isUuid(id)) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const { error } = await supabase
      .from('job_applications').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
