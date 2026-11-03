// src/lib/llm/timeouts.ts
// Server-side deadlines for provider calls (B10). Streaming replies get a
// deadline a little under the routes' 60 s maxDuration, so a provider that
// stalls mid-stream is cut off by us rather than left hanging until the
// platform kills the function. Pure, so it can be unit-tested.

export const STREAM_TIMEOUT_MS = 55_000

/** Aborts when `ms` elapses or when `external` (e.g. the client disconnecting) aborts. */
export function withTimeout(external: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms)
  return external ? AbortSignal.any([t, external]) : t
}
