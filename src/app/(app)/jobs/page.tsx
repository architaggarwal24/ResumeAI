// src/app/(app)/jobs/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn, formatDate } from '@/lib/utils'
import { Briefcase, Plus, X, ExternalLink, ChevronDown, DollarSign, MapPin, Calendar, FileText, GripVertical, MoreHorizontal, Trash2, Edit2, Wand2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { useResumeStore } from '@/store/resumeStore'
import type { JobStatus, JobApplicationRow } from '@/types/resume'

const COLUMNS: { id: JobStatus; label: string; color: string; bg: string }[] = [
  { id: 'saved',        label: 'Saved',        color: 'text-slate-400',   bg: 'bg-slate-400/10 border-slate-400/20'   },
  { id: 'applied',      label: 'Applied',      color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20'     },
  { id: 'interviewing', label: 'Interviewing', color: 'text-violet-400',  bg: 'bg-violet-400/10 border-violet-400/20' },
  { id: 'offer',        label: 'Offer 🎉',     color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20'},
  { id: 'rejected',     label: 'Rejected',     color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20'       },
]

interface JobWithResume extends JobApplicationRow {
  resumes?: { id: string; name: string; ats_score: number | null } | null
}
interface NewJobForm { company: string; role: string; url: string; location: string; salaryMin: string; salaryMax: string; notes: string; resumeId: string }
const EMPTY: NewJobForm = { company:'', role:'', url:'', location:'', salaryMin:'', salaryMax:'', notes:'', resumeId:'' }

export default function JobsPage() {
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
    const close = () => setMenuOpen(null)
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
      const { job } = await res.json()
      setJobs(p => [job, ...p]); setForm(EMPTY); setAddingTo(null)
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addToast(`Tailored resume created: "${data.tailoredName}"`, 'success', 6000)
      router.push(`/resume/${data.resume.id}`)
    } catch (err) { addToast(err instanceof Error ? err.message : 'Tailoring failed', 'error') }
    setTailoring(null)
  }

  async function saveEdit() {
    if (!editingJob) return
    setSaving(true)
    const res = await fetch(`/api/jobs/${editingJob.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: editingJob.company, role: editingJob.role,
        url: editingJob.url, location: editingJob.location, notes: editingJob.notes,
        resumeId: editingJob.resume_id, salaryMin: editingJob.salary_min, salaryMax: editingJob.salary_max }),
    })
    const { job } = await res.json()
    setJobs(p => p.map(j => j.id === editingJob.id ? { ...j, ...job } : j))
    setEditing(null); setSaving(false)
  }

  function onDrop(e: React.DragEvent, status: JobStatus) {
    e.preventDefault()
    if (dragging) moveJob(dragging, status)
    setDragging(null); setDragOver(null)
  }

  const byStatus = (s: JobStatus) => jobs.filter(j => j.status === s)

  if (loading) return (
    <div className="p-8">
      <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse mb-6"/>
      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map(c => <div key={c.id} className="h-64 bg-white/5 rounded-xl animate-pulse"/>)}
      </div>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1400px] px-8 py-8 fade-in flex flex-col" style={{minHeight:"calc(100vh - 0px)"}}>
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase size={20} className="text-violet-400"/>Job Tracker
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {jobs.length} application{jobs.length !== 1 ? 's' : ''}
            {jobs.filter(j=>j.status==='interviewing').length > 0 && ` · ${jobs.filter(j=>j.status==='interviewing').length} interviewing`}
          </p>
        </div>
        <Button variant="primary" onClick={() => { setAddingTo('saved'); setForm(EMPTY) }}>
          <Plus size={14}/>Add Job
        </Button>
      </div>

      {/* Board */}
      <div className="grid grid-cols-5 gap-3 flex-1 min-h-0">
        {COLUMNS.map(col => {
          const colJobs = byStatus(col.id)
          return (
            <div key={col.id}
              className={cn('flex flex-col rounded-xl border transition-all',
                dragOver===col.id ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/7 bg-[#111116]')}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => onDrop(e, col.id)}>
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-white/7 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-semibold', col.color)}>{col.label}</span>
                    <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded-full border', col.bg)}>{colJobs.length}</span>
                  </div>
                  <button onClick={() => { setAddingTo(col.id); setForm(EMPTY) }} className="text-slate-600 hover:text-slate-300 transition-colors">
                    <Plus size={13}/>
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                {/* Inline add form */}
                {addingTo === col.id && (
                  <div className="bg-[#1c1c24] border border-violet-500/30 rounded-xl p-3 space-y-2 fade-in">
                    <input value={form.company} onChange={e=>setForm(p=>({...p,company:e.target.value}))} placeholder="Company *" autoFocus
                      className="w-full bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"/>
                    <input value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} placeholder="Role *"
                      className="w-full bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"/>
                    <input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} placeholder="Job URL"
                      className="w-full bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"/>
                    <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="Location"
                      className="w-full bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"/>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={form.salaryMin} onChange={e=>setForm(p=>({...p,salaryMin:e.target.value}))} placeholder="Min salary" type="number"
                        className="bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"/>
                      <input value={form.salaryMax} onChange={e=>setForm(p=>({...p,salaryMax:e.target.value}))} placeholder="Max salary" type="number"
                        className="bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"/>
                    </div>
                    {resumes.length > 0 && (
                      <select value={form.resumeId} onChange={e=>setForm(p=>({...p,resumeId:e.target.value}))}
                        className="w-full bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50">
                        <option value="">Link resume (optional)</option>
                        {resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                    <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notes…" rows={2}
                      className="w-full bg-[#111116] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"/>
                    <div className="flex gap-1.5">
                      <Button variant="primary" size="sm" onClick={() => addJob(col.id)} loading={saving} disabled={!form.company.trim()||!form.role.trim()}>Add</Button>
                      <Button size="sm" onClick={() => setAddingTo(null)}><X size={12}/></Button>
                    </div>
                  </div>
                )}

                {colJobs.length === 0 && addingTo !== col.id && (
                  <p className="text-center text-xs text-slate-700 py-6">Drop cards here</p>
                )}

                {colJobs.map(job => (
                  <div key={job.id} draggable onDragStart={e => { setDragging(job.id); e.dataTransfer.effectAllowed='move' }}
                    className={cn('bg-[#16161d] border border-white/7 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all group hover:border-white/15 hover:shadow-md hover:shadow-black/20',
                      dragging===job.id && 'opacity-40 scale-95')}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <GripVertical size={11} className="text-slate-700 mt-0.5 shrink-0 group-hover:text-slate-500"/>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{job.company}</p>
                          <p className="text-xs text-slate-400 truncate">{job.role}</p>
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <button onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===job.id?null:job.id)}} className="text-slate-600 hover:text-slate-300 p-0.5 rounded">
                          <MoreHorizontal size={13}/>
                        </button>
                        {menuOpen===job.id && (
                          <div className="absolute right-0 top-6 bg-[#1c1c24] border border-white/10 rounded-xl shadow-xl z-20 py-1 w-44 fade-in" onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{setEditing(job);setMenuOpen(null)}} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Edit2 size={11}/>Edit</button>
                            {job.url && <a href={job.url} target="_blank" rel="noopener" className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><ExternalLink size={11}/>View Posting</a>}
                            {job.resume_id && <button onClick={()=>{router.push(`/resume/${job.resume_id}`);setMenuOpen(null)}} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><FileText size={11}/>Open Resume</button>}
                            <button onClick={()=>{tailorResume(job);setMenuOpen(null)}} disabled={tailoring===job.id} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"><Wand2 size={11}/>{tailoring===job.id?'Tailoring…':'Tailor Resume'}</button>
                            <button onClick={()=>{router.push(`/interview/${job.id}`);setMenuOpen(null)}} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><MessageSquare size={11}/>Interview Prep</button>
                            <div className="border-t border-white/8 my-1"/>
                            {COLUMNS.filter(c=>c.id!==job.status).map(c=>(
                              <button key={c.id} onClick={()=>{moveJob(job.id,c.id);setMenuOpen(null)}} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 hover:bg-white/5">
                                <ChevronDown size={11}/>→ {c.label}
                              </button>
                            ))}
                            <div className="border-t border-white/8 my-1"/>
                            <button onClick={()=>{deleteJob(job.id);setMenuOpen(null)}} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-400/10"><Trash2 size={11}/>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {job.location && <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={9}/>{job.location}</p>}
                      {(job.salary_min||job.salary_max) && <p className="flex items-center gap-1 text-xs text-slate-500"><DollarSign size={9}/>{job.salary_min&&job.salary_max?`${(job.salary_min/1000).toFixed(0)}k–${(job.salary_max/1000).toFixed(0)}k`:job.salary_min?`${(job.salary_min/1000).toFixed(0)}k+`:`up to ${(job.salary_max!/1000).toFixed(0)}k`}</p>}
                      {job.applied_at && <p className="flex items-center gap-1 text-xs text-slate-500"><Calendar size={9}/>Applied {formatDate(job.applied_at)}</p>}
                      {job.resumes && <p className="flex items-center gap-1 text-xs text-violet-400 cursor-pointer hover:text-violet-300" onClick={()=>router.push(`/resume/${job.resumes!.id}`)}><FileText size={9}/>{job.resumes.name}{job.resumes.ats_score!=null&&<span className="font-mono ml-1">{Math.round(job.resumes.ats_score)}</span>}</p>}
                      {job.notes && <p className="text-xs text-slate-600 italic truncate">{job.notes}</p>}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={()=>setEditing(null)}>
          <div className="bg-[#16161d] border border-white/10 rounded-2xl p-6 w-full max-w-md fade-in shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Edit Application</h3>
              <button onClick={()=>setEditing(null)} className="text-slate-500 hover:text-slate-300"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              {([['Company','company'],['Role','role'],['Job URL','url'],['Location','location']] as [string,keyof JobWithResume][]).map(([lbl,fld])=>(
                <div key={fld}>
                  <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">{lbl}</p>
                  <input value={(editingJob[fld] as string)||''} onChange={e=>setEditing(p=>p?{...p,[fld]:e.target.value}:p)}
                    className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {([['Min Salary','salary_min'],['Max Salary','salary_max']] as [string, keyof JobWithResume][]).map(([lbl,fld])=>(
                  <div key={fld}>
                    <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">{lbl}</p>
                    <input type="number" value={(editingJob[fld] as number)||''} onChange={e=>setEditing(p=>p?{...p,[fld]:e.target.value?+e.target.value:null}:p)}
                      className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50"/>
                  </div>
                ))}
              </div>
              {resumes.length>0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Linked Resume</p>
                  <select value={editingJob.resume_id||''} onChange={e=>setEditing(p=>p?{...p,resume_id:e.target.value||null}:p)}
                    className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50">
                    <option value="">No resume linked</option>
                    {resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <p className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Notes</p>
                <textarea rows={3} value={editingJob.notes||''} onChange={e=>setEditing(p=>p?{...p,notes:e.target.value}:p)}
                  className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 resize-none"/>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="primary" className="flex-1 justify-center" onClick={saveEdit} loading={saving}>Save Changes</Button>
              <Button onClick={()=>setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
