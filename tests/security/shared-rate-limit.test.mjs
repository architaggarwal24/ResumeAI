import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSharedDecision, SHARED_BUCKETS } from '../../src/lib/security/shared-rate-limit.ts'
import { readFileSync } from 'node:fs'

test('allowed and blocked decisions', () => {
  assert.deepEqual(parseSharedDecision({ allowed: true, remaining: 3 }, null), { allowed: true, remaining: 3, retryAfterMs: 0 })
  assert.deepEqual(parseSharedDecision({ allowed: false, retry_after_ms: 1200 }, null), { allowed: false, remaining: 0, retryAfterMs: 1200 })
  assert.equal(parseSharedDecision({ allowed: false }, null).retryAfterMs, 60_000)
})
test('store unavailable → null (caller keeps the in-memory result)', () => {
  assert.equal(parseSharedDecision(null, { code: 'PGRST202' }), null)
  assert.equal(parseSharedDecision({ allowed: 'yes' }, null), null)
  assert.equal(parseSharedDecision(undefined, null), null)
})
test('every app bucket exists in the SQL function', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/005_security_remediation.sql', import.meta.url), 'utf8')
  for (const b of Object.values(SHARED_BUCKETS)) assert.match(sql, new RegExp(`\\('${b}',\\s+\\d+`), b)
})
