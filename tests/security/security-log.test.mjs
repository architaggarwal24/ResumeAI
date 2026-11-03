import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSecurityEvent, sanitizeFields } from '../../src/lib/security/security-log.ts'

test('one JSON line with a fixed type', () => {
  const line = formatSecurityEvent('rate_limited', { bucket: 'ai' }, new Date('2026-01-01T00:00:00Z'))
  assert.deepEqual(JSON.parse(line), { type: 'security_event', event: 'rate_limited', ts: '2026-01-01T00:00:00.000Z', bucket: 'ai' })
})
test('sensitive-looking fields are dropped, objects ignored, strings truncated', () => {
  const f = sanitizeFields({ apiKey: 'sk-x', password: 'p', accessToken: 't', email: 'a@b', nested: { a: 1 }, path: 'x'.repeat(500), n: 3 })
  assert.deepEqual(Object.keys(f).sort(), ['n', 'path'])
  assert.equal(f.path.length, 200)
})
