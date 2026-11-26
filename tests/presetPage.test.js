import test from 'node:test'
import assert from 'node:assert/strict'
import { renderPage, splitPage } from '../src/presetPage.js'

const meta = { name: 'Acme', category: 'Tools', description: 'Fast and calm.' }
const html = `<html><style>
  :root {
    --bg: #fff;
    --accent: #f00;
  }
  html {
    --od-page-bg: #fff;
    --od-font-body: "Acme Sans", sans-serif;
    color: var(--od-page-bg);
  }
</style><h1>Acme</h1><p>TOOLS · Fast and calm.</p><small>Tools</small></html>`

test('拆开再渲染得到与原文逐字节相同的页面', () => {
  const { template, parts } = splitPage(html, meta)
  assert.equal(renderPage(template, parts, meta), html)
})

test('模板里不含各套特有的内容，换一套的名字和色值就渲染出另一套', () => {
  const { template, parts } = splitPage(html, meta)
  assert.ok(!template.includes('Acme') && !template.includes('#f00') && !template.includes('Fast and calm.'))
  const other = { name: 'Beta', category: 'Games', description: 'Loud.' }
  const out = renderPage(template, { ...parts, root: ':root {\n    --bg: #000;\n  }' }, other)
  assert.match(out, /<h1>Beta<\/h1>/)
  assert.match(out, /GAMES · Loud\./)
  assert.match(out, /--bg: #000;/)
})

test('页面没有 :root 块或 --od 变量时也能还原', () => {
  const plain = '<p>Acme plain</p>'
  const { template, parts } = splitPage(plain, meta)
  assert.equal(renderPage(template, parts, meta), plain)
})
