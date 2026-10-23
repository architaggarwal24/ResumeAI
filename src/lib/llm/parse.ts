// src/lib/llm/parse.ts
// Extract the JSON object from a model reply: strips reasoning blocks and code
// fences, then parses the outermost {...}.

export type ParseResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'no_json' | 'invalid' | 'empty' }

export function extractJsonObject(rawText: string): ParseResult {
  const stripped = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
    .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, '')
    .replace(/^\s*Thought:.*$/gm, '')
    .trim()

  // Reply was ONLY a think block — the JSON may be inside it.
  let text = stripped
  if (!stripped && rawText) text = (rawText.match(/<think>([\s\S]*?)<\/think>/i)?.[1] ?? '').trim()

  const cleaned = text.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return { ok: false, reason: 'no_json' }

  let parsed: unknown
  try { parsed = JSON.parse(cleaned.slice(start, end + 1)) } catch { return { ok: false, reason: 'invalid' } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'invalid' }
  if (Object.keys(parsed as object).length === 0) return { ok: false, reason: 'empty' }
  return { ok: true, value: parsed as Record<string, unknown> }
}
