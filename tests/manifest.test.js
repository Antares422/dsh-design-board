import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeManifest, manifestFromListing, metaOfHtml, fillFromHtml } from '../src/manifest.js'

test('补全标题和缺省 id，保留尺寸', () => {
  const m = normalizeManifest({ frames: [{ file: 'a.html', width: 800, height: 600 }, { id: 'x', file: 'b.html', title: 'B' }] })
  assert.equal(m.title, '设计画布')
  assert.deepEqual(m.frames.map(f => [f.id, f.title, f.width, f.height]), [['1', '方案 1', 800, 600], ['x', 'B', undefined, undefined]])
})

test('没有 file 的帧被丢弃，重复 id 加后缀', () => {
  const m = normalizeManifest({ frames: [{ id: 'a', file: 'a.html' }, { id: 'a', file: 'b.html' }, { id: 'c' }] })
  assert.deepEqual(m.frames.map(f => f.id), ['a', 'a-2'])
})

test('frames 不是数组时抛错', () => {
  assert.throws(() => normalizeManifest({}), /frames/)
  assert.throws(() => normalizeManifest(null), /frames/)
})

test('帧为空数组时抛错', () => {
  assert.throws(() => normalizeManifest({ frames: [] }), /没有可用的帧/)
})

test('尺寸不是正数时忽略', () => {
  const [f] = normalizeManifest({ frames: [{ file: 'a.html', width: -1, height: 'x' }] }).frames
  assert.equal(f.width, undefined)
  assert.equal(f.height, undefined)
})

test('manifestFromListing：没有清单时目录里的 html 按文件名排成帧，标题先用文件名', () => {
  const entries = [
    { name: 'b.html', type: 'file' }, { name: 'a.html', type: 'file' }, { name: 'shot.png', type: 'file' },
    { name: 'sub', type: 'directory' }, { name: 'board.json', type: 'file' }, { name: 'c.HTML', type: 'file' },
  ]
  const m = manifestFromListing('design/okr-board', entries)
  assert.equal(m.title, 'okr-board')
  assert.deepEqual(m.frames.map(f => [f.id, f.file, f.title, f.auto]), [['a', 'a.html', 'a', true], ['b', 'b.html', 'b', true], ['c', 'c.HTML', 'c', true]])
})

test('manifestFromListing：目录里一个 html 都没有或目录名为会话 ID 时标题显示设计画布，不抛错', () => {
  const empty = manifestFromListing('design/x', [])
  assert.deepEqual(empty.frames, [])
  assert.equal(empty.title, '设计画布')

  const sessionListed = manifestFromListing('design/session-04b93398-8f62-4db6-83be-969c0abb9813', [
    { name: 'a.html', type: 'file' },
  ])
  assert.equal(sessionListed.title, '设计画布')
})

test('metaOfHtml：取 <title> 和 viewport 里的 width/height', () => {
  assert.deepEqual(metaOfHtml('<title> OKR 看板 </title><meta name="viewport" content="width=1280, height=800">'), { title: 'OKR 看板', width: 1280, height: 800 })
  assert.deepEqual(metaOfHtml('<meta content="width=device-width, initial-scale=1" name="viewport">'), {})
  assert.deepEqual(metaOfHtml('<p>无</p>'), {})
})

test('fillFromHtml：只补自动生成的帧，清单里写明的不覆盖', () => {
  const html = '<title>真标题</title><meta name="viewport" content="width=390,height=844">'
  assert.deepEqual(fillFromHtml({ id: 'a', title: 'a', file: 'a.html', auto: true }, html), { id: 'a', title: '真标题', file: 'a.html', auto: true, width: 390, height: 844 })
  const explicit = { id: 'a', title: '清单标题', file: 'a.html', width: 1280 }
  assert.deepEqual(fillFromHtml(explicit, html), explicit)
  assert.equal(fillFromHtml({ id: 'a', title: 'a', file: 'a.html', auto: true, width: 1000 }, html).width, 1000)
})

test('pages 规整：保留合法 id、补 name、去重，非法 id 丢弃', () => {
  const m = normalizeManifest({
    pages: [{ id: 'a', name: '方案' }, { id: 'a', name: '重复' }, { id: 'bad id' }, { id: 'b' }, {}],
    frames: [{ file: 'x.html' }],
  })
  assert.deepEqual(m.pages, [{ id: 'a', name: '方案' }, { id: 'b', name: 'b' }])
})

test('frames[].page 只保留已声明的页，未声明或非法时归第一页', () => {
  const m = normalizeManifest({
    pages: [{ id: 'a' }, { id: 'b' }],
    frames: [
      { id: '1', file: '1.html', page: 'b' },
      { id: '2', file: '2.html', page: 'nope' },
      { id: '3', file: '3.html' },
    ],
  })
  assert.deepEqual(m.frames.map(f => f.page), ['b', undefined, undefined])
})

test('order 按 id 重排，未列出的按原顺序排在后面', () => {
  const m = normalizeManifest({
    frames: [{ id: 'a', file: 'a.html' }, { id: 'b', file: 'b.html' }, { id: 'c', file: 'c.html' }],
    order: ['c', 'nope', 'a'],
  })
  assert.deepEqual(m.frames.map(f => f.id), ['c', 'a', 'b'])
})

test('notes 只保留有文字的项，补 id/kind/坐标，page 非法时归第一页', () => {
  const m = normalizeManifest({
    pages: [{ id: 'a' }],
    frames: [{ file: 'x.html' }],
    notes: [
      { text: '流程 A', kind: 'title', x: 10, y: 20 },
      { text: '备注', page: 'nope' },
      { text: '' },
      { kind: 'title' },
      { text: '贴纸', kind: 'something', x: 'x' },
    ],
  })
  assert.deepEqual(m.notes, [
    { id: 'note-1', text: '流程 A', kind: 'title', page: undefined, x: 10, y: 20 },
    { id: 'note-2', text: '备注', kind: 'sticky', page: undefined, x: 0, y: 0 },
    { id: 'note-3', text: '贴纸', kind: 'sticky', page: undefined, x: 0, y: 0 },
  ])
})

test('没有 pages/order/notes 时返回空数组，老清单行为不变', () => {
  const m = normalizeManifest({ frames: [{ file: 'a.html' }] })
  assert.deepEqual([m.pages, m.notes], [[], []])
  assert.deepEqual(m.frames.map(f => f.id), ['1'])
})

test('manifestFromListing 也带空的 pages/notes，调用方不用判空', () => {
  const m = manifestFromListing('design/x', [{ name: 'a.html', type: 'file' }])
  assert.deepEqual([m.pages, m.notes], [[], []])
})

test('非有限尺寸（Infinity / NaN）当成没写', () => {
  const [f] = normalizeManifest({ frames: [{ file: 'a.html', width: Infinity, height: NaN }] }).frames
  assert.equal(f.width, undefined)
  assert.equal(f.height, undefined)
})

test('保留来源、版本、状态和上一版元数据', () => {
  const m = normalizeManifest({
    title: 'A', source: 'design/a', version: '3', status: 'review', updatedAt: '2026-11-01',
    preset: { id: 'apple', name: 'Apple', version: '1' }, previous: { version: '2', source: 'design/a@2' },
    frames: [{ file: 'a.html' }],
  })
  assert.deepEqual({ m: m.source, v: m.version, s: m.status, at: m.updatedAt, p: m.preset, previous: m.previous }, {
    m: 'design/a', v: '3', s: 'review', at: '2026-11-01', p: { id: 'apple', name: 'Apple', version: '1' }, previous: { version: '2', source: 'design/a@2' },
  })
})
