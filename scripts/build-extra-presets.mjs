// 从 getdesign（awesome-design-md 的 npm 包，MIT）补进 OpenDesign 没收的 13 套：
// DESIGN.md 原文照搬，tokens.css 按各自 front matter 的取值映射到 OD 的共用 token 契约，
// components.html 用 OD 的 default 参考页套上各自的 :root。
// 用法：node scripts/build-extra-presets.mjs <getdesign templates 目录> [OD 预设源目录]
// 产物写进 presets-extra/，再由 build-presets.mjs 并入预设库。
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const TEMPLATES = process.argv[2]
const OD = process.argv[3] || join(homedir(), '.agents/opendesign-presets')
const OUT = new URL('../presets-extra/', import.meta.url).pathname
if (!TEMPLATES) throw new Error('用法：node scripts/build-extra-presets.mjs <getdesign templates 目录>')

const SANS = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
const MIX = (a, b, pct) => `color-mix(in oklab, ${a}, ${b} ${pct}%)`

// 取值都来自各自 DESIGN.md 的 colors/typography/rounded；缺的角色（fg-2、border-soft 等）按公式推出，
// text-2xl 以上和 container-max 里 DESIGN.md 没写的是按版式补的。
const BRANDS = [
  {
    id: '1win', name: '1win', category: 'Fintech & Crypto',
    description: 'Near-black crypto casino and sportsbook: heavy Inter, vivid green CTA, dense game tiles.',
    c: { bg: '#141415', surface: '#2e3035', fg: '#f0f2f5', muted: '#9aa1b1', border: '#2d2f33', accent: '#00b24b', on: '#ffffff' },
    font: { display: `Inter, ${SANS}`, body: `Inter, ${SANS}` },
    text: [12, 13, 14, 16, 20, 26, 33, 44], leading: [1.4, 1.1], tracking: '0', radius: [6, 8, 16], container: 1280,
    elev: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  {
    id: 'aljazeera', name: 'Al Jazeera', category: 'Media & Consumer',
    description: 'Hard-news editorial system: flat white paper, dense Roboto headlines, one saturated orange.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#f0f0f0', fg: '#000000', fg2: '#333333', muted: '#595959', border: '#d8d8d8', accent: '#fa9000', on: '#ffffff', danger: '#c31833', warn: '#ffa000' },
    font: { display: `Roboto, ${SANS}`, body: `Roboto, ${SANS}` },
    text: [12, 14, 16, 18, 24, 32, 36, 40], leading: [1.5, 1.2], tracking: '0', radius: [4, 10, 18], container: 1200,
    elev: '0 2px 8px rgba(0, 0, 0, 0.12)',
  },
  {
    id: 'dell-1996', name: 'Dell (1996)', category: 'Retro & Nostalgic',
    description: 'Catalog-era web: black page frame, flat colour-block ribbon cards, Arial Black over Times.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#b3bd95', fg: '#000000', border: '#000000', accent: '#e91d2a', on: '#ffffff', danger: '#e91d2a', warn: '#fcc20f' },
    font: { display: `"Arial Black", Helvetica, Arial, sans-serif`, body: `"Times New Roman", Times, serif` },
    text: [11, 12, 14, 16, 18, 24, 30, 36], leading: [1.4, 1.0], tracking: '0', radius: [0, 0, 0], container: 960,
    elev: 'none',
  },
  {
    id: 'dji', name: 'DJI', category: 'Media & Consumer',
    description: 'Product-photography showroom: square gutter-separated tiles, white canvas, one engineering blue, pill actions.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#f7f9fa', fg: '#262626', fg2: '#595959', muted: '#8c8c8c', border: '#d9d9d9', soft: '#f0f0f0', accent: '#0070d5', on: '#ffffff', danger: '#f5222d', warn: '#fa8c16' },
    font: { display: `"Open Sans", ${SANS}`, body: `"Open Sans", ${SANS}` },
    text: [12, 14, 16, 18, 20, 24, 32, 48], leading: [1.5, 1.08], tracking: '-0.03em', radius: [4, 8, 16], container: 1200,
    elev: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  {
    id: 'hp', name: 'HP', category: 'Professional & Corporate',
    description: 'White-paper enterprise-consumer system: HP Electric Blue as the lone CTA, near-black ink, geometric sans.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#f7f7f7', fg: '#1a1a1a', fg2: '#3d3d3d', muted: '#636363', border: '#e8e8e8', accent: '#024ad8', on: '#ffffff', active: '#0e3191', danger: '#b3262b' },
    font: { display: `"Forma DJR Micro", "Helvetica Neue", Arial, ${SANS}`, body: `"Forma DJR Micro", "Helvetica Neue", Arial, ${SANS}` },
    text: [12, 14, 16, 18, 24, 32, 44, 56], leading: [1.38, 1.0], tracking: '0', radius: [3, 4, 8], container: 1366,
    elev: '0 1px 3px rgba(0, 0, 0, 0.12)',
  },
  {
    id: 'jobright', name: 'Jobright', category: 'Productivity & SaaS',
    description: 'AI job-hunting platform: spring-mint green on black and white, pale mint bands, bold condensed Titillium Web.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#ecffe0', fg: '#000000', fg2: '#3a3f47', muted: '#86909c', border: '#e5e7eb', accent: '#00f0a0', on: '#000000' },
    font: { display: `"Titillium Web", ${SANS}`, body: `Inter, ${SANS}` },
    text: [13, 14, 16, 18, 24, 32, 48, 80], leading: [1.6, 1.05], tracking: '-0.01em', radius: [12, 16, 24], container: 1200,
    elev: '0 4px 16px rgba(0, 0, 0, 0.08)',
  },
  {
    id: 'mercury', name: 'Mercury', category: 'Fintech & Crypto',
    description: 'Fintech banking: an ink-violet night homepage and near-white product pages held together by one indigo.',
    c: { bg: '#fbfcfd', surface: '#ffffff', warm: '#edecfb', fg: '#28253b', fg2: '#554e7b', muted: '#70707d', accent: '#5266eb', on: '#ffffff' },
    font: { display: `arcadiaDisplay, ${SANS}`, body: `arcadia, ${SANS}` },
    text: [12, 14, 16, 18, 24, 28, 42, 60], leading: [1.4, 1.1], tracking: '0', radius: [8, 12, 16], container: 1200,
    elev: '0 8px 24px rgba(40, 37, 59, 0.1)',
  },
  {
    id: 'mydealz', name: 'mydealz', category: 'E-Commerce & Retail',
    description: 'High-density German deals community: brand green, stacked white-card feed, hot/cold temperature badges.',
    c: { bg: '#f3f5f7', surface: '#ffffff', fg: '#000000', fg2: '#6b6d70', muted: '#a7a9ac', border: '#dfe1e4', accent: '#30a83c', on: '#ffffff', success: '#197e25', danger: '#ce1736', warn: '#fb6001' },
    font: { display: `"Averta CY", "Helvetica Neue", Arial, ${SANS}`, body: `"Averta CY", "Helvetica Neue", Arial, ${SANS}` },
    text: [12, 14, 16, 18, 20, 24, 36, 48], leading: [1.5, 1.1], tracking: '0', radius: [4, 8, 12], container: 1120,
    elev: '0 1px 4px rgba(0, 0, 0, 0.08)',
  },
  {
    id: 'nerdwallet', name: 'NerdWallet', category: 'Fintech & Crypto',
    description: 'Personal-finance comparison: one deep green over a ladder of mints, green hero band, near-white content.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#effcf8', fg: '#000000', fg2: '#3d4045', muted: '#64666a', border: '#ebebec', accent: '#008254', on: '#ffffff', active: '#006642', danger: '#de2828' },
    font: { display: `"Gotham Display", Gotham, "Helvetica Neue", Arial, ${SANS}`, body: `Gotham, "Helvetica Neue", Arial, ${SANS}` },
    text: [12, 14, 16, 18, 20, 28, 36, 52], leading: [1.5, 1.15], tracking: '0', radius: [4, 8, 12], container: 1200,
    elev: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  {
    id: 'nintendo-2001', name: 'Nintendo (2001)', category: 'Retro & Nostalgic',
    description: 'Brushed-periwinkle console chrome: beveled metal panels, amber-glow navigation, outlined display type.',
    c: { bg: '#7a8aba', surface: '#ffffff', warm: '#dedede', fg: '#21242e', fg2: MIX('var(--fg)', 'var(--bg)', 15), muted: '#3d4f97', border: '#5a5f8c', accent: '#ecab37', on: '#21242e', active: '#e48600', danger: '#e60012', warn: '#f68d1f' },
    font: { display: `"Arial Black", Arial, sans-serif`, body: `Arial, Helvetica, sans-serif` },
    text: [10, 11, 12, 13, 15, 18, 28, 44], leading: [1.4, 1.0], tracking: '0', radius: [4, 6, 10], container: 960,
    elev: 'inset 1px 1px 0 rgba(255, 255, 255, 0.7), 2px 2px 0 rgba(33, 36, 46, 0.4)',
  },
  {
    id: 'oracle', name: 'Oracle', category: 'Professional & Corporate',
    description: 'Enterprise system on a warm neutral ladder: charcoal actions, Georgia serif product pages, red held to the wordmark.',
    c: { bg: '#ffffff', surface: '#fbf9f8', warm: '#f5f4f2', fg: '#161513', fg2: '#312d2a', border: '#e4e1dd', soft: '#e9e7e4', accent: '#312d2a', on: '#ffffff', active: '#47423e', danger: '#d63b25' },
    font: { display: `Georgia, "Times New Roman", serif`, body: `"Oracle Sans", ${SANS}` },
    text: [12, 14, 16, 18, 20, 24, 36, 56], leading: [1.4, 1.2], tracking: '0', radius: [4, 8, 12], container: 1744, gutter: 72,
    elev: '0 2px 8px rgba(22, 21, 19, 0.1)', focus: '0 0 0 3px rgba(34, 126, 158, 0.35)',
  },
  {
    id: 'oura', name: 'Oura', category: 'Media & Consumer',
    description: 'Warm-paper wellness: Editorial serif with a quiet grotesque, cream-and-earth palette, black ink bands.',
    c: { bg: '#f7f1e8', surface: '#ffffff', fg: '#1c1b1a', fg2: '#4a4741', muted: '#838280', border: '#e1dcd3', accent: '#2a72de', on: '#ffffff', danger: '#e33a22' },
    font: { display: `"Editorial New", Georgia, "Times New Roman", serif`, body: `AkkuratLL, "Helvetica Neue", Arial, ${SANS}` },
    text: [12, 14, 16, 18, 24, 40, 68, 110], leading: [1.5, 1.05], tracking: '0', radius: [8, 12, 24], container: 1280,
    elev: '0 8px 24px rgba(28, 27, 26, 0.08)',
  },
  {
    id: 'sap', name: 'SAP', category: 'Professional & Corporate',
    description: 'Enterprise system on white: two greys and one blue, quiet 60px chrome over a product tab rail.',
    c: { bg: '#ffffff', surface: '#ffffff', warm: '#f5f6f7', fg: '#000000', fg2: '#223548', muted: '#475e75', border: '#eaecee', accent: '#0057d2', on: '#ffffff', active: '#0040b0' },
    font: { display: `"72 Brand Variable", "72", ${SANS}`, body: `"72 Brand Variable", "72", ${SANS}` },
    text: [14, 15, 16, 18, 20, 28, 36, 57], leading: [1.5, 1.1], tracking: '0', radius: [4, 8, 12], container: 1280,
    elev: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
]

