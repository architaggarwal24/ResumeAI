import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCreds, isSafeModelId } from '../../src/lib/llm/validate.ts'

const ok = { provider: 'gemini', apiKey: 'AIzaSyExampleExampleExample1234', model: 'gemini-3.8-flash' }
test('accepts valid creds', () => assert.equal(validateCreds(ok).ok, true))
test('rejects unknown provider (incl. ollama)', () => {
  assert.equal(validateCreds({ ...ok, provider: 'ollama' }).ok, false)
  assert.equal(validateCreds({ ...ok, provider: '__proto__' }).ok, false)
})
test('rejects non-object / missing fields', () => {
  for (const v of [null, 'x', 5, {}, { provider: 'openai' }, { provider: 'openai', apiKey: 'k' }]) assert.equal(validateCreds(v).ok, false)
})
test('rejects keys with whitespace / control chars / absurd length', () => {
  assert.equal(validateCreds({ ...ok, apiKey: 'abc def12345' }).ok, false)
  assert.equal(validateCreds({ ...ok, apiKey: 'abcdefgh\r\nX-Evil: 1' }).ok, false)
  assert.equal(validateCreds({ ...ok, apiKey: 'a'.repeat(2000) }).ok, false)
})
test('gemini model ids cannot alter the request path or query', () => {
  for (const m of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview']) assert.equal(isSafeModelId('gemini', m), true)
  for (const m of ['../../v1beta/openai/x', 'a/b', 'a:generateContent?key=1', 'a?b', 'a#b', 'a b', '', '..', 'x'.repeat(200)]) assert.equal(isSafeModelId('gemini', m), false)
})
test('openrouter/nvidia style ids allowed, traversal not', () => {
  assert.equal(isSafeModelId('openrouter', 'meta-llama/llama-3.3-70b-instruct:free'), true)
  assert.equal(isSafeModelId('nvidia', 'nvidia/nemotron-3-nano-30b-a3b'), true)
  assert.equal(isSafeModelId('openrouter', '../etc/passwd'), false)
  assert.equal(isSafeModelId('openai', 'gpt 6'), false)
})
test('validateCreds applies model rule per provider', () => {
  assert.equal(validateCreds({ ...ok, model: 'a/b' }).ok, false)
  assert.equal(validateCreds({ provider: 'openrouter', apiKey: 'sk-or-abcdefgh', model: 'a/b:free' }).ok, true)
})
