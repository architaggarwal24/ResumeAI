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

interface TextItem { str?: string; transform?: number[] }
interface PDFPageProxy { getTextContent: () => Promise<{ items: TextItem[] }>; cleanup?: () => void }
interface PDFDocumentProxy { numPages: number; getPage: (n: number) => Promise<PDFPageProxy>; destroy: () => Promise<void> }
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

      // Sort by vertical position to preserve reading order
      const items = content.items.filter(it => typeof it.str === 'string')
      items.sort((a, b) => (b.transform?.[5] ?? 0) - (a.transform?.[5] ?? 0)) // PDF y-axis is inverted

      const pageText = items
        .map(item => item.str as string)
        .filter(Boolean)
        .join(' ')
        .replace(/\s{3,}/g, '  ')
        .trim()

      if (pageText) pages.push(pageText)
      page.cleanup?.()
    }
    await pdf.destroy()

    const fullText = pages.join('\n\n')
    if (fullText.trim().length < 100) {
      throw new Error(
        'Could not extract enough text from this PDF. It may be a scanned image — please use a text-based PDF.'
      )
    }
    return fullText
  } finally {
    clearTimeout(timeout)
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
