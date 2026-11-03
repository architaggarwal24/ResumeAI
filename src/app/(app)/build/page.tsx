// src/app/(app)/build/page.tsx
'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SPRING } from '@/lib/motion'
import { useRouter } from 'next/navigation'
import { useResumeStore } from '@/store/resumeStore'
import { callLLM } from '@/lib/llm/client'
import { RESUME_BUILD_PROMPT } from '@/lib/llm/prompts'
import { generateId } from '@/lib/utils'
import { Button, Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { renderTemplate } from '@/lib/templates/render'
import { Sparkles, ChevronRight, ChevronLeft, Check, Plus, Trash2, User, Briefcase, GraduationCap, Code2, Eye } from 'lucide-react'
import type { ResumeData, Experience, Education } from '@/types/resume'

const STEPS = [
  { id: 'contact',    label: 'Contact',    icon: <User size={14}/>        },
  { id: 'summary',    label: 'Summary',    icon: <Briefcase size={14}/>   },
  { id: 'experience', label: 'Experience', icon: <Briefcase size={14}/>   },
  { id: 'education',  label: 'Education',  icon: <GraduationCap size={14}/> },
  { id: 'skills',     label: 'Skills',     icon: <Code2 size={14}/>       },
  { id: 'preview',    label: 'Preview',    icon: <Eye size={14}/>         },
]

const EMPTY_RESUME: ResumeData = {
  name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '',
  summary: '',
  experience: [],
  education: [],
  skills: { categories: [{ name: 'Technical Skills', items: [] }] },
  projects: [], certifications: [], awards: [], languages: [],
}

export default function BuildPage() {
  const router = useRouter()
  const { byokCreds, addToast, setResumeData, setResumeId } = useResumeStore()
  const [step, setStep]       = useState(0)
  const [data, setData]       = useState<ResumeData>(EMPTY_RESUME)
  const [saving, setSaving]   = useState(false)
  const [aiLoading, setAI]    = useState(false)
  const [dir, setDir]         = useState(1)

  function go(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  function update(partial: Partial<ResumeData>) {
    setData(p => ({ ...p, ...partial }))
  }

  async function aiImprove(section: string, text: string): Promise<string> {
    if (!byokCreds.apiKey || !text.trim()) return text
    setAI(true)
    try {
      const res = await callLLM<{ improved: string; suggestions: string[] }>({
        creds: byokCreds,
        systemPrompt: RESUME_BUILD_PROMPT,
        userPrompt: `Section: ${section}\nUser input: "${text}"`,
      })
      addToast('AI improved your text', 'success')
      return res.improved
    } catch {
      addToast('AI improve failed', 'error')
      return text
    } finally {
      setAI(false)
    }
  }

  async function saveAndRedirect() {
    if (!data.name.trim()) { addToast('Add your name first', 'error'); return }
    setSaving(true)
    try {
      const rawText = [
        data.name, data.email, data.phone, data.location,
        data.summary,
        ...data.experience.flatMap(e => [e.title, e.company, ...e.bullets.map(b => b.text)]),
        ...data.education.map(e => `${e.degree} ${e.institution}`),
        ...data.skills.categories.flatMap(c => c.items),
      ].filter(Boolean).join('\n')

      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, rawText, parsedData: data }),
      })
      if (!res.ok) throw new Error('Save failed')
      const { resume } = await res.json()
      setResumeData(data); setResumeId(resume.id)
      addToast(`"${data.name}" created!`, 'success')
      router.push(`/resume/${resume.id}`)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error')
    }
    setSaving(false)
  }

  const canGoNext = () => {
    if (step === 0) return data.name.trim().length > 0
    return true
  }

  const pct = (step / (STEPS.length - 1)) * 100

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-violet-300">Step {step + 1} of {STEPS.length} · {STEPS[step].label}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Build your resume</h1>
          <p className="mt-2 text-sm text-slate-400">Create a resume from scratch, one section at a time.</p>
        </div>
        <span className="font-mono text-sm text-slate-400"><span className="text-white">{Math.round(pct)}%</span> complete</span>
      </div>

      {/* Step indicator (Goal-Gradient) */}
      <div className="mb-8">
        <div className="relative mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-fuchsia-300 shadow-[0_0_12px_rgba(167,139,250,.7)]" animate={{ width: `${Math.max(4, pct)}%` }} transition={SPRING.soft} />
        </div>
        <div className="grid grid-cols-6 gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => i < step && go(i)}
              aria-current={i === step ? 'step' : undefined}
              disabled={i > step}
              className={cn(
                'press relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors',
                i === step ? 'text-white' : i < step ? 'text-violet-200 hover:bg-white/[0.04]' : 'cursor-default text-slate-500',
              )}
            >
              {i === step && <motion.span layoutId="build-step" transition={SPRING.snappy} className="absolute inset-0 rounded-xl border border-violet-300/30 bg-violet-500/15" />}
              <span className={cn('relative grid size-6 place-items-center rounded-full', i < step ? 'bg-violet-500/25' : i === step ? 'bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,.8)]' : 'bg-white/[0.05]')}>
                {i < step ? <Check size={12} /> : s.icon}
              </span>
              <span className="relative hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Steps */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: dir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -20, transition: { duration: 0.15 } }}
          transition={SPRING.soft}
        >
          {step === 0 && <ContactStep data={data} update={update} aiImprove={aiImprove} aiLoading={aiLoading} />}
          {step === 1 && <SummaryStep data={data} update={update} aiImprove={aiImprove} aiLoading={aiLoading} />}
          {step === 2 && <ExperienceStep data={data} update={update} aiImprove={aiImprove} aiLoading={aiLoading} />}
          {step === 3 && <EducationStep data={data} update={update} />}
          {step === 4 && <SkillsStep data={data} update={update} />}
          {step === 5 && <PreviewStep data={data} />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="glass-strong sticky bottom-20 z-10 mt-8 flex items-center justify-between rounded-2xl p-2 md:bottom-4">
        <Button onClick={() => go(step - 1)} disabled={step === 0}>
          <ChevronLeft size={14} />Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => go(step + 1)} disabled={!canGoNext()}>
            Next: {STEPS[step + 1].label} <ChevronRight size={14} />
          </Button>
        ) : (
          <Button variant="primary" onClick={saveAndRedirect} loading={saving}>
            <Check size={14} />Save &amp; analyze
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function ContactStep({ data, update }: StepProps) {
  const fields: [string, keyof ResumeData, string][] = [
    ['Full Name *', 'name', 'Jane Smith'],
    ['Email *', 'email', 'jane@example.com'],
    ['Phone', 'phone', '+1 (555) 123-4567'],
    ['Location', 'location', 'San Francisco, CA'],
    ['LinkedIn', 'linkedin', 'linkedin.com/in/janesmith'],
    ['GitHub', 'github', 'github.com/janesmith'],
  ]
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-white">Contact information</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(([label, field, placeholder]) => (
          <div key={field}>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <input value={(data[field] as string) || ''}
              onChange={e => update({ [field]: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]" />
          </div>
        ))}
      </div>
    </Card>
  )
}

