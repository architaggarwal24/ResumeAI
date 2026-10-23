import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeLikePattern } from '../../src/lib/security/postgrest.ts'

test('escapes LIKE wildcards and backslash', () => {
  assert.equal(escapeLikePattern('50%_off\\'), '50\\%\\_off\\\\')
})
test('trims and caps length', () => {
  assert.equal(escapeLikePattern('  abc  '), 'abc')
  assert.equal(escapeLikePattern('a'.repeat(500)).length, 100)
})
test('non-strings become empty', () => {
  assert.equal(escapeLikePattern(null), '')
  assert.equal(escapeLikePattern(5), '')
})
