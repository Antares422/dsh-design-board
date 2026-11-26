// 把 OpenDesign 预设（~/.agents/opendesign-presets）整理进插件：每套留 DESIGN.md / tokens.css / components.html / components.manifest.json，
// 并生成 presets/index.json（宿主半的 design_preset 工具用）和 src/presets.json（看板预设库用，只含预览所需的字段）。
// 用法：node scripts/build-presets.mjs [源目录]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { renderPage, splitPage } from '../src/presetPage.js'

const SRC = process.argv[2] || join(homedir(), '.agents/opendesign-presets')
const OUT = new URL('../presets/', import.meta.url).pathname
const FILES = ['DESIGN.md', 'tokens.css', 'components.html', 'components.manifest.json']

const CATEGORY_ZH = {
  'AI & LLM': 'AI 与大模型', 'Media & Consumer': '媒体与消费', 'Productivity & SaaS': '效率与 SaaS',
  'Creative & Artistic': '创意与艺术', 'Professional & Corporate': '专业与企业', 'Modern & Minimal': '现代极简',
  'Developer Tools': '开发者工具', 'Backend & Data': '后端与数据', 'Themed & Unique': '主题与独特',
  'Bold & Expressive': '大胆与表现力', 'Design & Creative': '设计与创意', 'Fintech & Crypto': '金融科技与加密',
  'Automotive': '汽车', 'Morphism & Effects': '拟态与特效', 'E-Commerce & Retail': '电商与零售',
  'Layout & Structure': '布局与结构', 'Retro & Nostalgic': '复古怀旧', 'Starter': '入门',
  'Editorial · Studio': '编辑与出版', 'Editorial & Print': '编辑与出版', 'Editorial / Personal / Publication': '编辑与出版',
  'Social & Messaging': '社交与通讯',
}
// 调色板：[中文名, tokens.css 变量]
const PALETTE = [['背景', 'bg'], ['表面', 'surface'], ['文字', 'fg'], ['次要文字', 'muted'], ['边框', 'border'], ['强调色', 'accent']]

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').trim()

/** 取第一次出现的 `--name: value;`（值可能折行）。 */
function tokenOf(css, name) {
  const m = css.match(new RegExp(`^\\s*--${name}\\s*:\\s*([^;]+);`, 'm'))
  return m ? stripComments(m[1]) : undefined
}

/** 值是 var(--x) 时顺着引用解析（最多三层）。 */
function resolved(css, name, depth = 0) {
  const v = tokenOf(css, name)
  const ref = v?.match(/^var\(--([\w-]+)\)$/)
  return ref && depth < 3 ? resolved(css, ref[1], depth + 1) : v
}

const firstFont = (css, name) => tokenOf(css, name)?.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || undefined

const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch)a?\([^)]*\))$/i

/** 第一个 :root 块里所有 `--name: value;`（值可折行）。 */
function rootVars(css) {
  const start = css.indexOf(':root')
  const body = css.slice(start, css.indexOf('\n}', start))
  const vars = {}
  for (const m of body.matchAll(/^\s*--([\w-]+)\s*:\s*([^;]+);/gm)) vars[m[1]] = stripComments(m[2])
  return vars
}

/** 解析 var(--x) 引用（最多三层）。 */
const deref = (vars, v, depth = 0) => {
  const ref = v?.match(/^var\(--([\w-]+)\)$/)
  return ref && depth < 3 ? deref(vars, vars[ref[1]], depth + 1) : v
}

const COLOR_ROLES = ['bg', 'surface', 'surface-warm', 'fg', 'fg-2', 'muted', 'border', 'accent', 'accent-on', 'accent-hover', 'success', 'warn', 'danger']
const TEXT_STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']
const SPACE_STEPS = ['1', '2', '3', '4', '5', '6', '8', '12']

/** 预览重绘用：色彩角色、字体、字号阶梯、圆角、间距、阴影，值保持 tokens.css 原样（可直接当 CSS 用）。 */
function tokensOf(css) {
  const vars = rootVars(css)
  const get = k => deref(vars, vars[k])
  const pick = (keys, prefix) => Object.fromEntries(keys.map(k => [k, get(prefix + k)]).filter(([, v]) => v && !v.includes('var(')))
  return {
    colors: pick(COLOR_ROLES, ''),
    fonts: pick(['display', 'body', 'mono'], 'font-'),
    text: pick(TEXT_STEPS, 'text-'),
    radius: pick(['sm', 'md', 'lg', 'pill'], 'radius-'),
    space: pick(SPACE_STEPS, 'space-'),
    elevRaised: get('elev-raised'),
  }
}

// 官方源缺 components.manifest.json 时，用 Open Design 自带的提取函数从 components.html 现生成（151 套已有的逐一比对完全一致）
const OD_MANIFEST = join(homedir(), 'Applications/Open Design Patched.app/Contents/Resources/app/node_modules/@open-design/contracts/dist/design-systems/components-manifest.mjs')
const extractManifest = existsSync(OD_MANIFEST) ? (await import(OD_MANIFEST)).extractComponentsManifest : undefined
let generatedManifests = 0

