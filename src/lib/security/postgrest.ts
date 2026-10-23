// src/lib/security/postgrest.ts
// Escape user input for use inside a LIKE/ILIKE pattern so `%` / `_` / `\`
// are matched literally, and cap its length. Callers should pass the result
// to `.ilike(column, `%${escaped}%`)` — never interpolate raw input into
// `.or(...)` filter strings, where `,` `(` `)` change the filter structure.
export function escapeLikePattern(input: unknown, maxLen = 100): string {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, maxLen).replace(/[\\%_]/g, c => `\\${c}`).slice(0, maxLen)
}
