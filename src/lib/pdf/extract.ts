'use client'

// PDF.js is loaded via CDN in the HTML — this util wraps it safely

declare global {
  interface Window {
    pdfjsLib: {
      getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> }
      GlobalWorkerOptions: { workerSrc: string }
    }
  }
}

interface PDFDocumentProxy {
  numPages: number
  getPage: (n: number) => Promise<PDFPageProxy>
}

interface PDFPageProxy {
  getTextContent: () => Promise<{ items: Array<{ str: string; transform?: number[] }> }>
}

let pdfJsLoaded = false

async function ensurePdfJs(): Promise<void> {
  if (pdfJsLoaded || (typeof window !== 'undefined' && window.pdfjsLib)) {
    pdfJsLoaded = true
    return
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      pdfJsLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load PDF.js'))
    document.head.appendChild(script)
  })
}

export async function extractTextFromPDF(file: File): Promise<string> {
  if (file.type !== 'application/pdf') {
    throw new Error('File must be a PDF')
  }

  await ensurePdfJs()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Sort by vertical position to preserve reading order
    const items = content.items as Array<{ str: string; transform?: number[] }>
    items.sort((a, b) => {
      const aY = a.transform?.[5] ?? 0
      const bY = b.transform?.[5] ?? 0
      return bY - aY // PDF y-axis is inverted
    })

    const pageText = items
      .map(item => item.str)
      .filter(Boolean)
      .join(' ')
      .replace(/\s{3,}/g, '  ')
      .trim()

    if (pageText) pages.push(pageText)
  }

  const fullText = pages.join('\n\n')

  if (fullText.trim().length < 100) {
    throw new Error(
      'Could not extract enough text from this PDF. It may be a scanned image — please use a text-based PDF.'
    )
  }

  return fullText
}

export function validatePDFFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'Please upload a PDF file'
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'File size must be under 10MB'
  }
  return null
}
