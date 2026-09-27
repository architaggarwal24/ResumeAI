// src/components/resume/ScoreTab.tsx
'use client'
import { useState } from 'react'
import { useResumeStore, hashResumeData } from '@/store/resumeStore'
import { Button, SectionBlock, StrengthBadge, ScoreBar, Badge } from '@/components/ui/primitives'
import { PointerSuggestion } from './PointerSuggestion'
import { GenerateSectionBox } from './GenerateSectionBox'
import { SectionSuggestion } from './SectionSuggestion'
import {
  RefreshCw, TrendingUp, AlertTriangle, CheckCircle, User,
  FileText, Briefcase, Wrench, GraduationCap, FolderGit2, ChevronDown,
  Undo2, Redo2, X, Sparkles, Check, Download,
} from 'lucide-react'
import { scoreColor, cn, generateId } from '@/lib/utils'
import { applyResumeEdit } from '@/lib/resumeEdits'
import type { AnalysisResult, Strength, GenerateSectionResult, GeneratableSection, SectionImproveResult } from '@/types/resume'

const SECTION_META = {
  summary:    { label: 'Summary',    icon: FileText },
  experience: { label: 'Experience', icon: Briefcase },
  skills:     { label: 'Skills',     icon: Wrench },
  education:  { label: 'Education',  icon: GraduationCap },
  projects:   { label: 'Projects',   icon: FolderGit2 },
} as const

const SECTION_ORDER = ['summary', 'experience', 'skills', 'education', 'projects'] as const

// Coerce LLM response arrays — sometimes returned as string, null, or missing
function asArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return [val]
  return []
}

function normalizeAnalysis(r: AnalysisResult): AnalysisResult {
  return {
    ...r,
    atsScore:          Math.max(0, Math.min(100, Math.round(r.atsScore ?? 0))),
    topWins:           asArray(r.topWins) as string[],
    missingKeywords:   asArray(r.missingKeywords) as string[],
    topFixes:          asArray(r.topFixes) as AnalysisResult['topFixes'],
    buzzwordsToRemove: asArray(r.buzzwordsToRemove) as string[],
    trendingSkills:    asArray(r.trendingSkills) as string[],
    recruiterVerdict: r.recruiterVerdict ? {
      ...r.recruiterVerdict,
      strengths: asArray(r.recruiterVerdict.strengths) as string[],
      gaps:      asArray(r.recruiterVerdict.gaps) as string[],
    } : r.recruiterVerdict,
    sections: r.sections ? Object.fromEntries(
      Object.entries(r.sections).map(([k, v]) => [k, v ? {
        ...v,
        score: Math.max(0, Math.min(100, Math.round(v.score ?? 0))),
        reasons: asArray(v.reasons) as string[],
      } : v])
    ) as AnalysisResult['sections'] : r.sections,
  }
}

const ringColor = (score: number) =>
  score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'

// Whether a section is empty enough to offer AI generation for it
function isSectionEmpty(section: GeneratableSection, resumeData: ScoreTabResumeData | null): boolean {
  if (!resumeData) return false
  switch (section) {
    case 'summary':    return !resumeData.summary?.trim()
    case 'experience': return (resumeData.experience?.length ?? 0) === 0
    case 'education':  return (resumeData.education?.length ?? 0) === 0
    case 'projects':   return (resumeData.projects?.length ?? 0) === 0
    case 'skills':     return (resumeData.skills?.categories?.length ?? 0) === 0
    default:           return false
  }
}

// Minimal shape used by isSectionEmpty — avoids importing the full ResumeData
// type just for this check while still being type-safe against it.
type ScoreTabResumeData = {
  summary: string
  experience: unknown[]
  education: unknown[]
  projects: unknown[]
  skills: { categories?: unknown[] }
}

