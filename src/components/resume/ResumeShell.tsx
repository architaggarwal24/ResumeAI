// src/components/resume/ResumeShell.tsx
'use client'
import { useEffect } from 'react'
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
import { cn }             from '@/lib/utils'
import SmoothTab, { type SwipeTabItem } from '@/components/vendor/kokonut/smooth-tab'
import type { ResumeRow, AnalysisResult, ResumeTab } from '@/types/resume'
import { BarChart2, Edit3, Zap, Layout, FileText, History, Link2, ChevronLeft, BriefcaseIcon } from 'lucide-react'
import Link from 'next/link'

const TABS: SwipeTabItem[] = [
  { id: 'score',        title: 'Score',        icon: BarChart2 },
  { id: 'editor',       title: 'Edit',         icon: Edit3 },
  { id: 'ats',          title: 'ATS vs JD',    icon: Zap },
  { id: 'interview',    title: 'Interview',    icon: BriefcaseIcon },
  { id: 'templates',    title: 'Templates',    icon: Layout },
  { id: 'cover-letter', title: 'Cover Letter', icon: FileText },
  { id: 'history',      title: 'History',      icon: History },
  { id: 'share',        title: 'Share',        icon: Link2 },
]

interface Props { resume: ResumeRow; initialAnalysis: AnalysisResult | null }

export function ResumeShell({ resume, initialAnalysis }: Props) {
  const { activeTab, setActiveTab, setResumeData, setResumeId, setSelectedTemplate, setAnalysisResult } = useResumeStore()

  useEffect(() => {
    setResumeId(resume.id)
    setResumeData(resume.parsed_data)
    setSelectedTemplate(resume.template_id ?? 'classic')
    if (initialAnalysis) setAnalysisResult(initialAnalysis)
  }, [resume.id]) // eslint-disable-line

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-white/7 bg-[#111214] shrink-0">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ChevronLeft size={18}/>
        </Link>
        <h1 className="font-semibold text-sm truncate flex-1">{resume.name}</h1>
        {resume.ats_score != null && (
          <span className={cn(
            'text-xs font-mono font-bold px-2 py-1 rounded-lg border',
            resume.ats_score >= 70 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
            resume.ats_score >= 45 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                                     'text-red-400 bg-red-400/10 border-red-400/20'
          )}>
            ATS {Math.round(resume.ats_score)}/100
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-4 py-2.5 border-b border-white/7 bg-[#111214] shrink-0 overflow-x-auto">
        <SmoothTab
          items={TABS}
          value={activeTab}
          onChange={id => setActiveTab(id as ResumeTab)}
          label="Resume sections"
          className="min-w-[760px] max-w-3xl"
          activeColor="bg-violet-400"
          activeTextColor="text-[#04241f]"
        />
      </div>

      {/* Content */}
      <div className={cn('flex-1 overflow-y-auto', activeTab === 'interview' && 'overflow-hidden flex flex-col')}>
        <div className={cn('fade-in', activeTab === 'interview' && 'h-full flex flex-col')}>
          {activeTab === 'score'        && <ScoreTab       resumeId={resume.id}/>}
          {activeTab === 'editor'       && <EditorTab      resumeId={resume.id}/>}
          {activeTab === 'ats'          && <ATSTab         resumeId={resume.id}/>}
          {activeTab === 'interview'    && <InterviewTab/>}
          {activeTab === 'templates'    && <TemplatesTab   resumeId={resume.id}/>}
          {activeTab === 'cover-letter' && <CoverLetterTab resumeId={resume.id}/>}
          {activeTab === 'history'      && <HistoryTab     resumeId={resume.id}/>}
          {activeTab === 'share'        && (
            <div className="mx-auto px-6 py-6 max-w-2xl">
              <h2 className="font-bold text-lg mb-6">Share Resume</h2>
              <ShareManager resumeId={resume.id}/>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat Drawer — always available on resume pages */}
      <ChatDrawer/>
    </div>
  )
}
