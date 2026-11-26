import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutFrames, DEFAULT_SIZE } from '../src/layout.js'

const frame = (id, width, height) => ({ id, width, height })

test('两帧同一行，第二帧在第一帧右侧留出间距', () => {
  const [a, b] = layoutFrames([frame('a', 400, 300), frame('b', 400, 300)], { gap: 100 })
  assert.deepEqual([a.x, a.y], [0, 0])
  assert.deepEqual([b.x, b.y], [500, 0])
})

test('超出列数换行，行高取该行最高的帧加标题高度', () => {
  const out = layoutFrames(
    [frame('a', 400, 300), frame('b', 400, 500), frame('c', 400, 300)],
    { columns: 2, gap: 100, titleHeight: 40 },
  )
  assert.deepEqual([out[2].x, out[2].y], [0, 500 + 40 + 100])
})

test('未给列数：不超过三帧时全在一行，更多则三列', () => {
  const three = layoutFrames([frame('a', 100, 100), frame('b', 100, 100), frame('c', 100, 100)], { gap: 10 })
  assert.equal(new Set(three.map(n => n.y)).size, 1)
  const four = layoutFrames(Array.from({ length: 4 }, (_, i) => frame(String(i), 100, 100)), { gap: 10 })
  assert.equal(new Set(four.map(n => n.y)).size, 2)
})

test('缺尺寸的帧用默认尺寸', () => {
  const [a] = layoutFrames([{ id: 'a' }], {})
  assert.deepEqual([a.width, a.height], [DEFAULT_SIZE.width, DEFAULT_SIZE.height])
})

test('列数非法时按默认处理，不抛错', () => {
  const out = layoutFrames([frame('a', 100, 100), frame('b', 100, 100)], { columns: 0 })
  assert.equal(out.length, 2)
})

test('空清单返回空数组', () => {
  assert.deepEqual(layoutFrames([], {}), [])
})