function SummaryStep({ data, update, aiImprove, aiLoading }: StepProps) {
  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-white">Professional summary</h2>
      <p className="text-xs text-slate-500 mb-4">2-4 sentences highlighting your expertise and value proposition.</p>
      <textarea rows={5} value={data.summary}
        onChange={e => update({ summary: e.target.value })}
        placeholder="Results-driven software engineer with 5+ years building scalable web applications…"
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)] resize-none mb-3" />
      <Button size="sm" loading={aiLoading} disabled={!data.summary.trim()}
        onClick={async () => { const improved = await aiImprove('professional summary', data.summary); update({ summary: improved }) }}>
        <Sparkles size={12} />AI Improve
      </Button>
    </Card>
  )
}

function ExperienceStep({ data, update, aiImprove, aiLoading }: StepProps) {
  function addExp() {
    update({ experience: [...data.experience, { id: generateId('exp'), company: '', title: '', location: '', dates: '', bullets: [{ id: generateId('bul'), text: '' }] }] })
  }
  function updateExp(i: number, partial: Partial<Experience>) {
    const exp = [...data.experience]; exp[i] = { ...exp[i], ...partial }; update({ experience: exp })
  }
  function removeExp(i: number) { update({ experience: data.experience.filter((_, idx) => idx !== i) }) }
  function addBullet(ei: number) {
    const exp = [...data.experience]
    exp[ei].bullets = [...exp[ei].bullets, { id: generateId('bul'), text: '' }]
    update({ experience: exp })
  }
  function updateBullet(ei: number, bi: number, text: string) {
    const exp = [...data.experience]; exp[ei].bullets[bi] = { ...exp[ei].bullets[bi], text }; update({ experience: exp })
  }

  return (
    <div className="space-y-4">
      {data.experience.map((exp, ei) => (
        <Card key={exp.id}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Experience {ei + 1}</h3>
            <button type="button" aria-label={`Remove experience ${ei + 1}`} onClick={() => removeExp(ei)} className="press grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([['Job Title', 'title'], ['Company', 'company'], ['Dates', 'dates'], ['Location', 'location']] as [string, keyof Experience][]).map(([lbl, fld]) => (
              <div key={fld}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">{lbl}</label>
                <input value={(exp[fld] as string) || ''} onChange={e => updateExp(ei, { [fld]: e.target.value })}
                  placeholder={lbl}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]" />
              </div>
            ))}
          </div>
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 block">Bullet Points</label>
          {exp.bullets.map((bul, bi) => (
            <div key={bul.id} className="flex gap-2 mb-2">
              <span className="text-slate-500 mt-2.5 text-xs shrink-0">•</span>
              <input value={bul.text} onChange={e => updateBullet(ei, bi, e.target.value)}
                placeholder="Achieved X by doing Y, resulting in Z…"
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]" />
              <Button size="sm" loading={aiLoading} disabled={!bul.text.trim()}
                onClick={async () => { const imp = await aiImprove(`job bullet for ${exp.title} at ${exp.company}`, bul.text); updateBullet(ei, bi, imp) }}>
                <Sparkles size={11} />
              </Button>
            </div>
          ))}
          <button type="button" onClick={() => addBullet(ei)} className="mt-1 flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-xs text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-violet-200">
            <Plus size={11} />Add bullet
          </button>
        </Card>
      ))}
      <button type="button" onClick={addExp} className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm text-slate-300 hover:border-violet-300/40 hover:bg-violet-500/[0.06] hover:text-white"><Plus size={15} />Add experience</button>
    </div>
  )
}

