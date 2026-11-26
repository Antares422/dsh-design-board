import test from 'node:test'
import assert from 'node:assert/strict'
import { currentPageId, framesOnPage, notesOnPage } from '../src/pages.js'

const pages = [{ id: 'a', name: '方向 A' }, { id: 'b', name: '方向 B' }]
const frames = [
  { id: '1', page: 'b' },
  { id: '2', page: 'a' },
  { id: '3' },
]
const notes = [
  { id: 'n1', page: 'b', text: 'B 区' },
  { id: 'n2', page: 'a', text: 'A 区' },
  { id: 'n3', text: '第一页' },
]

test('没有 pages 时所有帧和便签都在同一页', () => {
  assert.deepEqual(framesOnPage(frames, null, []), frames)
  assert.deepEqual(notesOnPage(notes, null, []), notes)
  assert.equal(currentPageId('b', []), null)
})

test('按页过滤帧，未标 page 的归第一页', () => {
  assert.deepEqual(framesOnPage(frames, 'a', pages).map(f => f.id), ['2', '3'])
  assert.deepEqual(framesOnPage(frames, 'b', pages).map(f => f.id), ['1'])
})

test('按页过滤便签，未标 page 的归第一页', () => {
  assert.deepEqual(notesOnPage(notes, 'a', pages).map(n => n.id), ['n2', 'n3'])
  assert.deepEqual(notesOnPage(notes, 'b', pages).map(n => n.id), ['n1'])
})

test('当前页不存在时回落到第一页', () => {
  assert.equal(currentPageId('a', pages), 'a')
  assert.equal(currentPageId('nope', pages), 'a')
  assert.equal(currentPageId(null, pages), 'a')
})
