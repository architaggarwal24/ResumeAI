// ─── Resume Data ──────────────────────────────────────────────────────────────

export interface Bullet {
  id: string
  text: string
}

export interface Experience {
  id: string
  company: string
  title: string
  location: string
  dates: string
  bullets: Bullet[]
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  dates: string
  gpa: string
  notes: string
}

export interface SkillCategory {
  name: string
  items: string[]
}

export interface Skills {
  categories: SkillCategory[]
}

export interface Project {
  id: string
  name: string
  description: string
  bullets: Bullet[]
  tech: string
}

export interface Certification {
  name: string
  issuer: string
  date: string
}

export interface ResumeData {
  name: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  website: string
  summary: string
  experience: Experience[]
  education: Education[]
  skills: Skills
  projects: Project[]
  certifications: Certification[]
  awards: string[]
  languages: string[]
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export type Strength = 'strong' | 'ok' | 'weak'

export interface SectionScore {
  strength: Strength
  score: number
  reasons: string[]
  quickFix: string | null
}

export interface RecruiterVerdict {
  verdict: 'strong_yes' | 'yes' | 'maybe' | 'no'
  headline: string
  strengths: string[]
  gaps: string[]
}

export interface AnalysisResult {
  atsScore: number
  recruiterVerdict: RecruiterVerdict
  sections: {
    summary: SectionScore
    experience: SectionScore
    skills: SectionScore
    education: SectionScore
    projects: SectionScore
  }
  missingKeywords: string[]
  topWins: string[]
}

// ─── ATS / Suggestions ────────────────────────────────────────────────────────

export type SuggestionPriority = 'high' | 'medium' | 'low'
export type SuggestionCategory = 'keyword' | 'impact' | 'formatting' | 'structure'
export type SuggestionStatus = 'pending' | 'accepted' | 'ignored'

export interface Suggestion {
  id: string
  targetId: string
  section: string
  priority: SuggestionPriority
  category: SuggestionCategory
  original: string
  suggested: string
  reason: string
  status: SuggestionStatus
}

export interface ATSBreakdown {
  keywords: number
  impact: number
  formatting: number
  completeness: number
}

export interface ATSResult {
  atsScore: {
    before: number
    after: number
    breakdown: ATSBreakdown
  }
  suggestions: Suggestion[]
  missingKeywords: string[]
}

// ─── Cover Letter ─────────────────────────────────────────────────────────────

export type CoverLetterTone = 'professional' | 'enthusiastic' | 'concise' | 'storytelling'

export interface CoverLetter {
  id: string
  resumeId: string
  jobDescription: string
  tone: CoverLetterTone
  content: string
  createdAt: string
}

// ─── DB Row types (from Supabase) ─────────────────────────────────────────────

export interface ResumeRow {
  id: string
  user_id: string
  name: string
  raw_text: string
  parsed_data: ResumeData
  template_id: TemplateId
  ats_score: number | null
  created_at: string
  updated_at: string
}

export interface AnalysisRow {
  id: string
  resume_id: string
  job_description: string | null
  score: number
  result: AnalysisResult
  created_at: string
}

export interface CoverLetterRow {
  id: string
  resume_id: string
  job_description: string
  tone: CoverLetterTone
  content: string
  created_at: string
}

export interface UserRow {
  id: string
  email: string
  tier: 'free' | 'pro'
  provider: LLMProvider | null
  model: string | null
  analyses_count: number
  created_at: string
}

// ─── LLM / BYOK ───────────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'nvidia'

// Per-provider credentials stored separately so switching tabs doesn't wipe keys
export type PerProviderKeys = Partial<Record<LLMProvider, string>>

export interface BYOKCreds {
  provider: LLMProvider
  apiKey: string
  model: string
}

export interface LLMOptions {
  creds: BYOKCreds
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type TemplateId = 'classic' | 'modern' | 'minimal' | 'executive'

export interface Template {
  id: TemplateId
  name: string
  description: string
  accentColor: string
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ResumeTab = 'score' | 'editor' | 'ats' | 'templates' | 'cover-letter' | 'history' | 'share'

export type ToastType = 'success' | 'error' | 'info' | 'loading'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

// ─── Analytics (M13) ──────────────────────────────────────────────────────────

export interface ScoreDataPoint {
  date: string
  score: number
  label: string
  analysisId: string
}

export interface ResumeAnalyticsSummary {
  resumeId: string
  resumeName: string
  currentScore: number | null
  peakScore: number | null
  firstScore: number | null
  totalAnalyses: number
  improvement: number | null
  scoreHistory: ScoreDataPoint[]
}

export interface AnalyticsDashboard {
  totalAnalyses: number
  totalResumes: number
  avgScore: number | null
  bestScore: number | null
  mostImproved: { resumeId: string; resumeName: string; improvement: number } | null
  resumes: ResumeAnalyticsSummary[]
}

// ─── Interview Prep (M15) ────────────────────────────────────────────────────

export type QuestionType = 'behavioral' | 'technical' | 'situational' | 'culture'

export interface InterviewQuestion {
  id: string
  type: QuestionType
  question: string
  modelAnswer: string
  resumeEvidence: string
  difficulty: 'easy' | 'medium' | 'hard'
  checked: boolean
}

export interface InterviewPrepResult {
  jobTitle: string
  company: string
  questions: InterviewQuestion[]
  prepChecklist: string[]
  redFlags: string[]
  keyTalkingPoints: string[]
}

// ─── Search (M18) ─────────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'resume' | 'job'
  id: string
  title: string
  subtitle: string
  href: string
  score?: number | null
  status?: JobStatus
}

// ─── Resume Share (M19) ───────────────────────────────────────────────────────

export interface ResumeShare {
  id: string
  resumeId: string
  slug: string
  viewCount: number
  expiresAt: string | null
  hasPassword: boolean
  createdAt: string
}

// ─── Notification (M21) ───────────────────────────────────────────────────────

export type NotificationType =
  | 'score_ready'
  | 'score_drop'
  | 'score_improve'
  | 'job_followup'
  | 'resume_stale'
  | 'share_viewed'
  | 'system'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
}

// ─── Settings (M22) ──────────────────────────────────────────────────────────

export interface UserSettings {
  displayName: string
  defaultProvider: LLMProvider | null
  defaultModel: string | null
  defaultTemplate: TemplateId
  emailNotifications: boolean
}

// ─── Chat (M20) ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// ─── Job Tracker (M12) ───────────────────────────────────────────────────────

export type JobStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn'

export interface JobApplication {
  id: string
  userId: string
  resumeId: string | null
  company: string
  role: string
  url: string
  status: JobStatus
  notes: string
  salaryMin: number | null
  salaryMax: number | null
  location: string
  appliedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface JobApplicationRow {
  id: string
  user_id: string
  resume_id: string | null
  company: string
  role: string
  url: string | null
  status: JobStatus
  notes: string | null
  salary_min: number | null
  salary_max: number | null
  location: string | null
  applied_at: string | null
  created_at: string
  updated_at: string
}

// ─── LinkedIn import ──────────────────────────────────────────────────────────

export interface LinkedInImportResult {
  resumeData: ResumeData
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

// ─── Version History (M10) ──────────────────────────────────────────────────

export interface ResumeVersion {
  id: string
  resumeId: string
  label: string
  parsedData: ResumeData
  atsScore: number | null
  createdAt: string
}

export interface VersionDiff {
  section: string
  field: string
  before: string
  after: string
}
