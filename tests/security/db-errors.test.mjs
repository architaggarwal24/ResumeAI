import test from 'node:test'
import assert from 'node:assert/strict'
import { mapCreateShareError, mapDeleteAccountError, retryAfterFromMessage } from '../../src/lib/security/db-errors.ts'

test('create_share: throttle maps to 429 with Retry-After seconds', () => {
  const m = mapCreateShareError({ code: 'P0001', message: 'rate_limited:1500' }, 25)
  assert.equal(m.status, 429); assert.equal(m.retryAfterSec, 2)
})
test('create_share: per-resume cap maps to 409', () => {
  assert.equal(mapCreateShareError({ code: '23514', message: 'limit_reached:resume_shares' }, 25).status, 409)
})
test('create_share: someone else’s resume maps to 404, MFA to 403, auth to 401', () => {
  assert.equal(mapCreateShareError({ code: 'P0002', message: 'not_found' }, 25).status, 404)
  assert.equal(mapCreateShareError({ code: '42501', message: 'mfa_required' }, 25).status, 403)
  assert.equal(mapCreateShareError({ code: '28000', message: 'not_authenticated' }, 25).status, 401)
})
test('create_share: unknown errors are a generic 500 (no database text leaks)', () => {
  const m = mapCreateShareError({ code: 'XX000', message: 'internal detail about table x' }, 25)
  assert.equal(m.status, 500); assert.doesNotMatch(m.error, /table|internal/)
  assert.equal(mapCreateShareError(null, 25).status, 500)
})
test('retry-after falls back to 60s on junk', () => {
  assert.equal(retryAfterFromMessage('rate_limited:abc'), 60)
  assert.equal(retryAfterFromMessage(undefined), 60)
})
test('delete_my_account errors never look like success', () => {
  assert.equal(mapDeleteAccountError({ code: '42501', message: 'mfa_required' }).status, 403)
  assert.equal(mapDeleteAccountError({ code: '28000' }).status, 401)
  assert.equal(mapDeleteAccountError({ code: '42501', message: 'permission denied for table users' }).status, 500)
  assert.equal(mapDeleteAccountError(null).status, 500)
})
