import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTokens } from '../src/tokens.js'

const CSS = `
/* --bg: #000; 注释里的不算 */
:root {
  --bg: #fff;
  --surface: #f5f5f7;
  --fg: #111;
  --font-display: "SF Pro Display", system-ui, sans-serif;
  --font-body: Inter, sans-serif;
  --text-xs: 12px;
  --text-base: 17px;
  --text-4xl: 80px;
  --radius-sm: 8px;
  --radius-pill: 999px;
  --space-1: 4px;
  --space-12: 48px;
  --elev-raised: 0 12px 32px rgba(0, 0, 0, .08);
  --leading-body: 1.5;
}
`

test('从 tokens.css 解析出和官方预设预览同构的字段', () => {
  const t = parseTokens(CSS)
  assert.deepEqual(t.colors, { bg: '#fff', surface: '#f5f5f7', fg: '#111' })
  assert.deepEqual(t.fonts, { display: '"SF Pro Display", system-ui, sans-serif', body: 'Inter, sans-serif' })
  assert.deepEqual(t.text, { xs: '12px', base: '17px', '4xl': '80px' })
  assert.deepEqual(t.radius, { sm: '8px', pill: '999px' })
  assert.deepEqual(t.space, { '1': '4px', '12': '48px' })
  assert.equal(t.elevRaised, '0 12px 32px rgba(0, 0, 0, .08)')
})

test('空文件或没有变量时返回空对象，不抛错', () => {
  const t = parseTokens('')
  assert.deepEqual([t.colors, t.fonts, t.text, t.radius, t.space], [{}, {}, {}, {}, {}])
  assert.equal(parseTokens(undefined).elevRaised, undefined)
})
