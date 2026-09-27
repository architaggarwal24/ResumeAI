// src/lib/resumeEdits.ts
import type { ResumeData } from '@/types/resume'

/**
 * Apply a single proposed edit (from the AI Coach) to resume data.
 * Searches summary, experience bullets, project bullets, and skills for
 * a matching targetId / section, and returns a new ResumeData with the
 * replacement applied. Returns null if no matching target was found.
 *
 * Falls back to fuzzy-matching on the "original" text if targetId doesn't
 * match exactly — models occasionally slightly mistype or invent an ID even
 * when explicitly told to use the resume's real IDs.
 */
export function applyResumeEdit(
  resumeData: ResumeData,
  edit: { targetId: string; section: string; original?: string; suggested: string }
): ResumeData | null {
  const next: ResumeData = JSON.parse(JSON.stringify(resumeData))
  const targetId = (edit.targetId || '').trim()
  const section = (edit.section || '').toLowerCase().trim()
  const original = (edit.original || '').trim()

  // Summary
  if (targetId === 'summary' || section === 'summary') {
    next.summary = edit.suggested
    return next
  }

  // Skills — too ambiguous to auto-resolve from free text; leave to the
  // user via the editor or the Score tab's section-level suggestion box.
  if (targetId === 'skills' || section === 'skills') {
    return null
  }

  // Pass 1: exact ID match (the expected path)
  for (const exp of next.experience || []) {
    for (const bul of exp.bullets || []) {
      if (bul.id === targetId) { bul.text = edit.suggested; return next }
    }
  }
  for (const proj of next.projects || []) {
    for (const bul of proj.bullets || []) {
      if (bul.id === targetId) { bul.text = edit.suggested; return next }
    }
  }

  // Pass 2: fuzzy fallback — match on "original" text if the model got the
  // ID slightly wrong but quoted the actual current text correctly
  if (original) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
    const target = norm(original)
    for (const exp of next.experience || []) {
      for (const bul of exp.bullets || []) {
        if (norm(bul.text) === target) { bul.text = edit.suggested; return next }
      }
    }
    for (const proj of next.projects || []) {
      for (const bul of proj.bullets || []) {
        if (norm(bul.text) === target) { bul.text = edit.suggested; return next }
      }
    }
  }

  return null
}

/**
 * Parse `​```edit ... ​````-tagged JSON blocks out of a chat message's content.
 * Also tolerates `​```json ... ​```` blocks that contain the same shape (some
 * models ignore the exact fence tag instruction), as long as the parsed
 * object has both "targetId" and "suggested" keys.
 * Returns the cleaned text (with edit blocks stripped) and the parsed edits.
 */
export function extractProposedEdits(content: string): {
  text: string
  edits: Array<{ targetId: string; section: string; label: string; original: string; suggested: string; reason: string }>
} {
  const edits: Array<{ targetId: string; section: string; label: string; original: string; suggested: string; reason: string }> = []
  // Matches ```edit, ```json, or bare ``` fences — we validate shape after parsing
  const editBlockRe = /```(?:edit|json)?\s*([\s\S]*?)```/g

  const text = content.replace(editBlockRe, (match, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr.trim())
      // Only treat it as a proposed edit if it has the expected shape —
      // otherwise leave non-edit code blocks (e.g. example code) untouched
      if (parsed && typeof parsed === 'object' && parsed.suggested && parsed.targetId) {
        edits.push({
          targetId: String(parsed.targetId ?? ''),
          section: String(parsed.section ?? ''),
          label: String(parsed.label ?? parsed.section ?? 'Suggested edit'),
          original: String(parsed.original ?? ''),
          suggested: String(parsed.suggested ?? ''),
          reason: String(parsed.reason ?? ''),
        })
        return ''
      }
      // Valid JSON but not an edit shape — leave the block as-is (don't strip)
      return match
    } catch {
      // Not valid JSON yet (likely still streaming) or genuinely not JSON —
      // leave the block untouched rather than silently dropping content
      return match
    }
  }).trim()

  return { text, edits }
}

/**
 * Detect an in-progress (not yet closed) ```edit block while streaming,
 * so we can hide the raw JSON while it's being typed out.
 */
export function stripPartialEditBlock(content: string): string {
  const lastOpen = content.lastIndexOf('```edit')
  if (lastOpen === -1) return content
  const closeAfter = content.indexOf('```', lastOpen + 7)
  if (closeAfter !== -1) return content // block is complete, leave as-is
  return content.slice(0, lastOpen).trim()
}
