import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { newBoard, scanBoards, scanDesignDirs } from '../src/scan.js'

let boardModulePromise
function loadBoardModule() {
  if (!boardModulePromise) {
    boardModulePromise = build({
      entryPoints: [new URL('../src/Board.jsx', import.meta.url).pathname],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'node',
      jsx: 'automatic',
      loader: { '.css': 'text' },
      external: ['react', 'react-dom', 'react/jsx-runtime', '@xyflow/react', 'html-to-image', 'pdf-lib'],
    }).then(({ outputFiles }) => {
      const req = createRequire(import.meta.url)
      const mod = { exports: {} }
      new Function('module', 'exports', 'require', outputFiles[0].text)(mod, mod.exports, id => (id.endsWith('.css') ? '' : req(id)))
      return mod.exports
    })
  }
  return boardModulePromise
}

function findElements(node, predicate, acc = []) {
  if (!node) return acc
  if (typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, acc)
    return acc
  }
  if (predicate(node)) acc.push(node)
  if (node.props?.children) findElements(node.props.children, predicate, acc)
  return acc
}

const dir = (...names) => ({ ok: true, value: { entries: names.map(n => ({ name: n, type: n.includes('.') ? 'file' : 'directory' })), truncated: false } })
const fakeList = tree => async (path) => tree[path] ?? { ok: false, error: { code: 'not-found' } }

test('扫 design/ 下各任务目录里的 board.json', async () => {
  const list = fakeList({
    design: dir('a', 'b', 'notes.md'),
    'design/a': dir('board.json', 'a.html'),
    'design/b': dir('notes.txt'),
  })
  assert.deepEqual(await scanBoards(list), ['design/a/board.json'])
})

test('没有 board.json 但有 html 的任务目录也认领（路径仍记为 board.json，文件可以不存在）', async () => {
  const list = fakeList({
    design: dir('a', 'b', 'c'),
    'design/a': dir('a.html'),
    'design/b': dir('shot.png', 'notes.md'),
    'design/c': dir('A.HTML'),
  })
  assert.deepEqual(await scanBoards(list), ['design/a/board.json', 'design/c/board.json'])
})

test('design/ 还不存在时返回空数组', async () => {
  assert.deepEqual(await scanBoards(fakeList({})), [])
})

test('某个子目录读失败时跳过它，其余照常返回', async () => {
  const list = fakeList({ design: dir('a', 'b'), 'design/b': dir('board.json') })
  assert.deepEqual(await scanBoards(list), ['design/b/board.json'])
})

test('scanDesignDirs 返回可选择的设计目录，不自动打开画布', async () => {
  const list = fakeList({
    design: dir('okr', 'empty'),
    'design/okr': dir('board.json', 'a.html'),
    'design/empty': dir('notes.md'),
  })
  assert.deepEqual(await scanDesignDirs(list), [{ path: 'design/okr', name: 'okr', files: 2, updatedAt: undefined }])
})

test('newBoard 取不在基线里的第一个，没有则 undefined', () => {
  assert.equal(newBoard(['design/a/board.json'], ['design/a/board.json', 'design/b/board.json']), 'design/b/board.json')
  assert.equal(newBoard(['design/a/board.json'], ['design/a/board.json']), undefined)
})

test('scanDesignDirs 传入 readBytes 时优先按清单顺序读取首个 HTML 预览，无清单时回退目录首个 html', async () => {
  const list = fakeList({
    design: dir('ordered', 'auto', 'pending'),
    'design/ordered': dir('board.json', 'a.html', 'b.html'),
    'design/auto': dir('2.html', '10.html'),
    'design/pending': dir('board.json'),
  })
  const files = {
    'design/ordered/board.json': JSON.stringify({
      title: '官网',
      order: ['b', 'a'],
      frames: [
        { id: 'a', file: 'a.html', width: 1280 },
        { id: 'b', file: 'b.html', width: 1440 },
      ],
    }),
    'design/ordered/a.html': '<!doctype html><main>A</main>',
    'design/ordered/b.html': '<!doctype html><main>B</main>',
    'design/auto/2.html': '<!doctype html><meta name="viewport" content="width=1024,height=768"><main>Two</main>',
    'design/auto/10.html': '<!doctype html><main>Ten</main>',
    'design/pending/board.json': JSON.stringify({ title: '空', frames: [{ id: 'x', file: 'x.html' }] }),
  }
  const readBytes = async (p) => (p in files
    ? { ok: true, value: { data: new TextEncoder().encode(files[p]) } }
    : { ok: false, error: { code: 'not-found' } })
  const dirs = await scanDesignDirs(list, readBytes)
  assert.deepEqual(dirs.map(d => [d.name, d.preview?.file ?? null, d.preview?.width ?? null]), [
    ['auto', '2.html', 1024],
    ['ordered', 'b.html', 1440],
    ['pending', null, null],
  ])
})