const index = JSON.parse(readFileSync(join(SRC, 'index.json'), 'utf8'))
// presets-extra/：OpenDesign 没收、由 build-extra-presets.mjs 补的几套（getdesign 的 DESIGN.md）
const EXTRA = new URL('../presets-extra/', import.meta.url).pathname
const extraIds = new Set()
if (existsSync(join(EXTRA, 'index.json'))) {
  for (const s of JSON.parse(readFileSync(join(EXTRA, 'index.json'), 'utf8')).systems) {
    if (index.systems.some(x => x.id === s.id)) continue
    index.systems.push(s)
    extraIds.add(s.id)
  }
}
if (extraIds.size) index.systems.sort((a, b) => (a.id < b.id ? -1 : 1)) // 补进来的几套按 id 插进原有顺序
const sourceDir = (id) => (extraIds.has(id) ? join(EXTRA, id) : join(SRC, 'design-systems', id))
// 官方源缺、靠 Open Design 应用现生成的 components.manifest.json：应用不在时沿用上一版，别随目录重建丢掉
const previousManifests = new Map()
if (existsSync(OUT)) {
  for (const s of index.systems) {
    const file = join(OUT, s.id, 'components.manifest.json')
    if (existsSync(file)) previousManifests.set(s.id, readFileSync(file, 'utf8'))
  }
}
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// 预览用的整页：设计系统套件（浅/深）和 6 种素材。模板去重，各套只存色值块和变量块
const PAGES = {
  kit: 'system/kit.html', kitDark: 'system/kit.dark.html',
  colors: 'preview/colors.html', typography: 'preview/typography.html', spacing: 'preview/spacing.html',
  landing: 'system/artifacts/landing.html', deck: 'system/artifacts/deck.html', email: 'system/artifacts/email.html',
  form: 'system/artifacts/form.html', newsletter: 'system/artifacts/newsletter.html', poster: 'system/artifacts/poster.html',
}
const templates = []
const templateIndex = new Map()
const blobs = [] // :root 色值块和 --od 变量块，同一套的各页相同，去重存一份
const blobIndex = new Map()
const blobId = (text) => {
  if (text === undefined) return null
  if (!blobIndex.has(text)) { blobIndex.set(text, blobs.length); blobs.push(text) }
  return blobIndex.get(text)
}
const pages = {}
let roundTripFailures = 0

const TOKENS_LINK = /<link[^>]*href="\.\.\/tokens\.css"[^>]*>/

/** 第一个 :root 块里的全部变量，写成一个 :root 块。 */
function inlineRoot(css) {
  const vars = rootVars(css)
  return `<style>\n:root {\n${Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}\n</style>`
}

function packPages(s, from, css) {
  const meta = { name: s.name, category: s.category, description: s.description }
  const out = {}
  for (const [key, file] of Object.entries(PAGES)) {
    if (!existsSync(join(from, file))) continue
    let html = readFileSync(join(from, file), 'utf8')
    if (TOKENS_LINK.test(html)) html = html.replace(TOKENS_LINK, () => inlineRoot(css))
    const { template, parts } = splitPage(html, meta)
    if (renderPage(template, parts, meta) !== html) { roundTripFailures++; console.warn('还原不一致，跳过:', s.id, file); continue }
    if (!templateIndex.has(template)) { templateIndex.set(template, templates.length); templates.push(template) }
    out[key] = [templateIndex.get(template), blobId(parts.root), blobId(parts.od)]
  }
  return out
}

const entries = []
for (const s of index.systems) {
  const from = sourceDir(s.id)
  if (!existsSync(join(from, 'DESIGN.md'))) { console.warn('跳过（缺 DESIGN.md）:', s.id); continue }
  mkdirSync(join(OUT, s.id))
  for (const f of FILES) if (existsSync(join(from, f))) cpSync(join(from, f), join(OUT, s.id, f))
  const css = readFileSync(join(from, 'tokens.css'), 'utf8')
  const manifestFile = join(OUT, s.id, 'components.manifest.json')
  if (!existsSync(manifestFile) && previousManifests.has(s.id)) writeFileSync(manifestFile, previousManifests.get(s.id))
  if (!existsSync(manifestFile) && extractManifest && existsSync(join(from, 'components.html'))) {
    const manifest = extractManifest({ brandId: s.id, fixtureHtml: readFileSync(join(from, 'components.html'), 'utf8'), tokensCss: css })
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
    generatedManifests++
  }
  pages[s.id] = packPages(s, from, css)
  entries.push({
    id: s.id,
    name: s.name,
    category: CATEGORY_ZH[s.category] || s.category,
    categoryEn: s.category, // 预览页模板按英文类别还原
    description: s.description,
    palette: PALETTE
      .map(([label, v]) => ({ name: label, hex: resolved(css, v) }))
      .filter(p => /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch)a?\([^)]*\))$/i.test(p.hex || '')),
    fonts: { display: firstFont(css, 'font-display'), body: firstFont(css, 'font-body') },
    accentOn: resolved(css, 'accent-on'),
    radius: tokenOf(css, 'radius-md'),
    tokens: tokensOf(css),
  })
}
// 官方源里缺页的预设，用其余预设共用的模板加自己的 tokens 补齐。
// kit 的 28 个模板变体只差类别文字的转义，版式是同一个；深色版的底色/表面/文字/边框是固定的一组。
const SYNTH_KEYS = ['kit', 'kitDark', 'colors', 'typography', 'spacing', 'landing', 'deck', 'email', 'form', 'newsletter', 'poster']
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)))

