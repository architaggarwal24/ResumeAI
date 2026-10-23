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
