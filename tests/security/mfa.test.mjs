import test from 'node:test'
import assert from 'node:assert/strict'
import { aalFromAccessToken, hasVerifiedFactor, needsSecondFactor, shouldChallenge } from '../../src/lib/security/mfa.ts'

const jwt = payload => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`
const enrolled = { factors: [{ status: 'verified' }] }

test('reads the aal claim', () => {
  assert.equal(aalFromAccessToken(jwt({ aal: 'aal2' })), 'aal2')
  assert.equal(aalFromAccessToken(jwt({ aal: 'aal1' })), 'aal1')
  assert.equal(aalFromAccessToken(jwt({ aal: 'aal9' })), null)
  assert.equal(aalFromAccessToken('garbage'), null)
  assert.equal(aalFromAccessToken(null), null)
})
test('only verified factors count', () => {
  assert.equal(hasVerifiedFactor({ factors: [{ status: 'unverified' }] }), false)
  assert.equal(hasVerifiedFactor(enrolled), true)
  assert.equal(hasVerifiedFactor(null), false)
})
test('enrolled users need aal2; others are unaffected', () => {
  assert.equal(needsSecondFactor(enrolled, jwt({ aal: 'aal1' })), true)
  assert.equal(needsSecondFactor(enrolled, undefined), true, 'missing token fails closed')
  assert.equal(needsSecondFactor(enrolled, jwt({ aal: 'aal2' })), false)
  assert.equal(needsSecondFactor({ factors: [] }, jwt({ aal: 'aal1' })), false)
})
test('client challenge rule', () => {
  assert.equal(shouldChallenge({ currentLevel: 'aal1', nextLevel: 'aal2' }), true)
  assert.equal(shouldChallenge({ currentLevel: 'aal2', nextLevel: 'aal2' }), false)
  assert.equal(shouldChallenge({ currentLevel: 'aal1', nextLevel: 'aal1' }), false)
  assert.equal(shouldChallenge(null), false)
})
