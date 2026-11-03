// src/app/(app)/jobs/JobBoard.tsx — the Kanban job tracker. Not routed right now: page.tsx shows
// "Coming soon". To bring the board back, make page.tsx: export { default } from './JobBoard'
'use client'
import { safeHttpUrl } from '@/lib/security/url'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn, formatDate } from '@/lib/utils'
import { Briefcase, Plus, X, ExternalLink, ChevronDown, DollarSign, MapPin, Calendar, FileText, GripVertical, MoreHorizontal, Trash2, Edit2, Wand2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { useResumeStore } from '@/store/resumeStore'
import type { JobStatus, JobApplicationRow } from '@/types/resume'
import { readJsonResponse } from '@/lib/llm/client'

const COLUMNS: { id: JobStatus; label: string; color: string; bg: string }[] = [
  { id: 'saved',        label: 'Saved',        color: 'text-slate-400',   bg: 'bg-slate-400/10 border-slate-400/20'   },
  { id: 'applied',      label: 'Applied',      color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20'     },
  { id: 'interviewing', label: 'Interviewing', color: 'text-violet-400',  bg: 'bg-violet-400/10 border-violet-400/20' },
  { id: 'offer',        label: 'Offer',     color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20'},
  { id: 'rejected',     label: 'Rejected',     color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20'       },
]

interface JobWithResume extends JobApplicationRow {
  resumes?: { id: string; name: string; ats_score: number | null } | null
}
interface NewJobForm { company: string; role: string; url: string; location: string; salaryMin: string; salaryMax: string; notes: string; resumeId: string }
const EMPTY: NewJobForm = { company:'', role:'', url:'', location:'', salaryMin:'', salaryMax:'', notes:'', resumeId:'' }

export default function JobBoard() {
  const router = useRouter()
  const [jobs, setJobs]             = useState<JobWithResume[]>([])
  const [resumes, setResumes]       = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [addingTo, setAddingTo]     = useState<JobStatus | null>(null)
  const [form, setForm]             = useState<NewJobForm>(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [editingJob, setEditing]    = useState<JobWithResume | null>(null)
  const [menuOpen, setMenuOpen]     = useState<string | null>(null)
  const [dragging, setDragging]     = useState<string | null>(null)
  const [dragOver, setDragOver]     = useState<JobStatus | null>(null)
  const [tailoring, setTailoring]   = useState<string | null>(null)
  const { byokCreds, addToast }     = useResumeStore()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [jr, rr] = await Promise.all([fetch('/api/jobs'), fetch('/api/resume')])
      const [jd, rd] = await Promise.all([jr.json(), rr.json()])
      setJobs(jd.jobs ?? []); setResumes(rd.resumes ?? []); setLoading(false)
    }
    load()
    // Close the card menu on outside clicks. React's own listener also sits on
    // `document` in the App Router, so e.stopPropagation() in the toggle button
    // can't stop this one — it closed the menu the instant it opened. Ignore
    // clicks that land inside a menu (or its toggle) instead.
    const close = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-job-menu]')) return
      setMenuOpen(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  async function addJob(status: JobStatus) {
    if (!form.company.trim() || !form.role.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: form.company, role: form.role, status, url: form.url||undefined,
          location: form.location||undefined, salaryMin: form.salaryMin ? +form.salaryMin : undefined,
          salaryMax: form.salaryMax ? +form.salaryMax : undefined, notes: form.notes||undefined,
          resumeId: form.resumeId||undefined }),
      })
      const data = await readJsonResponse<{ job?: JobWithResume; error?: string }>(res)
      if (!res.ok || !data.job) { addToast(data.error || 'Could not add the job', 'error'); return }
      const job = data.job
      setJobs(p => [job, ...p]); setForm(EMPTY); setAddingTo(null)
    } catch {
      addToast('Could not add the job — check your connection', 'error')
    } finally { setSaving(false) }
  }

  async function moveJob(jobId: string, status: JobStatus) {
    setJobs(p => p.map(j => j.id === jobId ? { ...j, status } : j))
    await fetch(`/api/jobs/${jobId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
  }

  async function deleteJob(jobId: string) {
    setJobs(p => p.filter(j => j.id !== jobId))
    await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
  }

  async function tailorResume(job: JobWithResume) {
    if (!byokCreds.apiKey) { addToast('Add API key first', 'error'); return }
    const resumeId = job.resume_id || resumes[0]?.id
    if (!resumeId) { addToast('No resume to tailor', 'error'); return }
    const jd = job.notes || ''
    if (!jd.trim()) { addToast('Add a job description in Notes first', 'info', 5000); return }
    setTailoring(job.id)
    try {
      const res = await fetch('/api/resume/tailor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, jobDescription: jd, company: job.company, role: job.role, jobApplicationId: job.id, creds: byokCreds }),
      })
      const data = await readJsonResponse(res)
      if (!res.ok) throw new Error(data.error)
      addToast(`Tailored resume created: "${data.tailoredName}"`, 'success', 6000)
      router.push(`/resume/${data.resume.id}`)
    } catch (err) { addToast(err instanceof Error ? err.message : 'Tailoring failed', 'error') }
    setTailoring(null)
  }

  async function saveEdit() {
    if (!editingJob) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: editingJob.company, role: editingJob.role,
          url: editingJob.url, location: editingJob.location, notes: editingJob.notes,
          resumeId: editingJob.resume_id, salaryMin: editingJob.salary_min, salaryMax: editingJob.salary_max }),
      })
      const data = await readJsonResponse<{ job?: JobWithResume; error?: string }>(res)
      if (!res.ok || !data.job) { addToast(data.error || 'Could not save changes', 'error'); return }
      const job = data.job
      setJobs(p => p.map(j => j.id === editingJob.id ? { ...j, ...job } : j))
      setEditing(null)
    } catch {
      addToast('Could not save changes — check your connection', 'error')
    } finally { setSaving(false) }
  }

  function onDrop(e: React.DragEvent, status: JobStatus) {
    e.preventDefault()
    if (dragging) moveJob(dragging, status)
    setDragging(null); setDragOver(null)
  }

  const byStatus = (s: JobStatus) => jobs.filter(j => j.status === s)

  if (loading) return (
    <div className="p-4 sm:p-8">
      <div className="skeleton mb-6 h-10 w-56 rounded-2xl"/>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map(c => <div key={c.id} className="skeleton h-64 rounded-3xl"/>)}
      </div>
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col px-4 py-8 sm:px-8 sm:py-10" style={{minHeight:"calc(100vh - 0px)"}}>
      <div className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Briefcase size={20}/></span>Job tracker
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {jobs.length} application{jobs.length !== 1 ? 's' : ''}
            {jobs.filter(j=>j.status==='interviewing').length > 0 && ` · ${jobs.filter(j=>j.status==='interviewing').length} interviewing`}
          </p>
        </div>
        <Button variant="primary" onClick={() => { setAddingTo('saved'); setForm(EMPTY) }}>
          <Plus size={14}/>Add job
        </Button>
      </div>

      {/* Board */}
      <div className="-mx-4 flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {COLUMNS.map(col => {
          const colJobs = byStatus(col.id)
          return (
            <div key={col.id}
              className={cn('glass flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-3xl transition-[border-color,background-color,box-shadow] duration-300 lg:w-auto lg:max-w-none',
                dragOver===col.id && 'border-violet-300/50 bg-violet-500/10 shadow-[0_0_40px_-10px_rgba(139,92,246,.8)]')}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => onDrop(e, col.id)}>
              {/* Column header */}
              <div className="shrink-0 border-b border-white/[0.07] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden className={cn('size-2 rounded-full bg-current', col.color)} /><span className="text-sm font-semibold text-white">{col.label}</span>
                    <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded-full border', col.bg)}>{colJobs.length}</span>
                  </div>
                  <button type="button" aria-label={`Add job to ${col.label}`} onClick={() => { setAddingTo(col.id); setForm(EMPTY) }} className="press grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white">
                    <Plus size={15}/>
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                {/* Inline add form */}
                {addingTo === col.id && (
                  <div className="bg-white/[0.04] border border-violet-500/30 rounded-xl p-3 space-y-2 fade-in">
                    <input value={form.company} onChange={e=>setForm(p=>({...p,company:e.target.value}))} placeholder="Company *" autoFocus
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                    <input value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} placeholder="Role *"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                    <input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} placeholder="Job URL"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                    <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="Location"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={form.salaryMin} onChange={e=>setForm(p=>({...p,salaryMin:e.target.value}))} placeholder="Min salary" type="number"
                        className="bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                      <input value={form.salaryMax} onChange={e=>setForm(p=>({...p,salaryMax:e.target.value}))} placeholder="Max salary" type="number"
                        className="bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                    </div>
                    {resumes.length > 0 && (
                      <select value={form.resumeId} onChange={e=>setForm(p=>({...p,resumeId:e.target.value}))}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]">
                        <option value="">Link resume (optional)</option>
                        {resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                    <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notes…" rows={2}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)] resize-none"/>
                    <div className="flex gap-1.5">
                      <Button variant="primary" size="sm" onClick={() => addJob(col.id)} loading={saving} disabled={!form.company.trim()||!form.role.trim()}>Add</Button>
                      <Button size="sm" onClick={() => setAddingTo(null)}><X size={12}/></Button>
                    </div>
                  </div>
                )}

                {colJobs.length === 0 && addingTo !== col.id && (
                  <div className="m-1 rounded-2xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-500">Drop cards here</div>
                )}

                {colJobs.map(job => (
                  <div key={job.id} draggable onDragStart={e => { setDragging(job.id); e.dataTransfer.effectAllowed='move' }}
                    className={cn('group cursor-grab rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3 transition-[transform,border-color,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:border-violet-300/25 hover:shadow-[0_14px_30px_-16px_rgba(139,92,246,.6)] active:cursor-grabbing',
                      dragging===job.id && 'opacity-40 scale-95')}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <GripVertical size={12} className="mt-0.5 shrink-0 text-slate-600 group-hover:text-slate-400"/>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{job.company}</p>
                          <p className="text-xs text-slate-400 truncate">{job.role}</p>
                        </div>
                      </div>
                      <div className="relative shrink-0" data-job-menu>
                        <button type="button" aria-label="Job actions" aria-expanded={menuOpen===job.id} onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===job.id?null:job.id)}} className="press grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white">
                          <MoreHorizontal size={13}/>
                        </button>
                        {menuOpen===job.id && (
                          <div className="glass-strong absolute right-0 top-9 z-20 w-52 rounded-2xl p-1 fade-in" onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{setEditing(job);setMenuOpen(null)}} className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Edit2 size={11}/>Edit</button>
                            {safeHttpUrl(job.url) && <a href={safeHttpUrl(job.url)!} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><ExternalLink size={11}/>View Posting</a>}
                            {job.resume_id && <button onClick={()=>{router.push(`/resume/${job.resume_id}`);setMenuOpen(null)}} className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><FileText size={11}/>Open Resume</button>}
                            <button onClick={()=>{tailorResume(job);setMenuOpen(null)}} disabled={tailoring===job.id} className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"><Wand2 size={11}/>{tailoring===job.id?'Tailoring…':'Tailor Resume'}</button>
                            <button onClick={()=>{router.push(`/interview/${job.id}`);setMenuOpen(null)}} className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><MessageSquare size={11}/>Interview Prep</button>
                            <div className="border-t border-white/10 my-1"/>
                            {COLUMNS.filter(c=>c.id!==job.status).map(c=>(
                              <button key={c.id} onClick={()=>{moveJob(job.id,c.id);setMenuOpen(null)}} className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-white/5">
                                <ChevronDown size={11}/>→ {c.label}
                              </button>
                            ))}
                            <div className="border-t border-white/10 my-1"/>
                            <button onClick={()=>{deleteJob(job.id);setMenuOpen(null)}} className="flex min-h-9 items-center gap-2 w-full rounded-xl px-3 py-2 text-xs text-red-400 hover:bg-red-400/10"><Trash2 size={11}/>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {job.location && <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={9}/>{job.location}</p>}
                      {(job.salary_min||job.salary_max) && <p className="flex items-center gap-1 text-xs text-slate-500"><DollarSign size={9}/>{job.salary_min&&job.salary_max?`${(job.salary_min/1000).toFixed(0)}k–${(job.salary_max/1000).toFixed(0)}k`:job.salary_min?`${(job.salary_min/1000).toFixed(0)}k+`:`up to ${(job.salary_max!/1000).toFixed(0)}k`}</p>}
                      {job.applied_at && <p className="flex items-center gap-1 text-xs text-slate-500"><Calendar size={9}/>Applied {formatDate(job.applied_at)}</p>}
                      {job.resumes && <p className="flex items-center gap-1 text-xs text-violet-400 cursor-pointer hover:text-violet-300" onClick={()=>router.push(`/resume/${job.resumes!.id}`)}><FileText size={9}/>{job.resumes.name}{job.resumes.ats_score!=null&&<span className="font-mono ml-1">{Math.round(job.resumes.ats_score)}</span>}</p>}
                      {job.notes && <p className="text-xs text-slate-500 italic truncate">{job.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05040a]/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Edit application" onClick={()=>setEditing(null)}>
          <div className="glass-strong rounded-3xl p-6 w-full max-w-md fade-in" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold tracking-tight text-white">Edit application</h3>
              <button type="button" aria-label="Close" onClick={()=>setEditing(null)} className="press grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-white"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              {([['Company','company'],['Role','role'],['Job URL','url'],['Location','location']] as [string,keyof JobWithResume][]).map(([lbl,fld])=>(
                <div key={fld}>
                  <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">{lbl}</p>
                  <input value={(editingJob[fld] as string)||''} onChange={e=>setEditing(p=>p?{...p,[fld]:e.target.value}:p)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {([['Min Salary','salary_min'],['Max Salary','salary_max']] as [string, keyof JobWithResume][]).map(([lbl,fld])=>(
                  <div key={fld}>
                    <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">{lbl}</p>
                    <input type="number" value={(editingJob[fld] as number)||''} onChange={e=>setEditing(p=>p?{...p,[fld]:e.target.value?+e.target.value:null}:p)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"/>
                  </div>
                ))}
              </div>
              {resumes.length>0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Linked Resume</p>
                  <select value={editingJob.resume_id||''} onChange={e=>setEditing(p=>p?{...p,resume_id:e.target.value||null}:p)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]">
                    <option value="">No resume linked</option>
                    {resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Notes</p>
                <textarea rows={3} value={editingJob.notes||''} onChange={e=>setEditing(p=>p?{...p,notes:e.target.value}:p)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)] resize-none"/>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="primary" className="flex-1 justify-center" onClick={saveEdit} loading={saving}>Save changes</Button>
              <Button onClick={()=>setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
