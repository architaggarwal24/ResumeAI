import test from 'node:test'
import assert from 'node:assert/strict'
import { isCandidateForFull, isSoftwareRenderer, passesProbe, nextTierAfterSample, readCachedLite, LITE_CACHE_MS } from '../../src/lib/motion-governor.ts'

const strong = { reducedMotion: false, coarsePointer: false, cores: 12, memoryGb: 16, saveData: false, width: 1600, reducedTransparency: false, renderer: 'ANGLE (NVIDIA GeForce RTX 4070)' }

test('only clearly capable desktops are candidates for full effects', () => {
  assert.equal(isCandidateForFull(strong), true)
  assert.equal(isCandidateForFull({ ...strong, cores: 6 }), false)
  assert.equal(isCandidateForFull({ ...strong, memoryGb: 4 }), false)
  assert.equal(isCandidateForFull({ ...strong, coarsePointer: true }), false)
  assert.equal(isCandidateForFull({ ...strong, saveData: true }), false)
  assert.equal(isCandidateForFull({ ...strong, width: 900 }), false)
  assert.equal(isCandidateForFull({ ...strong, reducedTransparency: true }), false)
  assert.equal(isCandidateForFull({ ...strong, reducedMotion: true }), false)
  assert.equal(isCandidateForFull({ ...strong, renderer: 'Google SwiftShader' }), false)
})

test('unknown memory (Safari/Firefox) does not block full', () => {
  assert.equal(isCandidateForFull({ ...strong, memoryGb: undefined }), true)
})

test('software / fallback GPUs are detected', () => {
  for (const r of ['Google SwiftShader', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))']) {
    assert.equal(isSoftwareRenderer(r), true, r)
  }
  assert.equal(isSoftwareRenderer('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)'), false)
  assert.equal(isSoftwareRenderer(null), false)
})

test('probe must hold close to 60fps before full effects turn on', () => {
  assert.equal(passesProbe(58), true)
  assert.equal(passesProbe(119), true)
  assert.equal(passesProbe(44), false)
  assert.equal(passesProbe(30), false) // e.g. laptop energy-saver caps rAF at 30
})

test('full drops to lite after two slow samples, or one very slow one', () => {
  assert.deepEqual(nextTierAfterSample('full', 55, 0), { tier: 'full', strikes: 0 })
  assert.deepEqual(nextTierAfterSample('full', 38, 0), { tier: 'full', strikes: 1 })
  assert.deepEqual(nextTierAfterSample('full', 38, 1), { tier: 'lite', strikes: 0 })
  assert.deepEqual(nextTierAfterSample('full', 22, 0), { tier: 'lite', strikes: 0 })
  assert.deepEqual(nextTierAfterSample('full', 55, 1), { tier: 'full', strikes: 0 })
})

test('a cached downgrade is honoured until it expires', () => {
  const now = 1_000_000
  assert.equal(readCachedLite(JSON.stringify({ tier: 'lite', until: now + 10 }), now), true)
  assert.equal(readCachedLite(JSON.stringify({ tier: 'lite', until: now - 10 }), now), false)
  assert.equal(readCachedLite('garbage', now), false)
  assert.equal(readCachedLite(null, now), false)
  assert.ok(LITE_CACHE_MS >= 24 * 3600_000)
})
