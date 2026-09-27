// src/store/resumeStore.ts
import { create } from 'zustand'
import type {
  ResumeData, AnalysisResult, ATSResult, BYOKCreds,
  LLMProvider, ResumeTab, Toast, ToastType, TemplateId,
  CoverLetter,
} from '@/types/resume'
import { PROVIDERS } from '@/lib/llm/client'

// ─── Storage helpers ──────────────────────────────────────────────────────────
// Keys are stored in sessionStorage (cleared when the tab/window is closed;
// survives same-tab refresh, not shared across tabs)
// Never read at module init — only inside actions/effects to avoid SSR mismatch

const KEY_PREFIX     = 'rai_key_'
const PROVIDER_KEY   = 'rai_provider'
const MODEL_KEY      = 'rai_model_'
const BASEURL_KEY    = 'rai_baseurl_'

// Ollama runs locally with no API key — the proxy routes don't require auth
// for it, but a lot of UI/validation code gates on `apiKey` being non-empty.
// We store this sentinel so those checks pass naturally for Ollama without
// touching every call site.
export const OLLAMA_SENTINEL_KEY = 'ollama-local'

function read(key: string): string {
  try { return sessionStorage.getItem(key) ?? '' } catch { return '' }
}
function write(key: string, val: string): void {
  try { sessionStorage.setItem(key, val) } catch {}
}

export function getStoredKey(provider: LLMProvider): string {
  if (provider === 'ollama') return OLLAMA_SENTINEL_KEY
  return read(`${KEY_PREFIX}${provider}`)
}
export function setStoredKey(provider: LLMProvider, key: string) { write(`${KEY_PREFIX}${provider}`, key) }
export function getStoredProvider(): LLMProvider               { return (read(PROVIDER_KEY) as LLMProvider) || 'anthropic' }
export function getStoredModel(provider: LLMProvider): string  { return read(`${MODEL_KEY}${provider}`) || PROVIDERS[provider].defaultModel }
export function getStoredBaseUrl(provider: LLMProvider): string { return read(`${BASEURL_KEY}${provider}`) || PROVIDERS[provider].baseUrl || '' }
export function setStoredBaseUrl(provider: LLMProvider, url: string) { write(`${BASEURL_KEY}${provider}`, url) }

function buildCreds(provider: LLMProvider): BYOKCreds {
  return { provider, apiKey: getStoredKey(provider), model: getStoredModel(provider), baseUrl: getStoredBaseUrl(provider) }
}

const DEFAULT_CREDS: BYOKCreds = {
  provider: 'anthropic',
  apiKey:   '',
  model:    PROVIDERS['anthropic'].defaultModel,
}

// ─── Resume hash ─────────────────────────────────────────────────────────────
// Lightweight djb2-style hash of the serialized resumeData — used to detect
// whether the resume changed since the last analysis without deep-comparing
// the full object. Not cryptographic — just needs to be consistent and fast.
export function hashResumeData(data: ResumeData | null): string {
  if (!data) return ''
  const str = JSON.stringify(data)
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash |= 0 // convert to 32-bit int
  }
  return (hash >>> 0).toString(36) // unsigned, base36
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_UNDO_DEPTH = 10

// Push a snapshot onto the past stack, dropping the oldest if over the limit.
// Returns a new array — does not mutate.
function pushPast(past: ResumeData[], snapshot: ResumeData): ResumeData[] {
  const next = [...past, snapshot]
  return next.length > MAX_UNDO_DEPTH ? next.slice(next.length - MAX_UNDO_DEPTH) : next
}

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
  // Hash of resumeData at the time the last analysis completed.
  // Compared against the current resumeData hash to detect stale scores.
  lastAnalyzedHash: string | null
  // Undo/redo history — capped at MAX_UNDO_DEPTH snapshots each direction.
  // We only snapshot resumeData (not analysis results, tabs, etc.) since
  // those are derived state, not user-authored content.
  undoPast: ResumeData[]
  undoFuture: ResumeData[]

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
  updateResumeFieldSilent: (updater: (prev: ResumeData) => ResumeData) => void
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
  setBaseUrl: (url: string) => void
  setByokCreds: (creds: Partial<BYOKCreds>) => void

  undo: () => void
  redo: () => void

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
  lastAnalyzedHash: null,
  undoPast: [],
  undoFuture: [],
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
  setResumeData: data => set({ resumeData: data, undoPast: [], undoFuture: [] }),
  updateResumeField: updater => set(state => {
    if (!state.resumeData) return {}
    return {
      resumeData: updater(state.resumeData),
      analysisResult: null,
      lastAnalyzedHash: null,
      undoPast: pushPast(state.undoPast, state.resumeData),
      undoFuture: [],
    }
  }),
  // Like updateResumeField but keeps the cached analysis result around.
  // Still snapshots for undo so applied suggestions can be reverted.
  updateResumeFieldSilent: updater => set(state => {
    if (!state.resumeData) return {}
    return {
      resumeData: updater(state.resumeData),
      undoPast: pushPast(state.undoPast, state.resumeData),
      undoFuture: [],
    }
  }),
  setRawText: text => set({ rawText: text }),
  setActiveTab: tab => set({ activeTab: tab }),
  setSelectedTemplate: id => set({ selectedTemplate: id }),
  // Snapshot the current resumeData hash when analysis completes so ScoreTab
  // can detect if the resume was edited afterward.
  setAnalysisResult: result => set(state => ({
    analysisResult: result,
    lastAnalyzedHash: result ? hashResumeData(state.resumeData) : null,
  })),
  setATSResult: result => set({ atsResult: result }),
  setJobDescription: jd => set({ jobDescription: jd }),
  setCoverLetter: cl => set({ coverLetter: cl }),

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  undo: () => {
    const { resumeData, undoPast, undoFuture } = get()
    if (!undoPast.length || !resumeData) return
    const prev = undoPast[undoPast.length - 1]
    set({
      resumeData: prev,
      undoPast: undoPast.slice(0, -1),
      // Push current onto future so redo can restore it
      undoFuture: [resumeData, ...undoFuture].slice(0, MAX_UNDO_DEPTH),
      // Keep analysis result — stale banner will detect hash mismatch
    })
  },
  redo: () => {
    const { resumeData, undoPast, undoFuture } = get()
    if (!undoFuture.length || !resumeData) return
    const next = undoFuture[0]
    set({
      resumeData: next,
      undoFuture: undoFuture.slice(1),
      undoPast: pushPast(undoPast, resumeData),
    })
  },

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
  setBaseUrl: (url) => {
    const { byokCreds } = get()
    setStoredBaseUrl(byokCreds.provider, url)
    set({ byokCreds: { ...byokCreds, baseUrl: url } })
  },
  setByokCreds: (partial) => {
    const { byokCreds } = get()
    if (partial.provider && partial.provider !== byokCreds.provider) {
      write(PROVIDER_KEY, partial.provider)
      set({ byokCreds: buildCreds(partial.provider) })
    } else {
      if (partial.apiKey  !== undefined) setStoredKey(byokCreds.provider, partial.apiKey)
      if (partial.model   !== undefined) write(`${MODEL_KEY}${byokCreds.provider}`, partial.model)
      if (partial.baseUrl !== undefined) setStoredBaseUrl(byokCreds.provider, partial.baseUrl)
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
    lastAnalyzedHash: null, undoPast: [], undoFuture: [],
  }),
}))