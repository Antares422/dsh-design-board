import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  boardPathOfDesignFile,
  createBindingHandler,
  createSessionDesignBindings,
  extractToolDesignPath,
  isDesignBoardSkillRead,
  resolveSessionDesignPhase,
  sessionBoardPath,
  sessionDesignSlug,
} from '../src/sessionDesign.js'
import { buildBoardBinding } from '../src/feedback.js'

test('一个会话只能绑定一个 design，多个标签读取同一个绑定', () => {
  const bindings = createSessionDesignBindings(null)
  const seen = []
  const unsub = bindings.subscribe('s1', path => seen.push(path))

  assert.equal(bindings.bind('s1', 'design/one/board.json'), true)
  assert.equal(bindings.bind('s1', 'design/one/a.html'), true)
  assert.equal(bindings.get('s1'), 'design/one/board.json')
  assert.deepEqual(seen, ['design/one/board.json'])
  assert.equal(bindings.bind('s1', 'design/two/board.json'), false)
  assert.equal(bindings.get('s1'), 'design/one/board.json')
  unsub()
  assert.equal(bindings.bind('s2', 'design/two/board.json'), true)
  assert.equal(bindings.get('s2'), 'design/two/board.json')
  assert.deepEqual(seen, ['design/one/board.json'])
})

test('会话正式绑定后持久化，关闭所有标签后也不能切换到其他 design', () => {
  const storage = new Map()
  const adapter = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }
  createSessionDesignBindings(adapter).bind('s1', 'design/one/board.json')

  const reopened = createSessionDesignBindings(adapter)
  assert.equal(reopened.get('s1'), 'design/one/board.json')
  assert.equal(reopened.bind('s1', 'design/two/board.json'), false)
  assert.equal(reopened.get('s1'), 'design/one/board.json')
})

test('boardPathOfDesignFile 识别相对与绝对设计路径并兼容 macOS /private/tmp', () => {
  assert.equal(boardPathOfDesignFile('design/alpha/board.json'), 'design/alpha/board.json')
  assert.equal(boardPathOfDesignFile('./design/alpha/hero.html'), 'design/alpha/board.json')
  assert.equal(
    boardPathOfDesignFile('/private/tmp/e2e/design/smoke/board.json', '/tmp/e2e'),
    'design/smoke/board.json',
  )
  assert.equal(boardPathOfDesignFile('design/../secret/board.json'), undefined)
  assert.equal(boardPathOfDesignFile('design/alpha/readme.md'), undefined)
  assert.equal(boardPathOfDesignFile('/other/root/design/alpha/board.json', '/tmp/e2e'), undefined)
})

test('extractToolDesignPath 仅认领写入类工具的设计目录，忽略只读操作', () => {
  const agent = { session: { id: 's1', header: { cwd: '/tmp/ws' } } }
  assert.equal(
    extractToolDesignPath({ name: 'write', arguments: { file_path: '/private/tmp/ws/design/login/a.html' }, agent }),
    'design/login/board.json',
  )
  assert.equal(
    extractToolDesignPath({ name: 'str_replace_editor', arguments: { command: 'view', path: 'design/login/a.html' }, agent }),
    undefined,
  )
  assert.equal(
    extractToolDesignPath({ name: 'read', arguments: { file_path: 'design/login/board.json' }, agent }),
    undefined,
  )
})

test('createBindingHandler 支持查询与幂等首次绑定通知', async () => {
  const bindings = createSessionDesignBindings(null)
  const boundEvents = []
  const handler = createBindingHandler(bindings, (sid, path) => boundEvents.push([sid, path]))

  const call = async ({ method = 'GET', url = '/dsh-design-board/binding', body } = {}) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = method
    req.url = url
    let out = ''
    const res = {
      status: 0,
      writeHead(s) { this.status = s },
      end(chunk = '') { out += chunk },
    }
    await handler(req, res)
    return { status: res.status, json: out ? JSON.parse(out) : null }
  }

  assert.deepEqual((await call({ url: '/dsh-design-board/binding?sessionId=s1' })).json, { boardPath: null })
  assert.deepEqual(
    (await call({ method: 'POST', body: { sessionId: 's1', boardPath: 'design/one/board.json' } })).json,
    { accepted: true, boardPath: 'design/one/board.json' },
  )
  assert.deepEqual(
    (await call({ method: 'POST', body: { sessionId: 's1', boardPath: 'design/two/board.json' } })).json,
    { accepted: false, boardPath: 'design/one/board.json' },
  )
  assert.deepEqual(boundEvents, [['s1', 'design/one/board.json']])
  assert.equal(buildBoardBinding('design/one/board.json'), '<design-board dir="design/one" board="design/one/board.json"/>')
})

