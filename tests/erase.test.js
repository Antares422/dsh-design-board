import test from 'node:test'
import assert from 'node:assert/strict'
import { hitAnnotations } from '../src/erase.js'

const rect = { id: 'r', type: 'rect', x: 100, y: 100, w: 200, h: 100 }
const pen = { id: 'p', type: 'pen', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }
const text = { id: 't', type: 'text', x: 500, y: 500 }

test('点在矩形内、或离边在容差内都算命中', () => {
  assert.deepEqual(hitAnnotations([rect], { x: 150, y: 150 }, 6), ['r'])
  assert.deepEqual(hitAnnotations([rect], { x: 97, y: 150 }, 6), ['r'])
  assert.deepEqual(hitAnnotations([rect], { x: 90, y: 150 }, 6), [])
})

test('画笔只在离折线容差内才命中，线圈内部不算', () => {
  assert.deepEqual(hitAnnotations([pen], { x: 50, y: 4 }, 6), ['p'])
  assert.deepEqual(hitAnnotations([pen], { x: 100, y: 50 }, 6), ['p'])
  assert.deepEqual(hitAnnotations([pen], { x: 50, y: 50 }, 6), [])
})

test('单点画笔按到点的距离判断', () => {
  const dot = { id: 'd', type: 'pen', points: [{ x: 10, y: 10 }] }
  assert.deepEqual(hitAnnotations([dot], { x: 12, y: 12 }, 6), ['d'])
  assert.deepEqual(hitAnnotations([dot], { x: 30, y: 30 }, 6), [])
})

test('文字标注按锚点附近命中', () => {
  assert.deepEqual(hitAnnotations([text], { x: 505, y: 495 }, 6), ['t'])
  assert.deepEqual(hitAnnotations([text], { x: 540, y: 500 }, 6), [])
})

test('多个命中时后画的在前', () => {
  const inner = { id: 'r2', type: 'rect', x: 120, y: 120, w: 20, h: 20 }
  assert.deepEqual(hitAnnotations([rect, inner], { x: 130, y: 130 }, 6), ['r2', 'r'])
})

import { hitSelections } from '../src/erase.js'

const originOf = (frameId) => ({ a: { x: 1000, y: 200 }, b: { x: 3000, y: 200 } })[frameId]
const sel = { key: 'a|h1', frameId: 'a', rect: { x: 20, y: 30, w: 100, h: 40 } }

test('选中元素：点在框内或离边在容差内命中（框坐标 = 帧原点 + 帧内坐标）', () => {
  assert.deepEqual(hitSelections([sel], originOf, { x: 1050, y: 250 }, 6), ['a|h1'])
  assert.deepEqual(hitSelections([sel], originOf, { x: 1017, y: 250 }, 6), ['a|h1'])
  assert.deepEqual(hitSelections([sel], originOf, { x: 1010, y: 250 }, 6), [])
})

test('选中元素：帧已消失时不命中也不报错', () => {
  assert.deepEqual(hitSelections([{ key: 'x|p', frameId: 'x', rect: { x: 0, y: 0, w: 10, h: 10 } }], originOf, { x: 0, y: 0 }, 6), [])
})
