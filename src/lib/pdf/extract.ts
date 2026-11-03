// src/lib/pdf/extract.ts
'use client'

// PDF text extraction, client-side.
//
// Security notes:
//  * pdf.js is bundled from the pinned `pdfjs-dist` npm dependency. It used to be
//    injected as a <script> from cdnjs at version 3.11.174 with no Subresource
//    Integrity, which was (a) a supply-chain hop executing in the app's origin —
//    where BYOK API keys live in sessionStorage — and (b) a version affected by
//    CVE-2024-4367 (arbitrary JS execution when opening a crafted PDF; fixed in
//    pdfjs-dist 4.2.67).
//  * `isEvalSupported: false` disables the font-rendering eval() path that bug
//    abused, as defence-in-depth even on patched versions.
//  * The file is checked by magic bytes (not just the browser-reported MIME
//    type), and page count / time are bounded.

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 30
const PARSE_TIMEOUT_MS = 30_000

interface TextItem { str?: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean }
interface PDFPageProxy { getTextContent: () => Promise<{ items: TextItem[] }>; cleanup?: () => void }
interface PDFDocumentProxy { numPages: number; getPage: (n: number) => Promise<PDFPageProxy> }
interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (opts: Record<string, unknown>) => { promise: Promise<PDFDocumentProxy>; destroy?: () => Promise<void> }
}

let pdfjsPromise: Promise<PdfJsModule> | null = null

function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(mod => {
      const pdfjs = mod as unknown as PdfJsModule
      // Worker is a same-origin static asset emitted by the bundler.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      return pdfjs
    }).catch(err => { pdfjsPromise = null; throw err })
  }
  return pdfjsPromise
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  // "%PDF-" must appear within the first 1024 bytes (per the PDF spec / common readers).
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const invalid = validatePDFFile(file)
  if (invalid) throw new Error(invalid)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasPdfMagic(bytes)) throw new Error('This file does not look like a valid PDF')

  const pdfjs = await loadPdfJs()
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
  })

  const timeout = setTimeout(() => { void task.destroy?.() }, PARSE_TIMEOUT_MS)
  try {
    const pdf = await task.promise
    const pages: string[] = []
    const pageCount = Math.min(pdf.numPages, MAX_PAGES)

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()

      const pageText = itemsToText(content.items)
      if (pageText) pages.push(pageText)
      page.cleanup?.()
    }

    const fullText = pages.join('\n\n')
    if (fullText.trim().length < 100) {
      throw new Error(
        'Could not extract enough text from this PDF. It may be a scanned image — please use a text-based PDF.'
      )
    }
    return fullText
  } finally {
    clearTimeout(timeout)
    // Cleanup lives on the *loading task* (PDFDocumentProxy has no destroy()). Never let it mask the result.
    try { await task.destroy?.() } catch { /* already destroyed */ }
  }
}

export function validatePDFFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'Please upload a PDF file'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File size must be under 10MB'
  }
  if (file.size === 0) {
    return 'That file is empty'
  }
  return null
}

/**
 * Rebuilds reading order from pdf.js text items. Items are grouped into lines
 * by baseline (with a tolerance, since baselines jitter), lines are ordered top
 * to bottom and items left to right, and line breaks are kept. Joining every
 * item with a space (the previous approach) flattened the whole page into one
 * line, so section headings and bullets ran together and the model had to
 * guess where one entry ended and the next began.
 */
export function itemsToText(rawItems: TextItem[]): string {
  const items = rawItems
    .filter(it => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform))
    .map(it => ({
      str: it.str as string,
      x: it.transform![4] ?? 0,
      y: it.transform![5] ?? 0,
      w: typeof it.width === 'number' ? it.width : 0,
      h: Math.abs(it.height ?? it.transform![3] ?? 10) || 10,
    }))
  // Top of page first (PDF y grows upward), then left to right.
  items.sort((a, b) => (b.y - a.y) || (a.x - b.x))

  const lines: { y: number; h: number; parts: typeof items }[] = []
  for (const it of items) {
    const line = lines.find(l => Math.abs(l.y - it.y) <= Math.max(2, Math.min(l.h, it.h) * 0.5))
    if (line) line.parts.push(it)
    else lines.push({ y: it.y, h: it.h, parts: [it] })
  }
  lines.sort((a, b) => b.y - a.y)

  return lines.map(l => {
    l.parts.sort((a, b) => a.x - b.x)
    let text = ''
    let lastEnd: number | null = null
    for (const p of l.parts) {
      const gap = lastEnd === null ? 0 : p.x - lastEnd
      if (lastEnd !== null && gap > p.h * 0.15 && !text.endsWith(' ') && !p.str.startsWith(' ')) text += gap > p.h * 3 ? '   ' : ' '
      text += p.str
      lastEnd = p.x + p.w
    }
    return text.replace(/[ \t]+$/g, '')
  }).filter(t => t.trim()).join('\n').replace(/[ \t]{4,}/g, '   ').trim()
}
