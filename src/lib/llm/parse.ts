// src/lib/llm/parse.ts
// Extract the JSON object from a model reply.
//
// Models don't reliably return clean JSON, even when told to. Seen in practice:
//   * reasoning blocks (<think>…</think>) and code fences around the JSON
//   * chatter after the JSON that itself contains braces
//   * raw line breaks / tabs inside strings (copied from the resume text)
//   * unescaped double quotes inside strings: "the "legacy" system"
//   * trailing commas, // comments, Python True/False/None, “smart” quotes
//   * output cut off mid-object when the token budget runs out
// Strict JSON.parse is tried first; only if it fails is the text repaired.
// Pure (no imports) so it can be unit-tested with node --test.

export type ParseResult =
  | { ok: true; value: Record<string, unknown>; repaired?: true; truncated?: true }
  | { ok: false; reason: 'no_json' | 'invalid' | 'empty' }

function stripReasoning(rawText: string): string {
  const stripped = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
    .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, '')
    .replace(/^\s*Thought:.*$/gm, '')
    .trim()
  // Reply was ONLY a think block — the JSON may be inside it.
  if (!stripped && rawText) return (rawText.match(/<think>([\s\S]*?)<\/think>/i)?.[1] ?? '').trim()
  return stripped
}

const OPEN_QUOTES = new Set(['"', '“', '”'])
const CTRL_ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' }

function nextNonSpace(s: string, i: number): string {
  while (i < s.length && /\s/.test(s[i])) i++
  return i < s.length ? s[i] : ''
}

/**
 * Scans from the first '{' of `s` to the end of that object, repairing common
 * defects. Returns the repaired text of the root object and whether the input
 * ended before the object was closed (truncation). A truncated object is cut
 * back to its last complete member and closed.
 */
export function repairJson(s: string): { text: string; truncated: boolean } {
  let out = ''
  const stack: string[] = []
  let inStr = false
  let quote = '"'
  let i = s.indexOf('{')
  if (i < 0) return { text: '', truncated: false }
  // Last point where the output was a complete prefix: cut there on truncation.
  let safe: { len: number; stack: string[] } | null = null

  for (; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (c === '\\') {
        const n = s[i + 1]
        if (n === undefined) break
        // Keep valid escapes; turn invalid ones (e.g. \' or \“) into the plain char.
        if ('"\\/bfnrtu'.includes(n)) { out += c + n } else { out += n === '"' ? '\\"' : n }
        i++
        continue
      }
      const closes = quote === '"' ? c === '"' : (c === '”' || c === '“')
      if (closes || (quote !== '"' && c === '"')) {
        const after = nextNonSpace(s, i + 1)
        // A real closing quote is followed by , } ] : or the end. Anything else
        // means the quote is part of the text and must be escaped. Another
        // quote right after is ambiguous: `"a" "b": 1` (missing comma — this
        // one closes) vs `"say "hi""` (this one is text, the next one closes).
        let closesHere = after === '' || ',}]:'.includes(after)
        if (after === '"') {
          let j = i + 1
          while (/\s/.test(s[j] ?? '')) j++
          const afterNext = nextNonSpace(s, j + 1)
          closesHere = !(afterNext === '' || ',}]:'.includes(afterNext))
        }
        if (closesHere) {
          inStr = false
          out += '"'
          continue
        }
        out += '\\"'
        continue
      }
      if (c in CTRL_ESCAPES) { out += CTRL_ESCAPES[c]; continue }
      if (c < ' ') { out += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'); continue }
      out += c
      continue
    }

    if (OPEN_QUOTES.has(c)) {
      // Missing comma between two members: "a": 1 "b": 2
      const prev = out.trimEnd().slice(-1)
      if (prev && !'{[,:'.includes(prev)) out += ','
      inStr = true
      quote = c === '"' ? '"' : '”'
      out += '"'
      continue
    }
    if (c === '{' || c === '[') {
      stack.push(c === '{' ? '}' : ']')
      out += c
      continue
    }
    if (c === '}' || c === ']') {
      out = out.replace(/,\s*$/, '') // trailing comma
      const expected = stack.pop()
      out += expected ?? c
      if (stack.length === 0) return { text: out, truncated: false }
      safe = { len: out.length, stack: [...stack] }
      continue
    }
    if (c === ',') {
      safe = { len: out.trimEnd().length, stack: [...stack] }
      out += c
      continue
    }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 1; continue }
    if (/[A-Za-z]/.test(c)) {
      const word = s.slice(i).match(/^[A-Za-z_]+/)![0]
      const mapped = ({ True: 'true', False: 'false', None: 'null', undefined: 'null', NaN: 'null' } as Record<string, string>)[word]
      out += mapped ?? word
      i += word.length - 1
      continue
    }
    out += c
  }

  // Ran out of input before the root object closed: truncated.
  if (safe) {
    out = out.slice(0, safe.len).replace(/,\s*$/, '')
    return { text: out + safe.stack.slice().reverse().join(''), truncated: true }
  }
  return { text: out.replace(/,\s*$/, '') + stack.slice().reverse().join(''), truncated: true }
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

export function extractJsonObject(rawText: string): ParseResult {
  const text = stripReasoning(rawText)
  const cleaned = text.replace(/```(?:json|JSON)?/g, '').trim()
  const start = cleaned.indexOf('{')
  if (start === -1) return { ok: false, reason: 'no_json' }

  // 1. Strict: the outermost {...} as-is.
  const end = cleaned.lastIndexOf('}')
  if (end > start) {
    try {
      const v = asObject(JSON.parse(cleaned.slice(start, end + 1)))
      if (v) return Object.keys(v).length ? { ok: true, value: v } : { ok: false, reason: 'empty' }
    } catch { /* fall through to repair */ }
  }

  // 2. Repair, starting at each of the first few '{' (a preamble may contain one).
  let from = start
  for (let tries = 0; tries < 5 && from !== -1; tries++) {
    const { text: fixed, truncated } = repairJson(cleaned.slice(from))
    try {
      const v = asObject(JSON.parse(fixed))
      if (v && Object.keys(v).length) {
        return truncated ? { ok: true, value: v, repaired: true, truncated: true } : { ok: true, value: v, repaired: true }
      }
      if (v) return { ok: false, reason: 'empty' }
    } catch { /* try the next candidate */ }
    from = cleaned.indexOf('{', from + 1)
  }
  return { ok: false, reason: 'invalid' }
}
