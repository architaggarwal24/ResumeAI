import test from 'node:test'
import assert from 'node:assert/strict'
import { publicAuthError, isExistingAccountError } from '../../src/lib/security/auth-messages.ts'

const GENERIC_LOGIN = publicAuthError('login', { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 })

test('login: wrong password, unknown user and unconfirmed email all read the same', () => {
  for (const err of [
    { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 },
    { message: 'Email not confirmed', code: 'email_not_confirmed', status: 400 },
    { message: 'User not found', code: 'user_not_found', status: 400 },
    { message: 'something new from the provider', status: 400 },
  ]) {
    assert.equal(publicAuthError('login', err), GENERIC_LOGIN)
  }
  assert.doesNotMatch(GENERIC_LOGIN, /not confirmed|not found|registered|exists/i)
})

test('signup: "already registered" is recognised so the UI can show the normal success screen', () => {
  assert.equal(isExistingAccountError({ message: 'User already registered', status: 422 }), true)
  assert.equal(isExistingAccountError({ message: 'x', code: 'user_already_exists' }), true)
  assert.equal(isExistingAccountError({ message: 'x', code: 'email_exists' }), true)
  assert.equal(isExistingAccountError({ message: 'Invalid login credentials' }), false)
  assert.equal(isExistingAccountError(null), false)
})

test('signup: other errors never echo the provider text', () => {
  const m = publicAuthError('signup', { message: 'Database error saving new user for a@b.com', status: 500 })
  assert.doesNotMatch(m, /a@b\.com|database/i)
})

test('rate limits and network failures keep a specific, non-revealing message', () => {
  const rl = publicAuthError('login', { message: 'Request rate limit reached', status: 429 })
  assert.match(rl, /too many/i)
  assert.match(publicAuthError('signup', { message: 'email rate limit exceeded', code: 'over_email_send_rate_limit' }), /too many/i)
  assert.match(publicAuthError('login', { message: 'Failed to fetch' }), /connection/i)
})

test('signup: weak password gets actionable guidance', () => {
  assert.match(publicAuthError('signup', { message: 'Password should be at least 8 characters', code: 'weak_password' }), /stronger password/i)
})

test('oauth errors are generic', () => {
  assert.match(publicAuthError('oauth', { message: 'Unsupported provider: provider is not enabled' }), /google/i)
  assert.doesNotMatch(publicAuthError('oauth', { message: 'Unsupported provider: provider is not enabled' }), /not enabled/i)
})

test('missing error object still returns a message', () => {
  assert.equal(typeof publicAuthError('login', null), 'string')
})