const TEXT_STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']

function tokensCss(b) {
  const c = b.c
  const lines = [
    ['bg', c.bg], ['surface', c.surface], ['surface-warm', c.warm ?? 'var(--surface)'],
    ['fg', c.fg], ['fg-2', c.fg2 ?? MIX('var(--fg)', 'var(--bg)', 30)], ['muted', c.muted ?? MIX('var(--fg)', 'var(--bg)', 45)], ['meta', 'var(--muted)'],
    ['border', c.border ?? MIX('var(--fg)', 'var(--bg)', 85)], ['border-soft', c.soft ?? MIX('var(--border)', 'var(--bg)', 50)],
    ['accent', c.accent], ['accent-on', c.on], ['accent-hover', MIX('var(--accent)', 'black', 8)],
    ['accent-active', c.active ?? MIX('var(--accent)', 'black', 14)],
    ['success', c.success ?? '#16a34a'], ['warn', c.warn ?? '#eab308'], ['danger', c.danger ?? '#dc2626'],
    ['font-display', b.font.display], ['font-body', b.font.body],
    ['font-mono', 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace'],
    ...TEXT_STEPS.map((s, i) => [`text-${s}`, `${b.text[i]}px`]),
    ['leading-body', b.leading[0]], ['leading-tight', b.leading[1]], ['tracking-display', b.tracking],
    ...[['1', 4], ['2', 8], ['3', 12], ['4', 16], ['5', 20], ['6', 24], ['8', 32], ['12', 48]].map(([k, v]) => [`space-${k}`, `${v}px`]),
    ['section-y-desktop', '96px'], ['section-y-tablet', '68px'], ['section-y-phone', '48px'],
    ['radius-sm', `${b.radius[0]}px`], ['radius-md', `${b.radius[1]}px`], ['radius-lg', `${b.radius[2]}px`], ['radius-pill', '9999px'],
    ['elev-flat', 'none'], ['elev-ring', '0 0 0 1px var(--border)'], ['elev-raised', b.elev],
    ['focus-ring', b.focus ?? '0 0 0 3px color-mix(in oklab, var(--accent), transparent 70%)'],
    ['motion-fast', '150ms'], ['motion-base', '200ms'], ['ease-standard', 'cubic-bezier(0.2, 0, 0, 1)'],
    ['container-max', `${b.container}px`],
    ['container-gutter-desktop', `${b.gutter ?? 36}px`], ['container-gutter-tablet', '24px'], ['container-gutter-phone', '16px'],
  ]
  const body = lines.map(([k, v]) => `  --${k}: ${v};`).join('\n')
  return `/* ${b.name}：值取自 DESIGN.md 的 colors / typography / rounded；
 * fg-2、muted、border 等 DESIGN.md 没单列的角色按 fg/bg 公式推出，大字号和 container-max 按版式补。 */\n:root {\n${body}\n}\n`
}

const rootOf = (css) => css.match(/:root\s*\{[\s\S]*?\n\}/)[0]

const skeleton = readFileSync(join(OD, 'design-systems/default/components.html'), 'utf8')
const SKELETON_ROOT = skeleton.match(/:root\s*\{[\s\S]*?\n\s*\}/)[0]

function componentsHtml(b, css) {
  const root = rootOf(css).replace(/\n/g, '\n      ')
  return skeleton
    .replace(SKELETON_ROOT, () => root)
    .replace('Neutral Modern — reference components', `${b.name} — reference components`)
    .replace('Reference fixture · default', `Reference fixture · ${b.name}`)
    .replace('Display and body share Inter but differ', 'Display and body differ')
    .replaceAll('design-systems/default', `design-systems/${b.id}`)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const b of BRANDS) {
  const src = join(TEMPLATES, `${b.id}.md`)
  if (!existsSync(src)) throw new Error(`缺模板：${src}`)
  const dir = join(OUT, b.id)
  mkdirSync(dir)
  cpSync(src, join(dir, 'DESIGN.md'))
  const css = tokensCss(b)
  writeFileSync(join(dir, 'tokens.css'), css)
  writeFileSync(join(dir, 'components.html'), componentsHtml(b, css))
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({
  systems: BRANDS.map(({ id, name, category, description }) => ({ id, name, category, description })),
}, null, 2) + '\n')
console.log(`${BRANDS.length} 套 → presets-extra/`)
