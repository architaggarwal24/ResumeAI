// src/components/resume/ResumeShell.tsx
'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { BarChart2, Edit3, Zap, Layout, FileText, History, Link2, ChevronLeft, BriefcaseIcon, type LucideIcon } from 'lucide-react'
import { useResumeStore } from '@/store/resumeStore'
import { ScoreTab }       from './ScoreTab'
import { EditorTab }      from './EditorTab'
import { ATSTab }         from './ATSTab'
import { TemplatesTab }   from './TemplatesTab'
import { CoverLetterTab } from './CoverLetterTab'
import { HistoryTab }     from './HistoryTab'
import { ShareManager }   from './ShareManager'
import { InterviewTab }   from './InterviewTab'
import { ChatDrawer }     from '@/components/chat/ChatDrawer'
import { MiniRing }       from '@/components/ui/viz/MiniRing'
import { cn }             from '@/lib/utils'
import { scoreWord, scoreHex } from '@/lib/score'
import { SPRING }         from '@/lib/motion'
import type { ResumeRow, AnalysisResult, ResumeTab } from '@/types/resume'

const TABS: { id: ResumeTab; title: string; icon: LucideIcon }[] = [
  { id: 'score',        title: 'Score',        icon: BarChart2 },
  { id: 'editor',       title: 'Edit',         icon: Edit3 },
  { id: 'ats',          title: 'ATS vs JD',    icon: Zap },
  { id: 'interview',    title: 'Interview',    icon: BriefcaseIcon },
  { id: 'templates',    title: 'Templates',    icon: Layout },
  { id: 'cover-letter', title: 'Cover letter', icon: FileText },
  { id: 'history',      title: 'History',      icon: History },
  { id: 'share',        title: 'Share',        icon: Link2 },
]

interface Props { resume: ResumeRow; initialAnalysis: AnalysisResult | null }

export function ResumeShell({ resume, initialAnalysis }: Props) {
  const { activeTab, setActiveTab, setResumeData, setResumeId, setSelectedTemplate, setAnalysisResult } = useResumeStore()
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setResumeId(resume.id)
    setResumeData(resume.parsed_data)
    setSelectedTemplate(resume.template_id ?? 'classic')
    if (initialAnalysis) setAnalysisResult(initialAnalysis)
  }, [resume.id]) // eslint-disable-line

  // Keep the active tab visible in the scrollable rail.
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeTab])

  function onRailKey(e: React.KeyboardEvent) {
    const i = TABS.findIndex(t => t.id === activeTab)
    if (e.key === 'ArrowRight') { e.preventDefault(); setActiveTab(TABS[(i + 1) % TABS.length].id) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setActiveTab(TABS[(i - 1 + TABS.length) % TABS.length].id) }
  }

  const score = resume.ats_score

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="glass relative rounded-3xl">
          <span aria-hidden className="edge" />
          <div className="flex items-center gap-3 px-3 pb-2 pt-3 sm:px-4">
            <Link href="/dashboard" aria-label="Back to dashboard" className="press grid size-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-white">
              <ChevronLeft size={18} />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">{resume.name}</h1>
              <p className="text-xs text-slate-500">{score != null ? <span style={{ color: scoreHex(score) }}>{scoreWord(score)}</span> : 'Not scored yet'} · <span className="capitalize">{resume.template_id ?? 'classic'}</span> template</p>
            </div>
            {score != null && <MiniRing score={score} size={46} />}
          </div>

          {/* Tab rail */}
          <div ref={railRef} role="tablist" aria-label="Resume sections" onKeyDown={onRailKey}
            className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, title, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  data-tab={id}
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(id)}
                  className={cn('press relative flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors', active ? 'text-white' : 'text-slate-400 hover:text-slate-100')}
                >
                  {active && (
                    <motion.span layoutId="resume-tab" transition={SPRING.snappy}
                      className="absolute inset-0 rounded-xl border border-violet-300/30 bg-[linear-gradient(180deg,rgba(139,92,246,.35),rgba(109,40,217,.25))] shadow-[0_0_24px_-6px_rgba(139,92,246,.9)]" />
                  )}
                  <Icon size={15} className="relative" />
                  <span className="relative whitespace-nowrap">{title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={cn('flex-1 overflow-y-auto', activeTab === 'interview' && 'flex flex-col overflow-hidden')}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={SPRING.soft}
            className={cn(activeTab === 'interview' && 'flex h-full flex-col')}
          >
            {activeTab === 'score'        && <ScoreTab       resumeId={resume.id}/>}
            {activeTab === 'editor'       && <EditorTab      resumeId={resume.id}/>}
            {activeTab === 'ats'          && <ATSTab         resumeId={resume.id}/>}
            {activeTab === 'interview'    && <InterviewTab/>}
            {activeTab === 'templates'    && <TemplatesTab   resumeId={resume.id}/>}
            {activeTab === 'cover-letter' && <CoverLetterTab resumeId={resume.id}/>}
            {activeTab === 'history'      && <HistoryTab     resumeId={resume.id}/>}
            {activeTab === 'share'        && (
              <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
                <h2 className="mb-1 text-2xl font-semibold tracking-tight text-white">Share resume</h2>
                <p className="mb-6 text-sm text-slate-400">Private links with optional password and expiry. Revoke any time.</p>
                <ShareManager resumeId={resume.id}/>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* AI Chat Drawer — always available on resume pages */}
      <ChatDrawer/>
    </div>
  )
}
