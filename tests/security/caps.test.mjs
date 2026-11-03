import test from 'node:test'
import assert from 'node:assert/strict'
import { isLimitReached } from '../../src/lib/security/caps.ts'

test('recognises the database cap trigger error', () => {
  assert.equal(isLimitReached({ code: '23514', message: 'limit_reached:resumes' }), true)
})
test('ignores other check violations and other errors', () => {
  assert.equal(isLimitReached({ code: '23514', message: 'new row violates check constraint "job_url_scheme"' }), false)
  assert.equal(isLimitReached({ code: '23505', message: 'limit_reached:resumes' }), false)
  assert.equal(isLimitReached(null), false)
  assert.equal(isLimitReached(undefined), false)
})