/** tokens.css 第一个 :root 的变量，写成 :root 块（变量名排序，值折成一行）。 */
const rootBlock = (vars) => `:root {\n${Object.entries(sorted(vars)).map(([k, v]) => `    --${k}: ${v.replace(/\s+/g, ' ')};`).join('\n')}\n  }`

/** --od-* 变量由 tokens 推出（150 套有页面的预设逐一核对过一致）。 */
const DARK_OD = { 'page-bg': '#0f1115', surface: '#171a21', text: '#f8fafc', muted: '#a7adba', border: '#2a2f3a' }
function odBlock(vars, dark) {
  const g = (k) => deref(vars, vars[k])?.replace(/\s+/g, ' ')
  const pairs = [['page-bg', 'bg'], ['surface', 'surface'], ['text', 'fg'], ['muted', 'muted'], ['border', 'border'], ['accent', 'accent'], ['radius', 'radius-md'], ['font-body', 'font-body'], ['font-display', 'font-display']]
  return pairs.map(([od, k]) => `  --od-${od}: ${dark && DARK_OD[od] ? DARK_OD[od] : g(k)};`).join('\n') + '\n'
}

const GUIDE_KEYS = ['colors', 'typography', 'spacing']
const rawRootBlock = (vars) => `:root {\n${Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`

const majority = (key) => {
  const count = new Map()
  for (const page of Object.values(pages)) if (page[key]) count.set(page[key][0], (count.get(page[key][0]) || 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1])[0][0]
}
/** 为一套预设合成 key 页的索引项：模板取最多预设共用的那个。 */
function synthPage(css, key) {
  const vars = rootVars(css)
  // 规范页（colors/typography/spacing）的 :root 是 tokens.css 原顺序，其余页按变量名排序
  const tpl = majority(key)
  const withOd = Object.values(pages).find(page => page[key]?.[0] === tpl)[key][2] !== null
  return [tpl, blobId(GUIDE_KEYS.includes(key) ? rawRootBlock(vars) : rootBlock(vars)), withOd ? blobId(odBlock(vars, key === 'kitDark')) : null]
}

// 校验：对已有页面的预设按同样办法合成，去掉空白后应与原页面一致
const squash = (h) => h.replace(/&amp;/g, '&').replace(/\s+/g, '')
let synthChecked = 0
const blobMark = blobs.length // 校验用的临时块不留进产物
const synthMismatch = []
for (const e of entries.filter(x => pages[x.id].landing && pages[x.id].colors && pages[x.id].kit)) {
  const css = readFileSync(join(sourceDir(e.id), 'tokens.css'), 'utf8')
  for (const key of SYNTH_KEYS) {
    const orig = pages[e.id][key]
    if (!orig) continue
    const meta = { name: e.name, category: e.categoryEn, description: e.description }
    const render = (entry) => renderPage(templates[entry[0]], { root: entry[1] === null ? undefined : blobs[entry[1]], od: entry[2] === null ? undefined : blobs[entry[2]] }, meta)
    synthChecked++
    if (squash(render(synthPage(css, key))) !== squash(render(orig))) synthMismatch.push(`${e.id}/${key}`)
  }
}
for (const [text, i] of [...blobIndex]) if (i >= blobMark) blobIndex.delete(text)
blobs.length = blobMark
console.log(`合成校验 ${synthChecked} 页，不一致 ${synthMismatch.length} 页`, synthMismatch.slice(0, 5))

let synthesized = 0
for (const e of entries) {
  const css = readFileSync(join(sourceDir(e.id), 'tokens.css'), 'utf8')
  for (const key of SYNTH_KEYS) {
    if (pages[e.id][key]) continue
    pages[e.id][key] = synthPage(css, key)
    synthesized++
  }
}
console.log(`合成缺页 ${synthesized} 页，生成 manifest ${generatedManifests} 个`)
writeFileSync(join(OUT, 'index.json'), JSON.stringify(entries))
writeFileSync(new URL('../src/presets.json', import.meta.url).pathname, JSON.stringify(entries))
writeFileSync(new URL('../src/presetPages.json', import.meta.url).pathname, JSON.stringify({ templates, blobs, pages }))
console.log(`页面模板 ${templates.length} 个，还原失败 ${roundTripFailures} 个`)
console.log(`${entries.length} 套预设 → presets/，类别 ${new Set(entries.map(e => e.category)).size} 个`)