test('未绑定会话打开目录页，浏览不锁死会话，关标签重开仍回到目录选择页；正式绑定后直达画布', async () => {
  assert.equal(sessionDesignSlug('ses_abc-123'), 'ses_abc-123')
  assert.equal(sessionDesignSlug('  a/b:c  '), 'a_b_c')
  assert.equal(sessionBoardPath('s1'), 'design/s1/board.json')
  assert.equal(isDesignBoardSkillRead({ name: 'skill', arguments: { name: 'design-board' } }), true)
  assert.equal(isDesignBoardSkillRead({ name: 'skill', arguments: JSON.stringify({ name: 'design-board' }) }), true)
  assert.equal(isDesignBoardSkillRead({ name: 'skill', arguments: { name: 'other-skill' } }), false)

  const { outputFiles } = await build({
    entryPoints: [new URL('../src/Board.jsx', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    loader: { '.css': 'text' },
    external: ['react', 'react-dom', 'react/jsx-runtime', '@xyflow/react', 'html-to-image', 'pdf-lib'],
  })
  const req = createRequire(import.meta.url)
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', outputFiles[0].text)(mod, mod.exports, id => {
    if (id.endsWith('.css')) return ''
    if (id === '@xyflow/react') {
      return {
        ReactFlowProvider: ({ children }) => React.createElement('div', { 'data-rf': '1' }, children),
        ReactFlow: () => null,
        Background: () => null,
        useReactFlow: () => ({ setViewport: async () => {}, fitView: async () => {} }),
        useViewport: () => ({ zoom: 1 }),
      }
    }
    return req(id)
  })
  const { Board } = mod.exports
  const bindings = createSessionDesignBindings(null)
  const makeProps = (sessionId, contentId = 'sidebar://design-board') => ({
    sessionId,
    useTabInfo: () => ({ tab: { contentId, actions: { openResource: () => {}, openTab: () => {} } } }),
    list: async () => ({ ok: true, value: { entries: [] } }),
    readBytes: async () => ({ ok: false }),
    watchDir: () => () => {},
    syncBoard: () => {},
    syncFeedback: () => {},
    syncPreset: () => {},
    getDesignPath: () => bindings.get(sessionId),
    bindDesign: path => bindings.bind(sessionId, path),
    subscribeDesign: fn => bindings.subscribe(sessionId, fn),
  })

  // 未绑定会话首次打开：渲染设计目录页，方便新建或选择已有设计
  const unboundHtml = renderToStaticMarkup(React.createElement(Board, makeProps('s1')))
  assert.match(unboundHtml, /设计目录/)
  assert.equal(bindings.get('s1'), undefined)

  // 未绑定会话浏览某个 board.json：仅进入浏览态，不会写入永久绑定
  const browseResourceHtml = renderToStaticMarkup(
    React.createElement(Board, makeProps('s1', 'dsh-resource://file/session/s1/design/alpha/board.json')),
  )
  assert.match(browseResourceHtml, /加载中/)
  assert.equal(bindings.get('s1'), undefined)

  // 关掉浏览标签重新打开目录入口：依然回到设计目录页，可自由重选
  const reopenedHtml = renderToStaticMarkup(React.createElement(Board, makeProps('s1')))
  assert.match(reopenedHtml, /设计目录/)

  // 一旦正式绑定后，再打开目录入口直接进入已绑定看板，不再显示目录选择页
  bindings.bind('s1', 'design/alpha/board.json')
  const boundHtml = renderToStaticMarkup(React.createElement(Board, makeProps('s1')))
  assert.doesNotMatch(boundHtml, /设计目录/)
  assert.match(boundHtml, /加载中/)
})

