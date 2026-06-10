import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { JobStatus } from '@/types/resume'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as Partial<{
      company: string; role: string; url: string; status: JobStatus
      notes: string; resumeId: string; salaryMin: number; salaryMax: number
      location: string; appliedAt: string
    }>

    const updates: Record<string, unknown> = {}
    if (body.company    !== undefined) updates.company    = body.company
    if (body.role       !== undefined) updates.role       = body.role
    if (body.url        !== undefined) updates.url        = body.url
    if (body.status     !== undefined) updates.status     = body.status
    if (body.notes      !== undefined) updates.notes      = body.notes
    if (body.resumeId   !== undefined) updates.resume_id  = body.resumeId
    if (body.salaryMin  !== undefined) updates.salary_min = body.salaryMin
    if (body.salaryMax  !== undefined) updates.salary_max = body.salaryMax
    if (body.location   !== undefined) updates.location   = body.location
    if (body.appliedAt  !== undefined) updates.applied_at = body.appliedAt

    // Auto-set applied_at when status moves to 'applied'
    if (body.status === 'applied' && !body.appliedAt) {
      updates.applied_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', id).eq('user_id', user.id)
      .select().single()

    if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ job: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('job_applications').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
