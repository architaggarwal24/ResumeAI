import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJsonObject } from '../../src/lib/llm/parse.ts'

test('plain JSON', () => assert.deepEqual(extractJsonObject('{"a":1}'), { ok: true, value: { a: 1 } }))
test('fenced JSON', () => assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { ok: true, value: { a: 1 } }))
test('strips <think> block', () => assert.deepEqual(extractJsonObject('<think>hmm {"x":9}</think>{"a":2}'), { ok: true, value: { a: 2 } }))
test('falls back to JSON inside a think-only reply', () => assert.deepEqual(extractJsonObject('<think>{"a":3}</think>'), { ok: true, value: { a: 3 } }))
test('no JSON', () => assert.deepEqual(extractJsonObject('sorry I cannot'), { ok: false, reason: 'no_json' }))
test('empty object', () => assert.deepEqual(extractJsonObject('{}'), { ok: false, reason: 'empty' }))
test('invalid JSON', () => assert.deepEqual(extractJsonObject('{a:1}'), { ok: false, reason: 'invalid' }))
test('arrays are not accepted as results', () => assert.equal(extractJsonObject('[1,2]').ok, false))

// ─── Real-world model output defects (upload "Could not parse … JSON" bug) ───
const resume = { name: 'Jane Doe', summary: 'Backend engineer.', experience: [{ id: 'exp_1', bullets: [{ id: 'bul_1_1', text: 'Built APIs' }, { id: 'bul_1_2', text: 'Ran services' }] }], skills: { categories: [{ name: 'Go', items: ['Go', 'SQL'] }] } }
const pretty = JSON.stringify(resume, null, 2)

test('chatter after the JSON that contains braces', () => {
  const r = extractJsonObject('Here you go:\n```json\n' + pretty + '\n```\nAnything else? {:)}')
  assert.equal(r.ok, true); assert.deepEqual(r.value, resume)
})
test('raw line breaks and tabs inside strings', () => {
  const r = extractJsonObject(pretty.replace('Backend engineer.', 'Backend\nengineer.\tReliable.'))
  assert.equal(r.ok, true); assert.equal(r.value.summary, 'Backend\nengineer.\tReliable.')
})
test('unescaped quotes inside a string', () => {
  const r = extractJsonObject('{"name": "Jane", "summary": "Migrated the "legacy" billing system", "x": 1}')
  assert.equal(r.ok, true); assert.equal(r.value.summary, 'Migrated the "legacy" billing system')
})
test('trailing commas, comments and Python literals', () => {
  const r = extractJsonObject('{\n // parsed\n "a": [1, 2,],\n "b": True, "c": None, /* x */ "d": {"e": "f",},\n}')
  assert.deepEqual(r.value, { a: [1, 2], b: true, c: null, d: { e: 'f' } })
})
test('smart quotes used as JSON quotes', () => {
  assert.deepEqual(extractJsonObject('{“name”: “Jane”}').value, { name: 'Jane' })
})
test('missing comma between members', () => {
  assert.deepEqual(extractJsonObject('{"a": "x"\n "b": 2}').value, { a: 'x', b: 2 })
})
test('truncated output is cut back to the last complete member and flagged', () => {
  const cut = pretty.slice(0, pretty.indexOf('Ran services') + 4)
  const r = extractJsonObject(cut)
  assert.equal(r.ok, true); assert.equal(r.truncated, true)
  assert.equal(r.value.name, 'Jane Doe')
  assert.deepEqual(r.value.experience[0].bullets[0], { id: 'bul_1_1', text: 'Built APIs' })
  assert.equal(r.value.experience[0].bullets[1].text, undefined, 'the half-written member is dropped')
})
test('truncated inside a key', () => {
  const r = extractJsonObject('{"a": 1, "b": [1, 2], "na')
  assert.deepEqual(r.value, { a: 1, b: [1, 2] }); assert.equal(r.truncated, true)
})
test('clean JSON is not marked as repaired', () => {
  assert.deepEqual(extractJsonObject(pretty), { ok: true, value: resume })
})
test('reasoning text with brace fragments is still rejected', () => {
  assert.equal(extractJsonObject('Okay, the user wants a JSON object with fields {name, email}. I should parse').ok, false)
})

test('coach edit-block JSON with raw newlines and inner quotes parses', () => {
  const block = '{"targetId":"bul_1_1","section":"experience","label":"x","original":"a","suggested":"Line one\nline "two"","reason":"r"}'
  const r = extractJsonObject(block)
  assert.equal(r.ok, true); assert.equal(r.value.suggested, 'Line one\nline "two"')
})