test('host 侧自动认领当前会话的 present 与写入目录，忽略 subagent，并在下一步前附带 <design-board>', async () => {
  const hostMod = await import(new URL('../index.js', import.meta.url).href)
  const routes = new Map()
  const listeners = new Map()
  const ctx = {
    get(service) {
      if (service === 'webServer') return { register: ({ path, handler }) => { routes.set(path, handler); return () => {} } }
      return undefined
    },
    effect(fn) { fn() },
    on(event, fn) { listeners.set(event, fn) },
    skills: { register: () => () => {} },
    tools: { register: () => () => {} },
  }
  hostMod.apply(ctx)

  const getBinding = async (sessionId) => {
    const req = Readable.from([])
    req.method = 'GET'
    req.url = `/dsh-design-board/binding?sessionId=${encodeURIComponent(sessionId)}`
    let out = ''
    await routes.get('/dsh-design-board/binding')(req, { writeHead() {}, end(c = '') { out += c } })
    return JSON.parse(out).boardPath
  }

  // subagent 交付不绑定
  listeners.get('session/event')(
    { id: 'sub-1', header: { origin: 'subagent', cwd: '/tmp/ws' } },
    { type: 'deliverables/presented', data: { files: [{ path: '/private/tmp/ws/design/sub/board.json' }] } },
  )
  assert.equal(await getBinding('sub-1'), null)

  // 主会话 present 设计清单：自动绑定且不可被第二个目录覆盖
  const mainSession = { id: 'main-1', header: { cwd: '/tmp/ws' } }
  listeners.get('session/event')(
    mainSession,
    { type: 'deliverables/presented', data: { files: [{ path: '/private/tmp/ws/design/home/board.json' }] } },
  )
  listeners.get('session/event')(
    mainSession,
    { type: 'deliverables/presented', data: { files: [{ path: '/private/tmp/ws/design/second/board.json' }] } },
  )
  assert.equal(await getBinding('main-1'), 'design/home/board.json')

  // agent/pre-step 自动注入一次 <design-board>，后续步骤未变不重复注入
  const preStep = listeners.get('agent/pre-step')
  const firstStep = await preStep(
    { agent: { session: mainSession }, step: 1, signal: new AbortController().signal },
    async () => ({ kind: 'continue', messages: [{ role: 'user', content: [{ type: 'text', text: '改成深色' }] }] }),
  )
  assert.equal(firstStep.messages.length, 2)
  assert.match(firstStep.messages[1].content[0].text, /<design-board dir="design\/home" board="design\/home\/board\.json"\/>/)

  const secondStep = await preStep(
    { agent: { session: mainSession }, step: 2, signal: new AbortController().signal },
    async () => ({ kind: 'continue', messages: [{ role: 'user', content: [{ type: 'text', text: '继续' }] }] }),
  )
  assert.equal(secondStep.messages.length, 1)

  // 写入工具（即使未调 present）同样自动绑定该会话
  const writeSession = { id: 'main-2', header: { cwd: '/tmp/ws' } }
  listeners.get('tools/result')(
    { name: 'write', arguments: { file_path: 'design/checkout/a.html' }, agent: { session: writeSession } },
    { isError: false },
  )
  assert.equal(await getBinding('main-2'), 'design/checkout/board.json')

  // 读取 design-board 技能即自动为当前会话分配并下发专属目录 design/<sessionId>/board.json（同时保留已选预设）
  const skillSession = { id: 'ses-iso-9', header: { cwd: '/tmp/ws' } }
  const postContext = async (sessionId, text) => {
    const r = Readable.from([JSON.stringify({ sessionId, text })])
    r.method = 'POST'
    r.url = '/dsh-design-board/context'
    await routes.get('/dsh-design-board/context')(r, { writeHead() {}, end() {} })
  }
  await postContext('ses-iso-9', '<design-preset id="airbnb" name="Airbnb"/>')
  listeners.get('tools/result')(
    { name: 'skill', arguments: { name: 'design-board' }, agent: { session: skillSession } },
    { isError: false },
  )
  assert.equal(await getBinding('ses-iso-9'), 'design/ses-iso-9/board.json')
  const isoStep = await preStep(
    { agent: { session: skillSession }, step: 1, signal: new AbortController().signal },
    async () => ({ kind: 'continue', messages: [{ role: 'user', content: [{ type: 'text', text: '设计首页' }] }] }),
  )
  assert.equal(isoStep.messages.length, 2)
  assert.match(isoStep.messages[1].content[0].text, /<design-board dir="design\/ses-iso-9" board="design\/ses-iso-9\/board\.json"\/>/)
  assert.match(isoStep.messages[1].content[0].text, /<design-preset id="airbnb" name="Airbnb"\/>/)

  // 若用户在目录里主动选定了已有设计，读取 design-board 技能时尊重用户所选目录而不另建新目录
  const chosenSession = { id: 'ses-chosen-1', header: { cwd: '/tmp/ws' } }
  await postContext('ses-chosen-1', '<design-board dir="design/existing" board="design/existing/board.json"/>')
  listeners.get('tools/result')(
    { name: 'skill', arguments: { name: 'design-board' }, agent: { session: chosenSession } },
    { isError: false },
  )
  assert.equal(await getBinding('ses-chosen-1'), 'design/existing/board.json')
})