test('DirectoryPickerView 保留加载、失败与空目录状态，ready 时始终把「新建」作为首张卡片', async () => {
  const { DirectoryPickerView } = await loadBoardModule()
  const loadingHtml = renderToStaticMarkup(React.createElement(DirectoryPickerView, { state: { status: 'loading', items: [] }, open: () => {} }))
  assert.match(loadingHtml, /dsb-root dsb-dir-page/)
  assert.match(loadingHtml, /正在读取…/)
  assert.doesNotMatch(loadingHtml, /dsb-dir-grid/)
  assert.doesNotMatch(loadingHtml, /选择一个目录进入看板/)

  const errorHtml = renderToStaticMarkup(React.createElement(DirectoryPickerView, { state: { status: 'error', items: [] }, open: () => {} }))
  assert.match(errorHtml, /读取设计目录失败/)
  assert.doesNotMatch(errorHtml, /dsb-dir-grid/)

  const emptyHtml = renderToStaticMarkup(React.createElement(DirectoryPickerView, { state: { status: 'ready', items: [] }, open: () => {} }))
  assert.match(emptyHtml, /dsb-dir-grid/)
  assert.match(emptyHtml, /新建/)
})

test('DirectoryPickerView 首张卡片为「新建」，后续卡片直接渲染首个 HTML 缩略图并支持整卡点击进入看板', async () => {
  const { DirectoryPickerView, OVERRIDE_CSS } = await loadBoardModule()
  const items = [
    { path: 'design/atlas-launch-20261101', name: 'atlas-launch-20261101', files: 2, preview: { html: '<!doctype html><main>Atlas Hero</main>', width: 1280, file: 'a.html' } },
    { path: 'design/lumen-crm-20261101', name: 'lumen-crm-20261101', files: 4, preview: null },
  ]
  const opened = []
  const tree = DirectoryPickerView({
    state: { status: 'ready', items },
    open: p => opened.push(p),
  })
  const cards = findElements(tree, el => el.type === 'button' && el.props?.className === 'dsb-dir-card')
  assert.equal(cards.length, 3)
  assert.equal(cards[0].props.title, '新建')
  cards[0].props.onClick()
  cards[2].props.onClick()
  assert.deepEqual(opened, ['(blank)', 'design/lumen-crm-20261101/board.json'])

  const html = renderToStaticMarkup(tree)
  assert.match(html, /class="dsb-dir-grid"/)
  assert.match(html, /class="dsb-dir-preview"/)
  assert.match(html, /<iframe[^>]*sandbox="allow-scripts"/)
  assert.match(html, /Atlas Hero/)
  assert.match(html, /暂无页面预览/)
  assert.doesNotMatch(html, /dsb-dir-icon/)
  assert.match(html, /atlas-launch-20261101/)
  assert.match(html, /2 个文件/)
  assert.match(html, /4 个文件/)
  assert.match(html, /进入/)
  assert.match(html, /rotate\(-90deg\)/)
  for (const ch of ['\u00b7', '\u007c', '\u2014']) assert.equal(html.includes(ch), false)

  const dirCss = OVERRIDE_CSS.slice(OVERRIDE_CSS.indexOf('.dsb-dir-page'))
  assert.match(dirCss, /repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(dirCss, /repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(dirCss, /minmax\(0, 1fr\)/)
  assert.match(dirCss, /aspect-ratio:\s*16 \/ 10/)
  assert.match(dirCss, /height:\s*64px/)
  assert.match(dirCss, /\.dsb-dir-card:hover/)
  assert.match(dirCss, /\.dsb-dir-card:active/)
  assert.match(dirCss, /\.dsb-dir-card:focus-visible/)
  assert.equal(/gradient/i.test(dirCss), false)
  for (const ch of ['\u00b7', '\u007c', '\u2014']) assert.equal(dirCss.includes(ch), false)
})
