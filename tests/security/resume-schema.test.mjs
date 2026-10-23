import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeResumeData, isTemplateId } from '../../src/lib/security/resume-schema.ts'

test('rejects non-objects', () => {
  for (const v of [null, undefined, 'x', 5, [], true]) assert.equal(sanitizeResumeData(v), null)
})
test('empty object yields fully-shaped resume', () => {
  const r = sanitizeResumeData({})
  assert.equal(r.name, ''); assert.deepEqual(r.experience, []); assert.deepEqual(r.skills, { categories: [] })
  assert.deepEqual(r.awards, []); assert.deepEqual(r.languages, [])
})
test('coerces wrong types instead of throwing downstream', () => {
  const r = sanitizeResumeData({ name: 5, experience: 'oops', skills: { categories: 'x' }, education: [null, 3, {}], projects: { a: 1 } })
  assert.equal(r.name, ''); assert.deepEqual(r.experience, []); assert.deepEqual(r.skills.categories, [])
  assert.equal(r.education.length, 1); assert.deepEqual(r.projects, [])
})
test('keeps valid content', () => {
  const r = sanitizeResumeData({
    name: 'Ada', email: 'a@b.co',
    experience: [{ id: 'e1', company: 'X', title: 'Eng', location: 'L', dates: '2020', bullets: [{ id: 'b1', text: 'Did a thing' }] }],
    skills: { categories: [{ name: 'Lang', items: ['TS', 'Go'] }] },
  })
  assert.equal(r.experience[0].bullets[0].text, 'Did a thing')
  assert.deepEqual(r.skills.categories[0].items, ['TS', 'Go'])
})
test('drops unknown keys and cannot pollute prototypes', () => {
  const evil = JSON.parse('{"__proto__":{"polluted":1},"constructor":{"x":1},"name":"A","extra":"zzz"}')
  const r = sanitizeResumeData(evil)
  assert.equal(r.extra, undefined); assert.equal({}.polluted, undefined); assert.equal(r.polluted, undefined)
})
test('caps string and array sizes', () => {
  const r = sanitizeResumeData({
    name: 'n'.repeat(5000), summary: 's'.repeat(50000),
    experience: Array.from({ length: 200 }, () => ({ company: 'c', title: 't', bullets: Array.from({ length: 200 }, () => ({ text: 'x'.repeat(5000) })) })),
  })
  assert.ok(r.name.length <= 200); assert.ok(r.summary.length <= 5000)
  assert.ok(r.experience.length <= 30); assert.ok(r.experience[0].bullets.length <= 30)
  assert.ok(r.experience[0].bullets[0].text.length <= 1000)
})
test('bullets get ids even when missing', () => {
  const r = sanitizeResumeData({ experience: [{ bullets: [{ text: 'a' }, 'bare string'] }] })
  assert.ok(r.experience[0].bullets[0].id.length > 0)
  assert.equal(r.experience[0].bullets[1].text, 'bare string')
})
test('isTemplateId', () => {
  assert.equal(isTemplateId('classic'), true); assert.equal(isTemplateId('modern'), true)
  assert.equal(isTemplateId('<script>'), false); assert.equal(isTemplateId(undefined), false)
})