test('clear 移除内存与持久化绑定并通知订阅者，resolveSessionDesignPhase 区分 active/blank/settling', () => {
  const storage = new Map()
  const adapter = {
    getItem: key => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  const bindings = createSessionDesignBindings(adapter)
  const seen = []
  bindings.subscribe('s1', path => seen.push(path))
  assert.equal(bindings.bind('s1', 'design/one/board.json'), true)
  assert.equal(storage.size, 1)

  assert.equal(bindings.clear('s1'), true)
  assert.equal(bindings.get('s1'), undefined)
  assert.equal(storage.size, 0)
  assert.equal(bindings.clear('s1'), false)
  assert.equal(bindings.bind('s1', 'design/two/board.json'), true)
  assert.deepEqual(seen, ['design/one/board.json', undefined, 'design/two/board.json'])

  assert.equal(resolveSessionDesignPhase({ summaryBlank: true }), 'blank')
  assert.equal(resolveSessionDesignPhase({ session: { blank: true, openState: 'open' } }), 'blank')
  assert.equal(resolveSessionDesignPhase({ session: { blank: true, openState: 'loading' } }), 'settling')
  assert.equal(resolveSessionDesignPhase({ session: { blank: false, openState: 'loading' } }), 'active')
  assert.equal(resolveSessionDesignPhase({ summaryBlank: false }), 'active')
  assert.equal(resolveSessionDesignPhase({ fallbackBlank: true }), 'blank')
  assert.equal(resolveSessionDesignPhase({ fallbackBlank: false }), 'active')
})

test('新会话（blank）绝不锁定设计目录，且残留锁定会被自动清理；有对话后恢复正常锁定', async () => {
  const bindings = createSessionDesignBindings(null)
  bindings.bind('s-blank', 'design/stale/board.json')
  let blank = true
  const boundEvents = []
  const handler = createBindingHandler(bindings, (sid, p) => boundEvents.push([sid, p]), async () => blank)

  const call = async ({ method = 'GET', url = '/dsh-design-board/binding', body } = {}) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = method
    req.url = url
    let out = ''
    await handler(req, { writeHead() {}, end(c = '') { out += c } })
    return out ? JSON.parse(out) : null
  }

  // 新会话：POST 拒绝锁定并清理残留，GET 返回 null
  assert.deepEqual(
    await call({ method: 'POST', body: { sessionId: 's-blank', boardPath: 'design/accidental/board.json' } }),
    { accepted: false, boardPath: null },
  )
  assert.equal(bindings.get('s-blank'), undefined)
  assert.deepEqual(await call({ url: '/dsh-design-board/binding?sessionId=s-blank' }), { boardPath: null })
  assert.deepEqual(boundEvents, [])

  // 一旦产生对话（blank = false），允许正常绑定
  blank = false
  assert.deepEqual(
    await call({ method: 'POST', body: { sessionId: 's-blank', boardPath: 'design/real/board.json' } }),
    { accepted: true, boardPath: 'design/real/board.json' },
  )
  assert.deepEqual(boundEvents, [['s-blank', 'design/real/board.json']])

  // Board 组件在 blank 会话下即使存在残留绑定也直接回到设计目录页，不锁死
  const { outputFiles } = await build({
    entryPoints: [new URL('../src/Board.jsx', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    loader: { '.css': 'text' },
    external: ['react', 'react-dom', 'react/jsx-runtime', '@xyflow/react', 'html-to-image', 'pdf-lib'],
  })
  const req = createRequire(import.meta.url)
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', outputFiles[0].text)(mod, mod.exports, id => {
    if (id.endsWith('.css')) return ''
    if (id === '@xyflow/react') {
      return {
        ReactFlowProvider: ({ children }) => React.createElement('div', { 'data-rf': '1' }, children),
        ReactFlow: () => null,
        Background: () => null,
        useReactFlow: () => ({ setViewport: async () => {}, fitView: async () => {} }),
        useViewport: () => ({ zoom: 1 }),
      }
    }
    return req(id)
  })
  const { Board } = mod.exports
  const uiBindings = createSessionDesignBindings(null)
  uiBindings.bind('s-stuck', 'design/stale/board.json')
  const html = renderToStaticMarkup(React.createElement(Board, {
    sessionId: 's-stuck',
    useSession: selector => selector({ blank: true, openState: 'open' }),
    useSessions: selector => selector({ phase: 'ready', byId: { 's-stuck': { blank: true } } }),
    useTabInfo: () => ({ tab: { contentId: 'sidebar://design-board', actions: { openResource: () => {}, openTab: () => {} } } }),
    list: async () => ({ ok: true, value: { entries: [] } }),
    readBytes: async () => ({ ok: false }),
    watchDir: () => () => {},
    syncBoard: () => {},
    syncFeedback: () => {},
    syncPreset: () => {},
    getDesignPath: () => uiBindings.get('s-stuck'),
    bindDesign: path => uiBindings.bind('s-stuck', path),
    clearDesign: () => uiBindings.clear('s-stuck'),
    subscribeDesign: fn => uiBindings.subscribe('s-stuck', fn),
  }))
  assert.match(html, /设计目录/)

  // Host 侧接入 sessions 服务：零对话会话拒绝 POST /dsh-design-board/binding，有 turn/start 会话放行
  const hostMod = await import(new URL('../index.js', import.meta.url).href)
  const routes = new Map()
  const liveSessions = new Map([
    ['s-zero', { id: 's-zero', seq: 0, snapshotEvents: () => [] }],
    ['s-active', { id: 's-active', seq: 2, snapshotEvents: () => [{ type: 'turn/start' }] }],
  ])
  const storedHeaders = new Map([
    ['s-cold-active', { header: { id: 's-cold-active' } }],
  ])
  hostMod.apply({
    get(service) {
      if (service === 'webServer') return { register: ({ path, handler: h }) => { routes.set(path, h); return () => {} } }
      if (service === 'sessions') return { get: id => liveSessions.get(id) }
      if (service === 'sessionPersistence') return { stat: async id => storedHeaders.get(id) }
      if (service === 'sessionProjectionCache') return { cachedSnapshot: () => ({ values: { sessionListMetadata: { blank: false } } }) }
      return undefined
    },
    effect(fn) { fn() },
    on() {},
    skills: { register: () => () => {} },
    tools: { register: () => () => {} },
  })
  const postHostBinding = async (sessionId, boardPath) => {
    const r = Readable.from([JSON.stringify({ sessionId, boardPath })])
    r.method = 'POST'
    r.url = '/dsh-design-board/binding'
    let out = ''
    await routes.get('/dsh-design-board/binding')(r, { writeHead() {}, end(c = '') { out += c } })
    return JSON.parse(out)
  }
  assert.deepEqual(await postHostBinding('s-zero', 'design/accidental/board.json'), { accepted: false, boardPath: null })
  assert.deepEqual(await postHostBinding('s-provisional', 'design/accidental/board.json'), { accepted: false, boardPath: null })
  assert.deepEqual(await postHostBinding('s-cold-active', 'design/cold/board.json'), { accepted: true, boardPath: 'design/cold/board.json' })
  assert.deepEqual(await postHostBinding('s-active', 'design/real/board.json'), { accepted: true, boardPath: 'design/real/board.json' })
})
