import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildFeedback } from '../src/feedback.js'

const frameB = { id: 'b', title: '方案 B', file: 'b.html' }

test('没有任何选中和标注时返回空串', () => {
  assert.equal(buildFeedback({ board: '弹窗', frames: [frameB], selections: [], annotations: [] }), '')
})

test('选中的元素带选择器、标签和文本，归在所属画板下', () => {
  const out = buildFeedback({
    board: '弹窗', frames: [frameB],
    selections: [{ frameId: 'b', selector: 'div.modal > h2', tag: 'h2', text: '发现新版本' }],
    annotations: [],
  })
  assert.match(out, /<design-feedback board="弹窗">/)
  assert.match(out, /<frame id="b" title="方案 B" file="b.html">/)
  assert.match(out, /<selected selector="div\.modal > h2" tag="h2" text="发现新版本"\/>/)
})

test('矩形标注把圈中的元素列出来，并带备注', () => {
  const out = buildFeedback({
    board: '弹窗', frames: [frameB], selections: [],
    annotations: [{
      type: 'rect', frameId: 'b', note: '间距太小',
      covers: [{ selector: 'button.primary', text: '立即更新' }, { selector: 'a.later', text: '稍后' }],
    }],
  })
  assert.match(out, /<annotation type="rect" covers="button\.primary（立即更新）; a\.later（稍后）">/)
  assert.match(out, /间距太小/)
})

test('文字标注只有备注', () => {
  const out = buildFeedback({
    board: '弹窗', frames: [frameB], selections: [],
    annotations: [{ type: 'text', frameId: 'b', note: '去掉关闭图标', covers: [] }],
  })
  assert.match(out, /<annotation type="text">去掉关闭图标<\/annotation>/)
})

test('属性里转义 & < "，正文里转义 & <，不转义 >', () => {
  const out = buildFeedback({
    board: 'a"b', frames: [frameB],
    selections: [{ frameId: 'b', selector: 'x', tag: 'p', text: '1 < 2 "q"' }],
    annotations: [{ type: 'text', frameId: 'b', note: 'a <b> c', covers: [] }],
  })
  assert.match(out, /board="a&quot;b"/)
  assert.match(out, /text="1 &lt; 2 &quot;q&quot;"/)
  assert.match(out, />a &lt;b> c</)
})

test('过长的文本被截断', () => {
  const out = buildFeedback({
    board: 'x', frames: [frameB],
    selections: [{ frameId: 'b', selector: 's', tag: 'p', text: '字'.repeat(100) }],
    annotations: [],
  })
  assert.match(out, /text="字{40}…"/)
})

test('过期的标注带 stale 标记', () => {
  const out = buildFeedback({
    board: 'x', frames: [frameB], selections: [],
    annotations: [{ type: 'rect', frameId: 'b', note: 'n', stale: true, covers: [] }],
  })
  assert.match(out, /<annotation type="rect" stale="true">/)
})

test('不在任何画板上的标注归到画布层', () => {
  const out = buildFeedback({
    board: 'x', frames: [frameB], selections: [],
    annotations: [{ type: 'text', note: '整体偏暗', covers: [] }],
  })
  assert.match(out, /<canvas>[\s\S]*整体偏暗[\s\S]*<\/canvas>/)
})

test('补充说明写在最前面', () => {
  const out = buildFeedback({
    board: 'x', frames: [frameB], note: '按这个改',
    selections: [{ frameId: 'b', selector: 's', tag: 'p', text: 't' }], annotations: [],
  })
  assert.match(out, /<design-feedback board="x">\s*<note>按这个改<\/note>/)
})

test('定位失败的选中项标明 locate=failed', () => {
  const out = buildFeedback({
    board: 'x', frames: [frameB],
    selections: [{ frameId: 'b', failed: true }], annotations: [],
  })
  assert.match(out, /<selected locate="failed"\/>/)
})

test('矩形标注没有备注时写成自闭合，仍带圈中的元素', () => {
  const out = buildFeedback({
    board: 'x', frames: [frameB], selections: [],
    annotations: [{ type: 'rect', frameId: 'b', note: '', covers: [{ selector: 'h1', text: '标题' }] }],
  })
  assert.match(out, /<annotation type="rect" covers="h1（标题）"\/>/)
})

import { buildPreset } from '../src/feedback.js'

test('设计体系标记带 id 和名称，名称里的引号被转义；不选时为空串', () => {
  assert.equal(buildPreset({ id: 'airbnb', name: 'Airbnb' }), '<design-preset id="airbnb" name="Airbnb"/>')
  assert.equal(buildPreset({ id: 'x', name: 'A"B' }), '<design-preset id="x" name="A&quot;B"/>')
  assert.equal(buildPreset(null), '')
})

test('buildFeedback：未通过校验的方案写进 <design-check>，并要求原地修改', () => {
  const text = buildFeedback({
    board: 'B', frames: [{ id: 'a', title: 'A', file: 'a.html' }],
    rejected: [{ id: 'a', title: 'A', file: 'a.html', issues: [{ code: 'no-interaction', message: '没有交互 <x>' }] }],
  })
  assert.match(text, /^<design-check board="B">/)
  assert.match(text, /原地修改/)
  assert.match(text, /<rejected id="a" file="a\.html" title="A">/)
  assert.match(text, /<issue code="no-interaction">没有交互 &lt;x><\/issue>/)
  assert.doesNotMatch(text, /<design-feedback/)
})

test('buildFeedback：反馈和校验结果同时有时两块都输出', () => {
  const text = buildFeedback({
    board: 'B', frames: [{ id: 'a', title: 'A', file: 'a.html' }, { id: 'b', title: 'B', file: 'b.html' }],
    annotations: [{ frameId: 'a', type: 'rect', note: '改' }],
    rejected: [{ id: 'b', title: 'B', file: 'b.html', issues: [{ code: 'no-theme', message: 'm' }] }],
  })
  assert.match(text, /<design-feedback[\s\S]*<\/design-feedback>\n<design-check/)
})

test('设计画布不把校验诊断渲染成用户可见横幅', () => {
  const source = readFileSync(new URL('../src/Board.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /个方案未通过检查/u)
  assert.match(buildFeedback({
    board: 'B', frames: [{ id: 'a', title: 'A', file: 'a.html' }],
    rejected: [{ id: 'a', title: 'A', file: 'a.html', issues: [{ code: 'fixed-overflow', message: 'overflow' }] }],
  }), /<design-check/)
})
