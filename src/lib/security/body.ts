// src/lib/security/body.ts
// Bounded JSON body reader. `request.json()` buffers an unbounded body, which
// lets any (even authenticated) caller force large allocations on a
// 60-second serverless function.

export type JsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: string }

export async function readJsonLimited<T = unknown>(req: Request, maxBytes: number): Promise<JsonResult<T>> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: 'Request body too large' }
  }
  if (!req.body) return { ok: false, status: 400, error: 'Empty request body' }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        return { ok: false, status: 413, error: 'Request body too large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: 'Could not read request body' }
  }
  if (total === 0) return { ok: false, status: 400, error: 'Empty request body' }

  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.byteLength }
  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(buf)) as T }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }
}
