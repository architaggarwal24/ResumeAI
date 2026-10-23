// src/lib/security/resume-schema.ts
// Server-side normalisation of resume JSON before it is stored, rendered,
// exported or sent to a model. Everything that arrives from the browser or
// from an LLM reply is untrusted: this builds a fresh, fully-typed object, so
// wrong types can't crash the renderers (the public /s/[slug] page renders
// stored data server-side), unknown keys are dropped, and sizes are bounded.
import type { ResumeData, TemplateId } from '@/types/resume'

export const TEMPLATE_IDS: readonly TemplateId[] = ['classic', 'modern', 'minimal', 'executive']
export function isTemplateId(x: unknown): x is TemplateId {
  return typeof x === 'string' && (TEMPLATE_IDS as readonly string[]).includes(x)
}

export const LIMITS = {
  short: 200,       // names, titles, companies, dates, ids…
  long: 5000,       // summary, descriptions
  bullet: 1000,
  experience: 30, education: 20, projects: 30, certifications: 30,
  bullets: 30, categories: 30, items: 60, strings: 50,
} as const

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const id = (v: unknown, fallback: string): string => {
  const s = typeof v === 'string' ? v.slice(0, 64) : ''
  return s || fallback
}

function bullets(v: unknown, prefix: string) {
  return arr(v, LIMITS.bullets).flatMap((b, i) => {
    if (typeof b === 'string') return [{ id: `${prefix}-b${i}`, text: b.slice(0, LIMITS.bullet) }]
    if (isRec(b)) return [{ id: id(b.id, `${prefix}-b${i}`), text: str(b.text, LIMITS.bullet) }]
    return []
  })
}

function strings(v: unknown): string[] {
  return arr(v, LIMITS.strings).filter((x): x is string => typeof x === 'string').map(x => x.slice(0, LIMITS.short))
}

/** Returns a sanitised ResumeData, or null if `input` is not a plain object. */
export function sanitizeResumeData(input: unknown): ResumeData | null {
  if (!isRec(input)) return null
  const skills = isRec(input.skills) ? input.skills : {}

  return {
    name: str(input.name, LIMITS.short),
    email: str(input.email, LIMITS.short),
    phone: str(input.phone, LIMITS.short),
    location: str(input.location, LIMITS.short),
    linkedin: str(input.linkedin, LIMITS.short),
    github: str(input.github, LIMITS.short),
    website: str(input.website, LIMITS.short),
    summary: str(input.summary, LIMITS.long),
    experience: arr(input.experience, LIMITS.experience).filter(isRec).map((e, i) => ({
      id: id(e.id, `exp-${i}`),
      company: str(e.company, LIMITS.short), title: str(e.title, LIMITS.short),
      location: str(e.location, LIMITS.short), dates: str(e.dates, LIMITS.short),
      bullets: bullets(e.bullets, `exp-${i}`),
    })),
    education: arr(input.education, LIMITS.education).filter(isRec).map((e, i) => ({
      id: id(e.id, `edu-${i}`),
      institution: str(e.institution, LIMITS.short), degree: str(e.degree, LIMITS.short),
      field: str(e.field, LIMITS.short), dates: str(e.dates, LIMITS.short),
      gpa: str(e.gpa, 20), notes: str(e.notes, LIMITS.long),
    })),
    skills: {
      categories: arr(skills.categories, LIMITS.categories).filter(isRec).map(c => ({
        name: str(c.name, LIMITS.short),
        items: arr(c.items, LIMITS.items).filter((x): x is string => typeof x === 'string').map(x => x.slice(0, LIMITS.short)),
      })),
    },
    projects: arr(input.projects, LIMITS.projects).filter(isRec).map((p, i) => ({
      id: id(p.id, `proj-${i}`),
      name: str(p.name, LIMITS.short), description: str(p.description, LIMITS.long),
      tech: str(p.tech, LIMITS.short), bullets: bullets(p.bullets, `proj-${i}`),
    })),
    certifications: arr(input.certifications, LIMITS.certifications).filter(isRec).map(c => ({
      name: str(c.name, LIMITS.short), issuer: str(c.issuer, LIMITS.short), date: str(c.date, LIMITS.short),
    })),
    awards: strings(input.awards),
    languages: strings(input.languages),
  }
}
