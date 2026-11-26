import test from 'node:test'
import assert from 'node:assert/strict'
import { findHitSelection, intersectFramesWithMarquee, pickCovered, toggleSelections } from '../src/hit.js'

test('toggleSelections 框内已选的取消，未选的加入，框外的保持', () => {
  const k = key => ({ key })
  const out = toggleSelections([k('a'), k('b'), k('z')], [k('a'), k('c')])
  assert.deepEqual(out.map(s => s.key), ['b', 'z', 'c'])
})

const el = (id, parent, x, y, w, h, extra = {}) => ({ id, parent, rect: { x, y, w, h }, selector: '#' + id, text: id, ...extra })

test('选取与框重叠面积达到一半以上的元素', () => {
  const out = pickCovered([el('in', null, 10, 10, 50, 50), el('out', null, 200, 200, 50, 50)], { x: 0, y: 0, w: 100, h: 100 })
  assert.deepEqual(out.map(e => e.id), ['in'])
})

test('只有一小部分在框里的元素不选', () => {
  const out = pickCovered([el('edge', null, 90, 0, 100, 100)], { x: 0, y: 0, w: 100, h: 100 })
  assert.deepEqual(out, [])
})

test('父子都符合时只留最内层', () => {
  const out = pickCovered(
    [el('box', null, 0, 0, 100, 100), el('btn', 'box', 10, 10, 40, 20)],
    { x: 0, y: 0, w: 100, h: 100 },
  )
  assert.deepEqual(out.map(e => e.id), ['btn'])
})

test('子元素不符合时保留父元素', () => {
  const out = pickCovered(
    [el('box', null, 0, 0, 100, 100), el('far', 'box', 500, 500, 10, 10)],
    { x: 0, y: 0, w: 100, h: 100 },
  )
  assert.deepEqual(out.map(e => e.id), ['box'])
})

test('超过上限时只取前几个，保持文档顺序', () => {
  const els = Array.from({ length: 5 }, (_, i) => el('e' + i, null, i * 10, 0, 8, 8))
  const out = pickCovered(els, { x: 0, y: 0, w: 100, h: 100 }, 3)
  assert.deepEqual(out.map(e => e.id), ['e0', 'e1', 'e2'])
})

test('面积为零的元素忽略', () => {
  assert.deepEqual(pickCovered([el('z', null, 10, 10, 0, 0)], { x: 0, y: 0, w: 100, h: 100 }), [])
})

test('祖先链跨多层时仍只留最内层', () => {
  const out = pickCovered(
    [el('a', null, 0, 0, 100, 100), el('b', 'a', 0, 0, 90, 90), el('c', 'b', 5, 5, 20, 20)],
    { x: 0, y: 0, w: 100, h: 100 },
  )
  assert.deepEqual(out.map(e => e.id), ['c'])
})

test('不传上限时默认最多取 8 个', () => {
  const els = Array.from({ length: 12 }, (_, i) => el('e' + i, null, i * 5, 0, 4, 4))
  assert.equal(pickCovered(els, { x: 0, y: 0, w: 100, h: 100 }).length, 8)
})

test('intersectFramesWithMarquee 计算选框与单帧或多帧的交集并折算为帧内局部坐标', () => {
  const pageFrames = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }]
  const boxes = {
    f1: { x: 0, y: 50, w: 200, h: 200 },
    f2: { x: 250, y: 50, w: 200, h: 200 },
    f3: { x: 0, y: 300, w: 200, h: 200 },
  }
  const boxOf = id => boxes[id] || null

  // 1. 框选范围完全在 f1 外部（画布空白区），无交集
  assert.deepEqual(intersectFramesWithMarquee({ x: -100, y: -50, w: 80, h: 80 }, pageFrames, boxOf), [])

  // 2. 框选从外部起笔，跨入 f1 局部
  const hits1 = intersectFramesWithMarquee({ x: -50, y: 20, w: 100, h: 80 }, pageFrames, boxOf)
  assert.deepEqual(hits1, [
    { frameId: 'f1', localBox: { x: 0, y: 0, w: 50, h: 50 } },
  ])

  // 3. 跨越 f1 和 f2 两个帧
  const hits2 = intersectFramesWithMarquee({ x: 100, y: 100, w: 200, h: 50 }, pageFrames, boxOf)
  assert.deepEqual(hits2, [
    { frameId: 'f1', localBox: { x: 100, y: 50, w: 100, h: 50 } },
    { frameId: 'f2', localBox: { x: 0, y: 50, w: 50, h: 50 } },
  ])

  // 4. 参数缺失或非法尺寸
  assert.deepEqual(intersectFramesWithMarquee(null, pageFrames, boxOf), [])
  assert.deepEqual(intersectFramesWithMarquee({ x: 0, y: 0, w: 0, h: 0 }, pageFrames, boxOf), [])
})

test('findHitSelection 命中已选元素主体或标签badge，多重嵌套时优先返回内层元素', () => {
  const selections = [
    { key: 'f1|card|10,10', frameId: 'f1', tag: 'div', rect: { x: 10, y: 20, w: 200, h: 100 } },
    { key: 'f1|btn|30,30', frameId: 'f1', tag: 'button', rect: { x: 30, y: 40, w: 60, h: 30 } },
    { key: 'f2|header|0,0', frameId: 'f2', tag: 'header', rect: { x: 0, y: 0, w: 100, h: 40 } },
  ]

  // 1. 点击按钮内部：同时在 card 和 btn 内部，返回较小的 btn
  const hitBtn = findHitSelection(selections, 'f1', { x: 40, y: 50 })
  assert.equal(hitBtn?.key, 'f1|btn|30,30')

  // 2. 点击 card 内部但不在 btn 内部：返回 card
  const hitCard = findHitSelection(selections, 'f1', { x: 150, y: 50 })
  assert.equal(hitCard?.key, 'f1|card|10,10')

  // 3. 点击 card 上方的 tag 标签区域（y: 20 上方，例如 y: 10）
  const hitCardBadge = findHitSelection(selections, 'f1', { x: 15, y: 10 })
  assert.equal(hitCardBadge?.key, 'f1|card|10,10')

  // 4. 坐标在 f2 的 header 内（x: 5, y: 5），但传入 frameId 为 f1，不命中
  assert.equal(findHitSelection(selections, 'f1', { x: 5, y: 5 }), null)

  // 5. 点击完全空白区，不命中
  assert.equal(findHitSelection(selections, 'f1', { x: 500, y: 500 }), null)
})
