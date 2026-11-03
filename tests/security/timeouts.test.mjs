import test from 'node:test'
import assert from 'node:assert/strict'
import { withTimeout, STREAM_TIMEOUT_MS } from '../../src/lib/llm/timeouts.ts'

test('stream deadline is below the 60 s function limit', () => {
  assert.ok(STREAM_TIMEOUT_MS > 0 && STREAM_TIMEOUT_MS < 60_000)
})
test('aborts on timeout', async () => {
  const s = withTimeout(undefined, 20)
  await new Promise(r => setTimeout(r, 60))
  assert.equal(s.aborted, true); assert.equal(s.reason.name, 'TimeoutError')
})
test('aborts when the client aborts', () => {
  const c = new AbortController()
  const s = withTimeout(c.signal, 10_000)
  c.abort(); assert.equal(s.aborted, true)
})
