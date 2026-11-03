import test from 'node:test'
import assert from 'node:assert/strict'
import { isEmailVerified } from '../../src/lib/security/email-verified.ts'

test('confirmed email passes', () => {
  assert.equal(isEmailVerified({ email: 'a@b.co', email_confirmed_at: '2026-11-01T00:00:00Z' }), true)
})
test('legacy confirmed_at field passes', () => {
  assert.equal(isEmailVerified({ email: 'a@b.co', confirmed_at: '2026-11-01T00:00:00Z' }), true)
})
test('unconfirmed email is rejected', () => {
  assert.equal(isEmailVerified({ email: 'a@b.co', email_confirmed_at: null }), false)
  assert.equal(isEmailVerified({ email: 'a@b.co' }), false)
})
test('no user is rejected', () => {
  assert.equal(isEmailVerified(null), false)
  assert.equal(isEmailVerified(undefined), false)
})
test('an empty timestamp string does not count as verified', () => {
  assert.equal(isEmailVerified({ email: 'a@b.co', email_confirmed_at: '' }), false)
})
