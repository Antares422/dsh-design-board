import test from 'node:test'
import assert from 'node:assert/strict'
import { withFrameScripts, FRAME_SCRIPT, PRE_SCRIPT } from '../src/frameScript.js'

test('报错探针插在 <head> 之后，看板脚本接在末尾', () => {
  const out = withFrameScripts('<!doctype html><html><head><title>x</title></head><body>b</body></html>')
  assert.ok(out.startsWith('<!doctype html><html><head>' + PRE_SCRIPT + '<title>'))
  assert.ok(out.endsWith(FRAME_SCRIPT))
})

test('没有 <head> 就插在 <html> 之后；都没有则放文档类型之后', () => {
  assert.ok(withFrameScripts('<html lang="zh"><body>b</body></html>').startsWith('<html lang="zh">' + PRE_SCRIPT))
  assert.ok(withFrameScripts('<!doctype html><p>b</p>').startsWith('<!doctype html>' + PRE_SCRIPT))
  assert.ok(withFrameScripts('<p>b</p>').startsWith(PRE_SCRIPT + '<p>'))
})

test('<header> 不会被当成 <head>', () => {
  const out = withFrameScripts('<html><body><header>h</header></body></html>')
  assert.ok(out.startsWith('<html>' + PRE_SCRIPT))
})

test('看板脚本支持 snapshot：把渲染后的 DOM 交回宿主导出', () => {
  assert.match(FRAME_SCRIPT, /dsb === 'snapshot'/)
  assert.match(FRAME_SCRIPT, /outerHTML/)
})

test('snapshot 会带上表单当前值和 canvas 像素，避免导出空白', () => {
  assert.match(FRAME_SCRIPT, /toDataURL/)
  assert.match(FRAME_SCRIPT, /setAttribute\('value'/)
  assert.match(FRAME_SCRIPT, /textarea/)
})

test('看板脚本在加载后检测渲染视口横向溢出并上报 layout 事件', () => {
  assert.match(FRAME_SCRIPT, /dsb:\s*'layout'/)
  assert.match(FRAME_SCRIPT, /scrollWidth/)
  assert.match(FRAME_SCRIPT, /clientWidth/)
})

test('看板脚本在画布帧内转发 wheel 与 pan 事件以支持在 HTML 方案上平移缩放画布', () => {
  assert.match(FRAME_SCRIPT, /dsb:\s*'wheel'/)
  assert.match(FRAME_SCRIPT, /dsb:\s*'pan'/)
  assert.match(FRAME_SCRIPT, /dsb-immersive/)
})
