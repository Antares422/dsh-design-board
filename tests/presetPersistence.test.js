import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

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

class MockStorage {
  constructor() {
    this.map = new Map()
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null
  }
  setItem(key, value) {
    this.map.set(key, String(value))
  }
  removeItem(key) {
    this.map.delete(key)
  }
  clear() {
    this.map.clear()
  }
}

test('presetById 仅解析内置官方预设，拒绝非法或外部前缀 id', async () => {
  const { presetById } = await loadBoardModule()
  const official = presetById('apple')
  assert.equal(official?.id, 'apple')

  const airbnb = presetById('airbnb')
  assert.equal(airbnb?.id, 'airbnb')

  assert.equal(presetById('me/custom'), undefined)
  assert.equal(presetById('co/company'), undefined)
  assert.equal(presetById('invalid_xxx'), undefined)
  assert.equal(presetById(null), undefined)
})

test('设计体系持久化：保存后退出并重新进入，能正确恢复已选体系', async () => {
  const { boardPresetKey, sessionPresetKey, loadPreset, savePreset } = await loadBoardModule()
  const original = globalThis.localStorage
  globalThis.localStorage = new MockStorage()
  try {
    const sessionId = 'session_123'
    const boardPath = 'design/test/board.json'

    assert.equal(loadPreset(sessionId, boardPath, null), null)

    savePreset(sessionId, boardPath, 'apple')

    assert.equal(localStorage.getItem(boardPresetKey(boardPath)), 'apple')
    assert.equal(localStorage.getItem(sessionPresetKey(sessionId)), 'apple')

    assert.equal(loadPreset(sessionId, boardPath, null), 'apple')
    assert.equal(loadPreset('other_session', boardPath, null), 'apple')
    assert.equal(loadPreset(sessionId, null, null), 'apple')
  } finally {
    globalThis.localStorage = original
  }
})

test('设计体系持久化：显式选择「不指定设计系统」时，不被 board.json 或会话残留覆盖', async () => {
  const { NONE, boardPresetKey, loadPreset, savePreset } = await loadBoardModule()
  const original = globalThis.localStorage
  globalThis.localStorage = new MockStorage()
  try {
    const sessionId = 'session_456'
    const boardPath = 'design/preset_board/board.json'

    assert.equal(loadPreset(sessionId, boardPath, 'apple'), 'apple')

    savePreset(sessionId, boardPath, null)
    assert.equal(localStorage.getItem(boardPresetKey(boardPath)), NONE)

    assert.equal(loadPreset(sessionId, boardPath, 'apple'), null)
  } finally {
    globalThis.localStorage = original
  }
})

test('设计体系持久化：不同画板各自独立保存，互不干扰', async () => {
  const { loadPreset, savePreset } = await loadBoardModule()
  const original = globalThis.localStorage
  globalThis.localStorage = new MockStorage()
  try {
    const sessionId = 'session_multi'
    const boardA = 'design/board_a/board.json'
    const boardB = 'design/board_b/board.json'

    savePreset(sessionId, boardA, '1win')
    savePreset(sessionId, boardB, 'apple')

    assert.equal(loadPreset(sessionId, boardA, null), '1win')
    assert.equal(loadPreset(sessionId, boardB, null), 'apple')
  } finally {
    globalThis.localStorage = original
  }
})
