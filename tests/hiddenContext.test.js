import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createContextStore, createContextHandler, composeContext } from '../src/hiddenContext.js'

test('composeContext 把绑定目录、预设块和反馈块拼起来，全空返回空串', () => {
  assert.equal(composeContext({ feedback: '', preset: '' }), '')
  assert.equal(composeContext({ feedback: '<a/>', preset: '' }), '<a/>')
  assert.equal(composeContext({ feedback: '<a/>', preset: '<b/>' }), '<b/>\n<a/>')
  assert.equal(composeContext({ board: '<d/>', feedback: '<a/>', preset: '<b/>' }), '<d/>\n<b/>\n<a/>')
})

test('store.ensure 仅在未设置上下文时写入初始绑定，且与前端同内容幂等不重复注入', () => {
  const store = createContextStore()
  store.ensure('s1', '<design-board dir="design/a" board="design/a/board.json"/>')
  assert.match(store.take('s1'), /<design-board dir="design\/a"/)
  store.set('s1', '<design-board dir="design/a" board="design/a/board.json"/>')
  assert.equal(store.take('s1'), undefined)
  store.ensure('s1', '<design-board dir="design/other" board="design/other/board.json"/>')
  assert.equal(store.take('s1'), undefined)
})

test('store：没推过内容就没有可注入的', () => {
  assert.equal(createContextStore().take('s1'), undefined)
})

test('store：新内容注入一次，同样内容不重复注入', () => {
  const store = createContextStore()
  store.set('s1', '<design-feedback/>')
  assert.match(store.take('s1'), /<design-feedback\/>/)
  assert.equal(store.take('s1'), undefined)
  store.set('s1', '<design-feedback/>')
  assert.equal(store.take('s1'), undefined)
  store.set('s1', '<design-feedback x="2"/>')
  assert.match(store.take('s1'), /x="2"/)
})

test('store：不同会话互不影响', () => {
  const store = createContextStore()
  store.set('s1', 'A')
  assert.equal(store.take('s2'), undefined)
  assert.match(store.take('s1'), /A/)
})

test('store：清空只在之前注入过内容时通知一次', () => {
  const store = createContextStore()
  store.set('s1', '')
  assert.equal(store.take('s1'), undefined)
  store.set('s1', 'A')
  store.take('s1')
  store.set('s1', '')
  assert.match(store.take('s1'), /清空/)
  assert.equal(store.take('s1'), undefined)
})

const call = async (handler, { method = 'POST', body }) => {
  const req = Readable.from([typeof body === 'string' ? body : JSON.stringify(body)])
  req.method = method
  const res = { status: 0, ended: false, writeHead(s) { this.status = s }, end() { this.ended = true } }
  await handler(req, res)
  return res
}

test('handler：POST 写入 store 并回 204', async () => {
  const store = createContextStore()
  const res = await call(createContextHandler(store), { body: { sessionId: 's1', text: 'A' } })
  assert.equal(res.status, 204)
  assert.match(store.take('s1'), /A/)
})

test('handler：非 POST、坏 JSON、缺字段、超长都拒绝且不写入', async () => {
  const store = createContextStore()
  const handler = createContextHandler(store)
  assert.equal((await call(handler, { method: 'GET', body: {} })).status, 405)
  assert.equal((await call(handler, { body: '{坏' })).status, 400)
  assert.equal((await call(handler, { body: { sessionId: 's1' } })).status, 400)
  assert.equal((await call(handler, { body: { sessionId: 's1', text: 'x'.repeat(60001) } })).status, 413)
  assert.equal(store.take('s1'), undefined)
})
