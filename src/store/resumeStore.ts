import { create } from 'zustand'
import type {
  ResumeData, AnalysisResult, ATSResult, BYOKCreds,
  LLMProvider, ResumeTab, Toast, ToastType, TemplateId,
  CoverLetter, PerProviderKeys,
} from '@/types/resume'
import { PROVIDERS } from '@/lib/llm/client'

// ─── Storage helpers ──────────────────────────────────────────────────────────
// Keys are stored in localStorage (survives page refresh + tab close)
// Never read at module init — only inside actions/effects to avoid SSR mismatch

const KEY_PREFIX     = 'rai_key_'
const PROVIDER_KEY   = 'rai_provider'
const MODEL_KEY      = 'rai_model_'

function read(key: string): string {
  try { return localStorage.getItem(key) ?? '' } catch { return '' }
}
function write(key: string, val: string): void {
  try { localStorage.setItem(key, val) } catch {}
}

export function getStoredKey(provider: LLMProvider): string    { return read(`${KEY_PREFIX}${provider}`) }
export function setStoredKey(provider: LLMProvider, key: string) { write(`${KEY_PREFIX}${provider}`, key) }
export function getStoredProvider(): LLMProvider               { return (read(PROVIDER_KEY) as LLMProvider) || 'anthropic' }
export function getStoredModel(provider: LLMProvider): string  { return read(`${MODEL_KEY}${provider}`) || PROVIDERS[provider].defaultModel }

function buildCreds(provider: LLMProvider): BYOKCreds {
  return { provider, apiKey: getStoredKey(provider), model: getStoredModel(provider) }
}

const DEFAULT_CREDS: BYOKCreds = {
  provider: 'anthropic',
  apiKey:   '',
  model:    PROVIDERS['anthropic'].defaultModel,
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ResumeStore {
  resumeId: string | null
  resumeData: ResumeData | null
  rawText: string
  activeTab: ResumeTab
  selectedTemplate: TemplateId
  analysisResult: AnalysisResult | null
  atsResult: ATSResult | null
  jobDescription: string
  coverLetter: CoverLetter | null
  byokCreds: BYOKCreds
  hydrated: boolean

  loading: {
    parsing: boolean
    analyzing: boolean
    ats: boolean
    rewriting: string | null
    coverLetter: boolean
    saving: boolean
  }
  toasts: Toast[]

  hydrateFromStorage: () => void

  setResumeId: (id: string | null) => void
  setResumeData: (data: ResumeData | null) => void
  updateResumeField: (updater: (prev: ResumeData) => ResumeData) => void
  setRawText: (text: string) => void
  setActiveTab: (tab: ResumeTab) => void
  setSelectedTemplate: (id: TemplateId) => void
  setAnalysisResult: (result: AnalysisResult | null) => void
  setATSResult: (result: ATSResult | null) => void
  setJobDescription: (jd: string) => void
  setCoverLetter: (cl: CoverLetter | null) => void

  setProvider: (provider: LLMProvider) => void
  setApiKey: (key: string) => void
  setModel: (model: string) => void
  setByokCreds: (creds: Partial<BYOKCreds>) => void

  setLoading: (key: keyof ResumeStore['loading'], value: boolean | string | null) => void
  addToast: (message: string, type?: ToastType, duration?: number) => string
  removeToast: (id: string) => void
  reset: () => void
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  resumeId: null,
  resumeData: null,
  rawText: '',
  activeTab: 'score',
  selectedTemplate: 'classic',
  analysisResult: null,
  atsResult: null,
  jobDescription: '',
  coverLetter: null,
  byokCreds: DEFAULT_CREDS,
  hydrated: false,
  loading: { parsing: false, analyzing: false, ats: false, rewriting: null, coverLetter: false, saving: false },
  toasts: [],

  hydrateFromStorage: () => {
    let provider = getStoredProvider()
    // If the stored provider has no key, switch to the first one that does
    if (!getStoredKey(provider)) {
      const withKey = (Object.keys(PROVIDERS) as LLMProvider[]).find(p => !!getStoredKey(p))
      if (withKey) provider = withKey
    }
    set({ byokCreds: buildCreds(provider), hydrated: true })
  },

  setResumeId: id => set({ resumeId: id }),
  setResumeData: data => set({ resumeData: data }),
  updateResumeField: updater => set(state => ({
    resumeData: state.resumeData ? updater(state.resumeData) : state.resumeData,
    analysisResult: null,
  })),
  setRawText: text => set({ rawText: text }),
  setActiveTab: tab => set({ activeTab: tab }),
  setSelectedTemplate: id => set({ selectedTemplate: id }),
  setAnalysisResult: result => set({ analysisResult: result }),
  setATSResult: result => set({ atsResult: result }),
  setJobDescription: jd => set({ jobDescription: jd }),
  setCoverLetter: cl => set({ coverLetter: cl }),

  setProvider: (provider) => {
    write(PROVIDER_KEY, provider)
    set({ byokCreds: buildCreds(provider) })
  },
  setApiKey: (key) => {
    const { byokCreds } = get()
    setStoredKey(byokCreds.provider, key)
    set({ byokCreds: { ...byokCreds, apiKey: key } })
  },
  setModel: (model) => {
    const { byokCreds } = get()
    write(`${MODEL_KEY}${byokCreds.provider}`, model)
    set({ byokCreds: { ...byokCreds, model } })
  },
  setByokCreds: (partial) => {
    const { byokCreds } = get()
    if (partial.provider && partial.provider !== byokCreds.provider) {
      write(PROVIDER_KEY, partial.provider)
      set({ byokCreds: buildCreds(partial.provider) })
    } else {
      if (partial.apiKey !== undefined) setStoredKey(byokCreds.provider, partial.apiKey)
      if (partial.model  !== undefined) write(`${MODEL_KEY}${byokCreds.provider}`, partial.model)
      set({ byokCreds: { ...byokCreds, ...partial } })
    }
  },

  setLoading: (key, value) => set(state => ({ loading: { ...state.loading, [key]: value } })),

  addToast: (message, type = 'success', duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    set(state => ({ toasts: [...state.toasts, { id, message, type, duration }] }))
    if (duration > 0) setTimeout(() => get().removeToast(id), duration)
    return id
  },
  removeToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  reset: () => set({
    resumeId: null, resumeData: null, rawText: '', activeTab: 'score',
    analysisResult: null, atsResult: null, jobDescription: '', coverLetter: null,
  }),
}))