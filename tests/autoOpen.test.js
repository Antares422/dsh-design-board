import test from 'node:test'
import assert from 'node:assert/strict'
import { autoOpenStep } from '../src/autoOpen.js'

test('第一次扫描只建基线，不打开任何东西', () => {
  assert.deepEqual(autoOpenStep(undefined, ['design/a/board.json']), { baseline: ['design/a/board.json'], open: undefined })
})

test('基线之后新出现的看板打开一次，并记入基线', () => {
  const first = autoOpenStep(['design/a/board.json'], ['design/a/board.json', 'design/b/board.json'])
  assert.equal(first.open, 'design/b/board.json')
  assert.equal(autoOpenStep(first.baseline, ['design/a/board.json', 'design/b/board.json']).open, undefined)
})

test('看板消失再出现不重复打开（用户可能已关掉）', () => {
  const step = autoOpenStep(['design/a/board.json'], [])
  assert.equal(autoOpenStep(step.baseline, ['design/a/board.json']).open, undefined)
})

test('一次出现多块只打开第一块，其余也记入基线', () => {
  const step = autoOpenStep([], ['design/a/board.json', 'design/b/board.json'])
  assert.equal(step.open, 'design/a/board.json')
  assert.deepEqual(step.baseline, ['design/a/board.json', 'design/b/board.json'])
})
