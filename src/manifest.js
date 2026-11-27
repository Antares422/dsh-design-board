const positive = n => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined)
const finite = n => (typeof n === 'number' && Number.isFinite(n) ? n : undefined)
const PAGE_ID = /^[A-Za-z0-9_-]{1,40}$/

/** 页：id 合法且不重复才保留，name 缺省用 id。 */
function normalizePages(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const pages = []
  for (const p of raw) {
    const id = typeof p?.id === 'string' ? p.id.trim() : ''
    if (!PAGE_ID.test(id) || seen.has(id)) continue
    seen.add(id)
    pages.push({ id, name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : id })
  }
  return pages
}

/** 便签/标题：没有文字就丢掉，坐标缺省 0，page 必须在已声明的页里。 */
function normalizeNotes(raw, pages) {
  if (!Array.isArray(raw)) return []
  const known = new Set(pages.map(p => p.id))
  const notes = []
  for (const n of raw) {
    if (!n || typeof n.text !== 'string' || !n.text.trim()) continue
    notes.push({
      id: `note-${notes.length + 1}`,
      text: n.text,
      kind: n.kind === 'title' ? 'title' : 'sticky',
      page: typeof n.page === 'string' && known.has(n.page) ? n.page : undefined,
      x: finite(n.x) ?? 0,
      y: finite(n.y) ?? 0,
    })
  }
  return notes
}

/** order 里出现的 id 排前面，其余保持原顺序。 */
function applyOrder(frames, order) {
  if (!Array.isArray(order)) return frames
  const byId = new Map(frames.map(f => [f.id, f]))
  const used = new Set()
  const out = []
  for (const id of order) {
    if (typeof id !== 'string' || used.has(id) || !byId.has(id)) continue
    used.add(id)
    out.push(byId.get(id))
  }
  for (const f of frames) if (!used.has(f.id)) out.push(f)
  return out
}

/** 规整 board.json：补默认标题/id，丢掉没有 file 的帧，id 去重，再按 pages/order/notes 整理；清单不可用时抛错。 */
export function normalizeManifest(raw) {
  if (!raw || !Array.isArray(raw.frames)) throw new Error('清单里没有 frames 数组')

  const pages = normalizePages(raw.pages)
  const known = new Set(pages.map(p => p.id))
  const seen = new Map()
  let frames = []
  raw.frames.forEach((f, i) => {
    if (!f || typeof f.file !== 'string' || !f.file) return
    const base = String(f.id ?? i + 1)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    frames.push({
      id: n === 1 ? base : `${base}-${n}`,
      title: typeof f.title === 'string' && f.title ? f.title : `方案 ${i + 1}`,
      file: f.file,
      width: positive(f.width),
      height: positive(f.height),
      page: known.has(f.page) ? f.page : undefined,
    })
  })
  if (!frames.length) throw new Error('清单里没有可用的帧（每帧需要 file）')
  frames = applyOrder(frames, raw.order)

  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : '设计画布',
    source: typeof raw.source === 'string' && raw.source ? raw.source : undefined,
    version: typeof raw.version === 'string' && raw.version ? raw.version : undefined,
    status: typeof raw.status === 'string' && raw.status ? raw.status : undefined,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : undefined,
    preset: raw.preset && typeof raw.preset === 'object' ? {
      id: typeof raw.preset.id === 'string' ? raw.preset.id : undefined,
      name: typeof raw.preset.name === 'string' ? raw.preset.name : undefined,
      version: typeof raw.preset.version === 'string' ? raw.preset.version : undefined,
    } : undefined,
    previous: raw.previous && typeof raw.previous === 'object' ? {
      version: typeof raw.previous.version === 'string' ? raw.previous.version : undefined,
      source: typeof raw.previous.source === 'string' ? raw.previous.source : undefined,
    } : undefined,
    frames,
    pages,
    notes: normalizeNotes(raw.notes, pages),
  }
}

const HTML_FILE = /\.html?$/i
const SESSION_DIR_NAME = /^(?:session[-_][a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** 没有 board.json 时：目录里的 html 按文件名排成帧；标题先用文件名，读到内容后由 fillFromHtml 补。 */
export function manifestFromListing(dir, entries) {
  const frames = entries
    .filter(e => e.type === 'file' && HTML_FILE.test(e.name))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map(file => {
      const id = file.replace(HTML_FILE, '')
      return { id, title: id, file, auto: true }
    })
  const leaf = dir.split('/').pop() || ''
  const title = !leaf || !frames.length || SESSION_DIR_NAME.test(leaf) ? '设计画布' : leaf
  return { title, frames, pages: [], notes: [] }
}

/** 从页面自身取 <title> 和 viewport 里的 width/height（都是数字才算）。 */
export function metaOfHtml(html) {
  const out = {}
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1].trim()
  if (title) out.title = title
  const viewport = /<meta\b[^>]*\bname=["']viewport["'][^>]*>/i.exec(html)?.[0] ?? ''
  const content = /\bcontent=["']([^"']*)["']/i.exec(viewport)?.[1] ?? ''
  for (const key of ['width', 'height']) {
    const n = Number(new RegExp(`\\b${key}\\s*=\\s*(\\d+)`, 'i').exec(content)?.[1])
    if (n > 0) out[key] = n
  }
  return out
}

/** 只补自动生成的帧：清单里写明的标题和尺寸不动。 */
export function fillFromHtml(frame, html) {
  if (!frame.auto) return frame
  const meta = metaOfHtml(html)
  return {
    ...frame,
    title: meta.title ?? frame.title,
    width: frame.width ?? meta.width,
    height: frame.height ?? meta.height,
  }
}