export function ScoreTab({ resumeId }: { resumeId: string }) {
  const {
    resumeData, analysisResult, byokCreds, lastAnalyzedHash, selectedTemplate,
    setAnalysisResult, loading, setLoading, addToast, updateResumeFieldSilent,
    undo, redo, undoPast, undoFuture,
  } = useResumeStore()
  const currentHash = hashResumeData(resumeData)
  const isStale = !!analysisResult && !!lastAnalyzedHash && currentHash !== lastAnalyzedHash
  const [downloading, setDownloading] = useState(false)

  // Quick PDF download for whoever changed their resume (via a fix, an edit,
  // an apply) and just wants the updated file — no need to visit the
  // Templates tab and pick a format first. Only ever shown when isStale is
  // true, i.e. the resume differs from what was last analyzed.
  async function quickDownload() {
    if (!resumeData) return
    setDownloading(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData, templateId: selectedTemplate, format: 'pdf' }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${(resumeData.name || 'resume').replace(/\s+/g, '_')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      addToast('PDF downloaded', 'success')
    } catch {
      addToast('Download failed', 'error')
    }
    setDownloading(false)
  }

  async function runScoring() {
    if (!resumeData || !byokCreds.apiKey) {
      addToast('Add your API key first', 'error'); return
    }
    setLoading('analyzing', true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, resumeData, creds: byokCreds, type: 'score' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAnalysisResult(normalizeAnalysis(data.result))
      addToast('Score updated', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Scoring failed', 'error')
    }
    setLoading('analyzing', false)
  }

  // Which Top Fixes (by index in safeResult.topFixes) have been applied —
  // resets naturally on the next analysis since it's just component state.
  const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set())

  // Apply one ranked Top Fix to the actual resume data. Reuses the same
  // fuzzy-match-by-text utility the AI Coach chat uses to apply its own
  // proposed edits — a TopFix has no targetId, only the exact "before" text,
  // which is exactly the fallback path applyResumeEdit already supports.
  function applyTopFix(fix: AnalysisResult['topFixes'][number], idx: number) {
    if (!resumeData) return
    const next = applyResumeEdit(resumeData, {
      targetId: '', section: fix.section, original: fix.before, suggested: fix.after,
    })
    if (!next) {
      addToast("Couldn't find that exact text to replace — it may have changed since this analysis ran. Edit it directly in the Editor tab instead.", 'error')
      return
    }
    updateResumeFieldSilent(() => next)
    setAppliedFixes(p => new Set(p).add(idx))
    addToast('Fix applied — review in the Edit tab', 'success')
  }

  // Apply a per-pointer suggestion to the actual resume data
  function applySummary(newText: string) {
    updateResumeFieldSilent(p => ({ ...p, summary: newText }))
  }
  function applyExperienceBullet(expIdx: number, bulIdx: number, newText: string) {
    updateResumeFieldSilent(p => {
      const experience = [...p.experience]
      const bullets = [...(experience[expIdx].bullets || [])]
      bullets[bulIdx] = { ...bullets[bulIdx], text: newText }
      experience[expIdx] = { ...experience[expIdx], bullets }
      return { ...p, experience }
    })
  }
  function applyProjectBullet(projIdx: number, bulIdx: number, newText: string) {
    updateResumeFieldSilent(p => {
      const projects = [...p.projects]
      const bullets = [...(projects[projIdx].bullets || [])]
      bullets[bulIdx] = { ...bullets[bulIdx], text: newText }
      projects[projIdx] = { ...projects[projIdx], bullets }
      return { ...p, projects }
    })
  }

  // Merge AI-generated content for an empty section into the resume
  function applyGenerated(section: GeneratableSection, result: GenerateSectionResult) {
    updateResumeFieldSilent(p => {
      switch (section) {
        case 'summary':
          return result.summary ? { ...p, summary: result.summary } : p

        case 'experience':
          return {
            ...p,
            experience: [
              ...p.experience,
              ...(result.experience ?? []).map(exp => ({
                id: generateId('exp'),
                title: exp.title || '',
                company: exp.company || '',
                location: exp.location || '',
                dates: exp.dates || '',
                bullets: (exp.bullets || []).map(text => ({ id: generateId('bul'), text })),
              })),
            ],
          }

        case 'education':
          return {
            ...p,
            education: [
              ...p.education,
              ...(result.education ?? []).map(edu => ({
                id: generateId('edu'),
                institution: edu.institution || '',
                degree: edu.degree || '',
                field: edu.field || '',
                dates: edu.dates || '',
                gpa: edu.gpa || '',
                notes: '',
              })),
            ],
          }

        case 'projects':
          return {
            ...p,
            projects: [
              ...p.projects,
              ...(result.projects ?? []).map(proj => ({
                id: generateId('proj'),
                name: proj.name || '',
                description: proj.description || '',
                tech: proj.tech || '',
                bullets: (proj.bullets || []).map(text => ({ id: generateId('pbul'), text })),
              })),
            ],
          }

        case 'skills':
          return result.skills?.categories?.length
            ? { ...p, skills: { ...p.skills, categories: [...(p.skills?.categories || []), ...result.skills.categories] } }
            : p

        default:
          return p
      }
    })
  }

  const isLoading = loading.analyzing

  // Apply a full section-wide suggestion (Skills/Education) — replaces the
  // section's content wholesale with the suggested version
  function applySectionImprove(section: 'skills' | 'education', result: SectionImproveResult) {
    updateResumeFieldSilent(p => {
      if (section === 'skills' && result.skills) {
        return { ...p, skills: { ...p.skills, categories: result.skills.categories } }
      }
      if (section === 'education' && result.education) {
        return {
          ...p,
          education: result.education.map(edu => ({
            id: generateId('edu'),
            institution: edu.institution || '',
            degree: edu.degree || '',
            field: edu.field || '',
            dates: edu.dates || '',
            gpa: edu.gpa || '',
            notes: edu.notes || '',
          })),
        }
      }
      return p
    })
  }

  // Normalize on load (guards against bad DB-stored results)
  const safeResult = analysisResult ? normalizeAnalysis(analysisResult) : null

  // Auto-trigger if no result yet
  if (!safeResult && !isLoading && resumeData && byokCreds.apiKey) {
    setTimeout(runScoring, 100)
  }

  // Which section scores lowest — open that one by default so users land on
  // the thing that needs the most attention
  const weakestSection = safeResult
    ? SECTION_ORDER
        .filter(k => safeResult.sections?.[k])
        .sort((a, b) => safeResult.sections[a].score - safeResult.sections[b].score)[0]
    : null

  return (
    <div className="mx-auto px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Resume Analysis</h2>
          <p className="text-xs text-slate-600 mt-0.5">Scores may vary ±5 pts between runs — LLMs are non-deterministic by nature</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { undo(); addToast('Undo', 'info', 1500) }}
            disabled={undoPast.length === 0}
            title="Undo (Ctrl+Z)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/7 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => { redo(); addToast('Redo', 'info', 1500) }}
            disabled={undoFuture.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/7 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <Button onClick={runScoring} loading={isLoading} size="sm">
            <RefreshCw size={13} />
            {isLoading ? 'Analyzing…' : 'Re-analyze'}
          </Button>
        </div>
      </div>

      {/* ─── Stale-analysis banner ─────────────────────────────────────── */}
      {isStale && !isLoading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-300 font-medium leading-none mb-0.5">Resume changed since last analysis</p>
            <p className="text-xs text-amber-400/70">These scores reflect an earlier version of your resume.</p>
          </div>
          <button
            onClick={quickDownload}
            disabled={downloading}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download size={12} />{downloading ? 'Downloading…' : 'Download PDF'}
          </button>
          <button
            onClick={runScoring}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25 transition-colors"
          >
            Re-analyze now
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !analysisResult && (
        <div className="space-y-3">
          <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}

      {!analysisResult && !isLoading && !byokCreds.apiKey && (
        <div className="text-center py-16 text-slate-500">
          <p className="mb-2">Add your API key to analyze this resume.</p>
          <p className="text-xs">Go to Upload → or use the BYOK panel.</p>
        </div>
      )}

      {safeResult && (
        <div className="space-y-4 fade-in">
          {/* ─── Hero: score + verdict in one glance ─────────────────────── */}
          <div className="bg-[#16161d] border border-white/7 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
            <ScoreRing score={safeResult.atsScore} />

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">ATS Score</span>
                {safeResult.recruiterVerdict && <VerdictBadge verdict={safeResult.recruiterVerdict.verdict} />}
              </div>
              {safeResult.recruiterVerdict && (
                <p className="text-sm text-slate-300 leading-relaxed">{safeResult.recruiterVerdict.headline}</p>
              )}
            </div>
          </div>

          {/* ─── Section breakdown — compact collapsible rows ────────────── */}
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 px-1">Section Breakdown</p>
            <div className="space-y-2">
              {SECTION_ORDER.map(key => {
                const s = safeResult.sections?.[key]
                if (!s) return null
                return (
                  <SectionRow
                    key={key}
                    sectionKey={key}
                    score={s}
                    defaultOpen={key === weakestSection}
                  >
                    {s.reasons?.length > 0 && (
                      <ul className="space-y-1 mb-2.5">
                        {s.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                            <span className="mt-0.5 shrink-0">•</span>{r}
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.quickFix && (
                      <div className="mb-3 px-3 py-2 bg-violet-500/8 border border-violet-500/15 rounded-lg text-xs text-violet-300">
                        💡 {s.quickFix}
                      </div>
                    )}

                    {/* Per-pointer suggestions */}
                    {key === 'summary' && resumeData?.summary?.trim() && (
                      <div className="pt-2 border-t border-white/7">
                        <p className="text-xs text-slate-300 leading-relaxed">{resumeData.summary}</p>
                        <PointerSuggestion
                          resumeId={resumeId}
                          targetId="summary"
                          sectionContext="Resume summary"
                          currentText={resumeData.summary}
                          currentAtsScore={safeResult.atsScore}
                          onApply={applySummary}
                        />
                      </div>
                    )}
                    {key === 'summary' && isSectionEmpty('summary', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <GenerateSectionBox
                          resumeId={resumeId}
                          section="summary"
                          label="Summary"
                          onApply={r => applyGenerated('summary', r)}
                        />
                      </div>
                    )}

                    {key === 'experience' && (resumeData?.experience?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-white/7 space-y-3.5">
                        {resumeData!.experience.map((exp, ei) => (
                          <div key={exp.id || ei}>
                            <p className="text-xs font-semibold text-slate-300 mb-1.5">
                              {exp.title}{exp.company ? ` · ${exp.company}` : ''}
                            </p>
                            <div className="space-y-2">
                              {exp.bullets?.map((bul, bi) => (
                                <div key={bul.id || bi}>
                                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                                    <span className="mt-0.5 shrink-0">•</span>
                                    <span>{bul.text}</span>
                                  </div>
                                  <PointerSuggestion
                                    resumeId={resumeId}
                                    targetId={bul.id || `exp_${ei}_bul_${bi}`}
                                    sectionContext={`Resume bullet for ${exp.title} at ${exp.company}`}
                                    currentText={bul.text}
                                    currentAtsScore={safeResult.atsScore}
                                    onApply={txt => applyExperienceBullet(ei, bi, txt)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {key === 'experience' && isSectionEmpty('experience', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <GenerateSectionBox
                          resumeId={resumeId}
                          section="experience"
                          label="Experience"
                          onApply={r => applyGenerated('experience', r)}
                        />
                      </div>
                    )}

                    {key === 'projects' && (resumeData?.projects?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-white/7 space-y-3.5">
                        {resumeData!.projects.map((proj, pi) => (
                          <div key={proj.id || pi}>
                            <p className="text-xs font-semibold text-slate-300 mb-1.5">{proj.name}</p>
                            <div className="space-y-2">
                              {proj.bullets?.map((bul, bi) => (
                                <div key={bul.id || bi}>
                                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                                    <span className="mt-0.5 shrink-0">•</span>
                                    <span>{bul.text}</span>
                                  </div>
                                  <PointerSuggestion
                                    resumeId={resumeId}
                                    targetId={bul.id || `proj_${pi}_bul_${bi}`}
                                    sectionContext={`Resume bullet for project ${proj.name}`}
                                    currentText={bul.text}
                                    currentAtsScore={safeResult.atsScore}
                                    onApply={txt => applyProjectBullet(pi, bi, txt)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {key === 'projects' && isSectionEmpty('projects', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <GenerateSectionBox
                          resumeId={resumeId}
                          section="projects"
                          label="Projects"
                          onApply={r => applyGenerated('projects', r)}
                        />
                      </div>
                    )}

                    {key === 'education' && isSectionEmpty('education', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <GenerateSectionBox
                          resumeId={resumeId}
                          section="education"
                          label="Education"
                          onApply={r => applyGenerated('education', r)}
                        />
                      </div>
                    )}
                    {key === 'education' && !isSectionEmpty('education', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <SectionSuggestion
                          resumeId={resumeId}
                          section="education"
                          currentAtsScore={safeResult.atsScore}
                          onApply={r => applySectionImprove('education', r)}
                        />
                      </div>
                    )}

                    {key === 'skills' && isSectionEmpty('skills', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <GenerateSectionBox
                          resumeId={resumeId}
                          section="skills"
                          label="Skills"
                          onApply={r => applyGenerated('skills', r)}
                        />
                      </div>
                    )}
                    {key === 'skills' && !isSectionEmpty('skills', resumeData) && (
                      <div className="pt-2 border-t border-white/7">
                        <SectionSuggestion
                          resumeId={resumeId}
                          section="skills"
                          currentAtsScore={safeResult.atsScore}
                          onApply={r => applySectionImprove('skills', r)}
                        />
                      </div>
                    )}
                  </SectionRow>
                )
              })}
            </div>
          </div>

          {/* ─── Insights — collapsed by default to reduce clutter ────────── */}
          <SectionBlock
            title="Insights"
            icon={<TrendingUp size={14} className="text-slate-400" />}
            badge={
              <div className="flex items-center gap-1.5">
                {safeResult.topWins?.length > 0 && <Badge variant="low">{safeResult.topWins.length} wins</Badge>}
                {safeResult.topFixes?.length > 0 && <Badge variant="high">{safeResult.topFixes.length} fixes</Badge>}
                {safeResult.missingKeywords?.length > 0 && <Badge variant="medium">{safeResult.missingKeywords.length} keywords</Badge>}
              </div>
            }
            defaultOpen={false}
          >
            <div className="space-y-5">

              {/* Diagnoser: Top Fixes ranked by impact */}
              {safeResult.topFixes?.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} />Top Fixes — ranked by impact
                  </p>
                  <div className="space-y-2">
                    {safeResult.topFixes.map((fix, i) => (
                      <div key={i} className="border border-white/7 rounded-xl overflow-hidden bg-[#1c1c24]">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/7">
                          <span className={cn('text-xs font-mono font-bold w-4 text-center',
                            fix.impact === 'high' ? 'text-red-400' :
                            fix.impact === 'medium' ? 'text-amber-400' : 'text-slate-400')}>
                            #{fix.rank}
                          </span>
                          <span className="text-xs text-slate-500 capitalize">{fix.section}</span>
                          <span className={cn('ml-auto text-xs px-1.5 py-0.5 rounded-full border',
                            fix.impact === 'high'   ? 'bg-red-400/10 text-red-400 border-red-400/20' :
                            fix.impact === 'medium' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                                                       'bg-white/5 text-slate-500 border-white/10')}>
                            {fix.impact}
                          </span>
                        </div>
                        <div className="px-3 py-2 space-y-1.5">
                          <p className="text-xs text-slate-500">{fix.problem}</p>
                          {fix.before && (
                            <p className="text-xs text-red-400/70 line-through leading-relaxed">{fix.before}</p>
                          )}
                          {fix.after && (
                            <p className="text-xs text-emerald-400 leading-relaxed">{fix.after}</p>
                          )}
                        </div>
                        {fix.before && fix.after && (
                          <div className="px-3 py-2 border-t border-white/7">
                            {appliedFixes.has(i) ? (
                              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                                <Check size={11} />Applied — review in the Edit tab
                              </span>
                            ) : (
                              <Button variant="success" size="sm" onClick={() => applyTopFix(fix, i)}>
                                <Check size={11} />Apply fix
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recruiter: Trending Skills to add */}
              {safeResult.trendingSkills?.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} />Trending Skills to Add (2026)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {safeResult.trendingSkills.map((s, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recruiter: Buzzwords to remove */}
              {safeResult.buzzwordsToRemove?.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <X size={11} />Buzzwords to Cut
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {safeResult.buzzwordsToRemove.map((b, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-400/8 text-red-400/80 border border-red-400/15 rounded-full line-through">&ldquo;{b}&rdquo;</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {safeResult.topWins?.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} />Strengths
                  </p>
                  <div className="space-y-1">
                    {safeResult.topWins.map((w, i) => (
                      <p key={i} className="text-xs text-emerald-400 flex items-start gap-1.5">
                        <CheckCircle size={11} className="mt-0.5 shrink-0" />{w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Keywords */}
              {safeResult.missingKeywords?.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} />Missing Keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {safeResult.missingKeywords.map((k, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full">{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical Gaps */}
              {safeResult.recruiterVerdict?.gaps?.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} />Critical Gaps
                  </p>
                  <div className="space-y-1">
                    {safeResult.recruiterVerdict.gaps.map((g, i) => (
                      <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />{g}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Fixes — one-click AI draft for any core section that's
                  still empty, with the same generate/preview/apply flow used
                  in the Sections tab above, not just a description of the problem. */}
              {SECTION_ORDER.some(s => isSectionEmpty(s, resumeData)) && (
                <div>
                  <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                    <Sparkles size={11} />Quick Fixes
                  </p>
                  <div className="space-y-3">
                    {SECTION_ORDER.filter(s => isSectionEmpty(s, resumeData)).map(s => (
                      <div key={s}>
                        <p className="text-xs text-slate-400 mb-1">Missing {SECTION_META[s].label.toLowerCase()}</p>
                        <GenerateSectionBox
                          resumeId={resumeId}
                          section={s}
                          label={SECTION_META[s].label}
                          onApply={r => applyGenerated(s, r)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </SectionBlock>
        </div>
      )}
    </div>
  )
}

// ─── Score ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, score)) / 100)
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 84 84" className="w-24 h-24 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
        <circle
          cx="42" cy="42" r={r} fill="none" stroke={ringColor(score)} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold font-mono', scoreColor(score))}>{score}</span>
        <span className="text-[10px] text-slate-500 -mt-0.5">/100</span>
      </div>
    </div>
  )
}

// ─── Section row (collapsible) ─────────────────────────────────────────────

function SectionRow({
  sectionKey, score, defaultOpen, children,
}: {
  sectionKey: keyof typeof SECTION_META
  score: { score: number; strength: Strength; reasons: string[]; quickFix: string | null }
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const meta = SECTION_META[sectionKey]
  const Icon = meta.icon

  return (
    <div className="border border-white/7 rounded-xl overflow-hidden bg-[#16161d]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
      >
        <Icon size={15} className="text-slate-500 shrink-0" />
        <span className="text-sm font-medium text-slate-200 w-24 shrink-0">{meta.label}</span>
        <div className="flex-1 min-w-0">
          <ScoreBar value={score.score} />
        </div>
        <span className={cn('text-xs font-mono w-10 text-right shrink-0', scoreColor(score.score))}>{score.score}</span>
        <StrengthBadge strength={score.strength} />
        <ChevronDown size={15} className={cn('text-slate-500 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/7 fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    strong_yes: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
    yes:        'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    maybe:      'bg-amber-400/10 text-amber-400 border-amber-400/20',
    no:         'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labels: Record<string, string> = {
    strong_yes: '✓ Strong Yes', yes: '✓ Yes', maybe: '~ Maybe', no: '✗ No'
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border', styles[verdict] || styles['maybe'])}>
      <User size={11} />
      {labels[verdict] || verdict}
    </span>
  )
}
