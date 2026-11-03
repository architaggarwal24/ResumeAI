import test from 'node:test'
import assert from 'node:assert/strict'
import { itemsToText } from '../../src/lib/pdf/extract.ts'

const it = (str, x, y, w = str.length * 5, h = 10) => ({ str, transform: [h, 0, 0, h, x, y], width: w, height: h })

test('keeps line breaks and left-to-right order within a line', () => {
  const items = [it('Doe', 80, 700), it('Jane', 50, 700.6), it('Experience', 50, 660), it('• Built APIs', 50, 645)]
  assert.equal(itemsToText(items), 'Jane Doe\nExperience\n• Built APIs')
})
test('separates far-apart columns on the same baseline', () => {
  assert.equal(itemsToText([it('Acme Corp', 50, 600, 45), it('2021 – 2023', 450, 600, 55)]), 'Acme Corp   2021 – 2023')
})
test('does not insert spaces inside split words', () => {
  assert.equal(itemsToText([it('Kuber', 50, 500, 25), it('netes', 75, 500, 25)]), 'Kubernetes')
})
test('ignores empty and malformed items', () => {
  assert.equal(itemsToText([{ str: '' }, { str: 'x' }, it('ok', 1, 1)]), 'ok')
})
