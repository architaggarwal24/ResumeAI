// src/app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { JobStatus } from '@/types/resume'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      company: string; role: string; url?: string; status?: JobStatus
      notes?: string; resumeId?: string; salaryMin?: number; salaryMax?: number
      location?: string; appliedAt?: string
    }

    if (!body.company?.trim() || !body.role?.trim()) {
      return NextResponse.json({ error: 'company and role are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        user_id:    user.id,
        company:    body.company,
        role:       body.role,
        url:        body.url        || null,
        status:     body.status     || 'saved',
        notes:      body.notes      || null,
        resume_id:  body.resumeId   || null,
        salary_min: body.salaryMin  || null,
        salary_max: body.salaryMax  || null,
        location:   body.location   || null,
        applied_at: body.appliedAt  || null,
      })
      .select().single()

    if (error) throw error
    return NextResponse.json({ job: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
