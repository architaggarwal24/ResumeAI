import test from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from '../../src/lib/security/rate-limit.ts'

test('allows up to limit then blocks', () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 1000 })
  for (let i = 0; i < 3; i++) assert.equal(rl.check('u', 0).allowed, true)
  const d = rl.check('u', 10)
  assert.equal(d.allowed, false); assert.ok(d.retryAfterMs > 0 && d.retryAfterMs <= 1000)
})
test('window resets', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000 })
  assert.equal(rl.check('u', 0).allowed, true)
  assert.equal(rl.check('u', 500).allowed, false)
  assert.equal(rl.check('u', 1001).allowed, true)
})
test('keys are independent', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000 })
  assert.equal(rl.check('a', 0).allowed, true); assert.equal(rl.check('b', 0).allowed, true)
})
test('memory is bounded', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 50 })
  for (let i = 0; i < 500; i++) rl.check('k' + i, 0)
  assert.ok(rl.size() <= 50)
})
