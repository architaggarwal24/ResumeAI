'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useResumeStore } from '@/store/resumeStore'
import { callLLM } from '@/lib/llm/client'
import { RESUME_BUILD_PROMPT } from '@/lib/llm/prompts'
import { generateId } from '@/lib/utils'
import { Button, Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { renderTemplate } from '@/lib/templates/render'
import { Sparkles, ChevronRight, ChevronLeft, Check, Plus, Trash2, User, Briefcase, GraduationCap, Code2, FolderOpen, Eye } from 'lucide-react'
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
      addToast('AI improved your text ✓', 'success')
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

  return (
    <div className="mx-auto px-8 py-8 max-w-3xl fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Build Resume</h1>
        <p className="text-slate-400 text-sm">Create a resume from scratch, step by step.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                i === step   ? 'bg-violet-600 text-white' :
                i < step     ? 'bg-violet-600/20 text-violet-400 cursor-pointer hover:bg-violet-600/30' :
                               'bg-white/5 text-slate-600 cursor-default'
              )}>
              {i < step ? <Check size={11} /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={cn('flex-1 h-px', i < step ? 'bg-violet-600/40' : 'bg-white/8')} />}
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="fade-in">
        {step === 0 && <ContactStep data={data} update={update} aiImprove={aiImprove} aiLoading={aiLoading} />}
        {step === 1 && <SummaryStep data={data} update={update} aiImprove={aiImprove} aiLoading={aiLoading} />}
        {step === 2 && <ExperienceStep data={data} update={update} aiImprove={aiImprove} aiLoading={aiLoading} />}
        {step === 3 && <EducationStep data={data} update={update} />}
        {step === 4 && <SkillsStep data={data} update={update} />}
        {step === 5 && <PreviewStep data={data} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button onClick={() => setStep(p => p - 1)} disabled={step === 0}>
          <ChevronLeft size={14} />Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => setStep(p => p + 1)} disabled={!canGoNext()}>
            Next <ChevronRight size={14} />
          </Button>
        ) : (
          <Button variant="primary" onClick={saveAndRedirect} loading={saving}>
            <Check size={14} />Save & Analyze
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
      <h2 className="font-bold mb-4">Contact Information</h2>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([label, field, placeholder]) => (
          <div key={field}>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <input value={(data[field] as string) || ''}
              onChange={e => update({ [field]: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
          </div>
        ))}
      </div>
    </Card>
  )
}

function SummaryStep({ data, update, aiImprove, aiLoading }: StepProps) {
  return (
    <Card>
      <h2 className="font-bold mb-1">Professional Summary</h2>
      <p className="text-xs text-slate-500 mb-4">2-4 sentences highlighting your expertise and value proposition.</p>
      <textarea rows={5} value={data.summary}
        onChange={e => update({ summary: e.target.value })}
        placeholder="Results-driven software engineer with 5+ years building scalable web applications…"
        className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none mb-3" />
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
            <button onClick={() => removeExp(ei)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {([['Job Title', 'title'], ['Company', 'company'], ['Dates', 'dates'], ['Location', 'location']] as [string, keyof Experience][]).map(([lbl, fld]) => (
              <div key={fld}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">{lbl}</label>
                <input value={(exp[fld] as string) || ''} onChange={e => updateExp(ei, { [fld]: e.target.value })}
                  placeholder={lbl}
                  className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
              </div>
            ))}
          </div>
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 block">Bullet Points</label>
          {exp.bullets.map((bul, bi) => (
            <div key={bul.id} className="flex gap-2 mb-2">
              <span className="text-slate-600 mt-2.5 text-xs shrink-0">•</span>
              <input value={bul.text} onChange={e => updateBullet(ei, bi, e.target.value)}
                placeholder="Achieved X by doing Y, resulting in Z…"
                className="flex-1 bg-[#1c1c24] border border-white/8 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
              <Button size="sm" loading={aiLoading} disabled={!bul.text.trim()}
                onClick={async () => { const imp = await aiImprove(`job bullet for ${exp.title} at ${exp.company}`, bul.text); updateBullet(ei, bi, imp) }}>
                <Sparkles size={11} />
              </Button>
            </div>
          ))}
          <button onClick={() => addBullet(ei)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition-colors mt-1">
            <Plus size={11} />Add bullet
          </button>
        </Card>
      ))}
      <Button onClick={addExp}><Plus size={13} />Add Experience</Button>
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
            <button onClick={() => update({ education: data.education.filter((_, i) => i !== ei) })} className="text-slate-600 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([['Institution', 'institution'], ['Degree', 'degree'], ['Field of Study', 'field'], ['Dates', 'dates'], ['GPA', 'gpa']] as [string, keyof Education][]).map(([lbl, fld]) => (
              <div key={fld}>
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">{lbl}</label>
                <input value={(edu[fld] as string) || ''} onChange={e => updateEdu(ei, { [fld]: e.target.value })}
                  placeholder={lbl}
                  className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
              </div>
            ))}
          </div>
        </Card>
      ))}
      <Button onClick={addEdu}><Plus size={13} />Add Education</Button>
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
              className="flex-1 bg-[#1c1c24] border border-white/8 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50" />
            <button onClick={() => update({ skills: { ...data.skills, categories: data.skills.categories.filter((_, i) => i !== ci) } })} className="text-slate-600 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
          <input value={cat.items.join(', ')} onChange={e => { const cats = [...data.skills.categories]; cats[ci] = { ...cats[ci], items: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }; update({ skills: { ...data.skills, categories: cats } }) }}
            placeholder="React, TypeScript, Node.js, PostgreSQL"
            className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
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
      <p className="text-sm text-slate-400 mb-4">Here's how your resume looks. You can edit any section after saving.</p>
      <div className="bg-white rounded-xl p-6 overflow-auto max-h-[600px]">
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