function EducationStep({ data, update }: Pick<StepProps, 'data' | 'update'>) {
  function addEdu() {
    update({ education: [...data.education, { id: generateId('edu'), institution: '', degree: '', field: '', dates: '', gpa: '', notes: '' }] })
  }
  function updateEdu(i: number, partial: Partial<Education>) {
    const edu = [...data.education]; edu[i] = { ...edu[i], ...partial }; update({ education: edu })
  }
  return (
    <div className="space-y-4">
      {data.education.map((edu, ei) => (
        <Card key={edu.id}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Education {ei + 1}</h3>
            <button type="button" aria-label={`Remove education ${ei + 1}`} onClick={() => update({ education: data.education.filter((_, i) => i !== ei) })} className="press grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([['Institution', 'institution'], ['Degree', 'degree'], ['Field of Study', 'field'], ['Dates', 'dates'], ['GPA', 'gpa']] as [string, keyof Education][]).map(([lbl, fld]) => (
              <div key={fld}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">{lbl}</label>
                <input value={(edu[fld] as string) || ''} onChange={e => updateEdu(ei, { [fld]: e.target.value })}
                  placeholder={lbl}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]" />
              </div>
            ))}
          </div>
        </Card>
      ))}
      <button type="button" onClick={addEdu} className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm text-slate-300 hover:border-violet-300/40 hover:bg-violet-500/[0.06] hover:text-white"><Plus size={15} />Add education</button>
    </div>
  )
}

function SkillsStep({ data, update }: Pick<StepProps, 'data' | 'update'>) {
  return (
    <div className="space-y-4">
      {data.skills.categories.map((cat, ci) => (
        <Card key={ci}>
          <div className="flex items-center gap-2 mb-3">
            <input value={cat.name} onChange={e => { const cats = [...data.skills.categories]; cats[ci] = { ...cats[ci], name: e.target.value }; update({ skills: { ...data.skills, categories: cats } }) }}
              placeholder="Category (e.g. Languages)"
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]" />
            <button onClick={() => update({ skills: { ...data.skills, categories: data.skills.categories.filter((_, i) => i !== ci) } })} aria-label="Remove category" className="press grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
          </div>
          <input value={cat.items.join(', ')} onChange={e => { const cats = [...data.skills.categories]; cats[ci] = { ...cats[ci], items: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }; update({ skills: { ...data.skills, categories: cats } }) }}
            placeholder="React, TypeScript, Node.js, PostgreSQL"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]" />
        </Card>
      ))}
      <Button onClick={() => update({ skills: { ...data.skills, categories: [...data.skills.categories, { name: '', items: [] }] } })}>
        <Plus size={13} />Add Category
      </Button>
    </div>
  )
}

function PreviewStep({ data }: Pick<StepProps, 'data'>) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">Here&apos;s how your resume looks. You can edit any section after saving.</p>
      <div className="max-h-[640px] overflow-auto rounded-2xl bg-white p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10">
        <div dangerouslySetInnerHTML={{ __html: renderTemplate('classic', data) }} />
      </div>
    </div>
  )
}

interface StepProps {
  data: ResumeData
  update: (partial: Partial<ResumeData>) => void
  aiImprove: (section: string, text: string) => Promise<string>
  aiLoading: boolean
}
