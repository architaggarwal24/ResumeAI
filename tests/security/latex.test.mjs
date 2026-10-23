import test from 'node:test'
import assert from 'node:assert/strict'
import { texEscape } from '../../src/lib/templates/latex.ts'

test('escapes special characters', () => {
  assert.equal(texEscape('100% R&D_x $5 #1 {a} ~ ^'), '100\\% R\\&D\\_x \\$5 \\#1 \\{a\\} \\textasciitilde{} \\textasciicircum{}')
})
test('backslash becomes \\textbackslash{} exactly (no double-escaped braces)', () => {
  assert.equal(texEscape('a\\b'), 'a\\textbackslash{}b')
})
test('hostile control sequences are neutralised', () => {
  const out = texEscape('\\input{/etc/passwd} \\write18{id}')
  assert.ok(!/\\input|\\write18/.test(out.replace(/\\textbackslash\{\}/g, '')))
  assert.ok(!out.includes('\\input{'))
})
test('empty / non-string safe', () => {
  assert.equal(texEscape(''), ''); assert.equal(texEscape(undefined), ''); assert.equal(texEscape(5), '5')
})
