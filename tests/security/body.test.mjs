import test from 'node:test'
import assert from 'node:assert/strict'
import { readJsonLimited } from '../../src/lib/security/body.ts'

const mk = (body, headers = {}) => new Request('http://x/', { method: 'POST', body, headers })

test('parses small JSON', async () => {
  const r = await readJsonLimited(mk('{"a":1}'), 100)
  assert.deepEqual(r, { ok: true, data: { a: 1 } })
})
test('rejects invalid JSON with 400', async () => {
  const r = await readJsonLimited(mk('{nope'), 100)
  assert.equal(r.ok, false); assert.equal(r.status, 400)
})
test('rejects oversize body with 413 (actual bytes)', async () => {
  const r = await readJsonLimited(mk(JSON.stringify({ a: 'x'.repeat(500) })), 100)
  assert.equal(r.ok, false); assert.equal(r.status, 413)
})
test('rejects oversize content-length early', async () => {
  const r = await readJsonLimited(mk('{}', { 'content-length': '999999' }), 100)
  assert.equal(r.ok, false); assert.equal(r.status, 413)
})
test('rejects empty body', async () => {
  const r = await readJsonLimited(mk(''), 100)
  assert.equal(r.ok, false); assert.equal(r.status, 400)
})
