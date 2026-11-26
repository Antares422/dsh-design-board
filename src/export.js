import { PDFDocument } from 'pdf-lib'
import { toJpeg, toPng } from 'html-to-image'

/** 文件名：去掉文件系统不认的字符，空标题用 design；suffix 如 2x。 */
export function exportName(title, suffix, ext) {
  const base = String(title ?? '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'design'
  return `${base}${suffix ? ` ${suffix}` : ''}.${ext}`
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function buildHtmlGallery(frames, title = 'Design Board', metadata = {}) {
  const items = frames.map(frame => {
    const width = Number.isFinite(frame.width) && frame.width > 0 ? frame.width : 1280
    const height = Number.isFinite(frame.height) && frame.height > 0 ? frame.height : 800
    const html = escapeHtml(frame.html || '')
    return `<section><h2>${escapeHtml(frame.title)}</h2><iframe title="${escapeHtml(frame.title)}" srcdoc="${html}" style="width:100%;height:${height}px" sandbox="allow-scripts"></iframe></section>`
  }).join('\n')
  const source = new Date().toISOString()
  const meta = { ...metadata, exportedAt: source }
  const metaTags = Object.entries(meta).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `<meta name="design-board-${escapeHtml(key)}" content="${escapeHtml(value)}">`).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Design Board">${metaTags}<title>${escapeHtml(title)}</title><style>body{margin:0;padding:24px;background:#f5f5f7;color:#1d1d1f;font:16px system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,640px),1fr));gap:24px}section{min-width:0}h2{font-size:18px}iframe{display:block;border:0;background:#fff}</style></head><body><main>${items}</main></body></html>`
}

export function downloadText(text, filename, type = 'text/html') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  downloadUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** data:image/...;base64,xxx → 字节。 */
export function dataUrlBytes(dataUrl) {
  const text = String(dataUrl)
  const at = text.indexOf(',')
  const binary = at >= 0 ? atob(text.slice(at + 1)) : ''
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const MAX_EXPORT_SIDE = 8000
export const MAX_EXPORT_PIXELS = 16_000_000

/** 导出倍率：默认 2×，但不超过总像素预算；非法或超大画板直接报错，避免把宿主内存打爆。 */
export function exportScale(width, height, maxRatio = 2) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('画板尺寸不合法')
  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE) throw new Error(`画板单边太大（最多 ${MAX_EXPORT_SIDE}px）`)
  if (width * height > MAX_EXPORT_PIXELS) throw new Error('画板面积太大，无法导出')
  return Math.min(maxRatio, Math.sqrt(MAX_EXPORT_PIXELS / (width * height)))
}

/** 每张 JPEG 一页，页面尺寸用 CSS 像素（1px = 1pt）。 */
export async function buildPdf(pages) {
  const pdf = await PDFDocument.create()
  for (const { jpeg, width, height } of pages) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 14400 || height > 14400) {
      throw new Error('PDF 页面尺寸超出范围')
    }
    const image = await pdf.embedJpg(jpeg)
    const page = pdf.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
  }
  return pdf.save()
}

const LOAD_TIMEOUT = 8000
const IMAGE_TIMEOUT = 3000

const backgroundOf = (doc) => {
  const style = doc.defaultView?.getComputedStyle
  for (const el of [doc.body, doc.documentElement]) {
    if (!el) continue
    const bg = style?.(el)?.backgroundColor
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg
  }
  return '#fff'
}

/** 等页面里的图片加载完（跨域失败也算完成，不让导出一直等）。 */
function waitImages(doc) {
  const wait = Promise.all([...doc.images].map(img => (img.complete ? Promise.resolve() : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true })
    img.addEventListener('error', resolve, { once: true })
  }))))
  return Promise.race([wait, new Promise(resolve => setTimeout(resolve, IMAGE_TIMEOUT))])
}

/** 把一段 HTML 放进不跑脚本的同源 iframe，栅格化成 PNG/JPEG data URL。 */
export async function renderHtml(html, width, height, { type = 'jpeg', pixelRatio = 2 } = {}) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;border:0;visibility:hidden`
  frame.srcdoc = html
  document.body.appendChild(frame)
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('页面加载超时')), LOAD_TIMEOUT)
      frame.addEventListener('load', () => { clearTimeout(timer); resolve() }, { once: true })
    })
    const doc = frame.contentDocument
    if (!doc) throw new Error('导出页面不可读')
    await Promise.race([doc.fonts?.ready ?? Promise.resolve(), new Promise(resolve => setTimeout(resolve, IMAGE_TIMEOUT))])
    await waitImages(doc)
    const options = { width, height, pixelRatio, cacheBust: true, backgroundColor: backgroundOf(doc) }
    return type === 'png' ? toPng(doc.documentElement, options) : toJpeg(doc.documentElement, { ...options, quality: 0.95 })
  } finally {
    frame.remove()
  }
}

/** 向帧要一份渲染后的 DOM，再栅格化；ask 是看板与帧之间的 postMessage 请求函数。 */
export async function frameImage(ask, frameId, width, height, { type = 'png', pixelRatio = 2 } = {}) {
  const ratio = exportScale(width, height, pixelRatio)
  const reply = await ask(frameId, { dsb: 'snapshot' }, LOAD_TIMEOUT)
  if (!reply?.html) throw new Error('没拿到页面内容，等页面加载完再试')
  return renderHtml(reply.html, width, height, { type, pixelRatio: ratio })
}

export function downloadBytes(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  downloadUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDataUrl(dataUrl, filename) {
  downloadUrl(dataUrl, filename)
}

function downloadUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
