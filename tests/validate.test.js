import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFrame, splitFrames } from '../src/validate.js'

const GOOD = `<!doctype html><html><head><style>:root{--bg:#fff}:root[data-theme="dark"]{--bg:#000}</style></head>
<body><button id="b">x</button><script>document.getElementById('b').addEventListener('click',()=>{})</script></body></html>`

const codes = html => validateFrame(html).map(i => i.code)

test('合格的页面没有问题', () => {
  assert.deepEqual(validateFrame(GOOD), [])
})

test('没有任何交互：既没 addEventListener 也没 on* 属性', () => {
  const html = GOOD.replace(/<script>.*<\/script>/s, '')
  assert.deepEqual(codes(html), ['no-interaction'])
})

test('on* 内联属性也算交互', () => {
  const html = GOOD.replace(/<script>.*<\/script>/s, '').replace('<button', '<button onclick="go()"')
  assert.deepEqual(codes(html), [])
})

test('没做深浅两套主题', () => {
  const html = GOOD.replace(':root[data-theme="dark"]{--bg:#000}', '')
  assert.deepEqual(codes(html), ['no-theme'])
})

test('.dark 类和 light-dark() 都算做了主题', () => {
  assert.deepEqual(codes(GOOD.replace(':root[data-theme="dark"]', '.dark')), [])
  assert.deepEqual(codes(GOOD.replace(':root[data-theme="dark"]{--bg:#000}', 'body{color:light-dark(#000,#fff)}')), [])
})

test('引用相对路径的资源：看板里加载不到', () => {
  const html = GOOD.replace('<body>', '<body><img src="logo.png"><link rel="stylesheet" href="./a.css"><script src="app.js"></script>')
  const issue = validateFrame(html).find(i => i.code === 'relative-resource')
  assert.ok(issue)
  assert.match(issue.message, /logo\.png/)
  assert.match(issue.message, /a\.css/)
  assert.match(issue.message, /app\.js/)
})

test('http(s)、data:、//、# 开头的地址都放行', () => {
  const html = GOOD.replace('<body>', '<body><img src="https://x.com/a.png"><img src="data:image/png;base64,AA"><script src="//cdn.x/a.js"></script><img src="#">')
  assert.deepEqual(codes(html), [])
})

test('<a href> 不检查（链接本来就不该真跳转）', () => {
  assert.deepEqual(codes(GOOD.replace('<body>', '<body><a href="page2.html">x</a>')), [])
})

test('多个问题同时报出', () => {
  assert.deepEqual(codes('<p>空</p>'), ['no-interaction', 'no-theme'])
})

test('低对比度和固定宽度布局会提示质量问题', () => {
  const html = GOOD.replace(':root{--bg:#fff}', ':root{--bg:#fff;--fg:#eee;width:1280px}')
  assert.deepEqual(codes(html), ['low-contrast', 'fixed-overflow'])
})

test('max-width 与 @media min-width 不会误报 fixed-overflow', () => {
  const html = GOOD.replace(':root{--bg:#fff}', ':root{--bg:#fff} .wrap{max-width:1280px} @media (min-width: 1024px){.wrap{padding:24px}}')
  assert.deepEqual(codes(html), [])
})

test('splitFrames：有静态或运行时问题的拦下，其余显示；旧版页面的运行时问题不算', () => {
  const frames = [
    { id: 'a', url: 'u1', issues: [] },
    { id: 'b', url: 'u2', title: 'B', file: 'b.html', issues: [{ code: 'no-theme', message: 'm' }] },
    { id: 'c', url: 'u3', title: 'C', file: 'c.html', issues: [] },
  ]
  const runtime = { c: { url: 'u3', issues: [{ code: 'runtime-error', message: 'e' }] }, a: { url: 'OLD', issues: [{ code: 'runtime-error', message: 'e' }] } }
  const { shown, rejected } = splitFrames(frames, runtime)
  assert.deepEqual(shown.map(f => f.id), ['a'])
  assert.deepEqual(rejected.map(f => [f.id, f.file, f.issues.map(i => i.code)]), [['b', 'b.html', ['no-theme']], ['c', 'c.html', ['runtime-error']]])
})

test('splitFrames rejected 保留所属页，供看板在当前页展示检查结果', () => {
  const { rejected } = splitFrames([{ id: 'm', title: 'Mobile', file: 'm.html', page: 'mobile', issues: [{ code: 'fixed-overflow', message: 'overflow' }] }], {})
  assert.equal(rejected[0].page, 'mobile')
})
