// 进看板的闸门：不合格的方案不显示，原因回传给 Agent 让它改。

const INTERACTION = /addEventListener\s*\(|\bon(?:click|change|input|submit|keydown|keyup|mouse\w+|pointer\w+|toggle)\s*=/i
const THEME = /data-theme|\.dark\b|light-dark\(/
const RESOURCE = /<(?:script|img|link|source|video|audio|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']*)["']/gi
const ABSOLUTE = /^(?:https?:|data:|blob:|\/\/|#|mailto:|javascript:)/i
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const issue = (code, message) => ({ code, message })

/** 静态检查：返回问题列表，空数组表示通过。 */
export function validateFrame(html) {
  const issues = []
  if (!INTERACTION.test(html)) {
    issues.push(issue('no-interaction', '页面里没有任何交互（没有 addEventListener，也没有 onclick 之类的属性），Play 模式下点不动。请做真正能用的控件：切换标签、筛选、展开收起、悬停提示等，脚本写在内联 <script> 里。'))
  }
  if (!THEME.test(html)) {
    issues.push(issue('no-theme', '没有做深浅两套主题。颜色全部走 CSS 变量，浅色放 :root，深色放 :root[data-theme="dark"]（或用 .dark 类、light-dark()）。'))
  }
  const relative = [...html.matchAll(RESOURCE)].map(m => m[1]).filter(u => u && !ABSOLUTE.test(u))
  if (relative.length) {
    issues.push(issue('relative-resource', `引用了相对路径的文件（${[...new Set(relative)].slice(0, 5).join('、')}），看板里加载不到。请改成内联，或用 https:// / data: 地址。`))
  }
  const colors = {}
  for (const [, key, value] of html.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{3,6})\b/gi)) if (colors[key] === undefined) colors[key] = value
  if (HEX.test(colors.fg || '') && HEX.test(colors.bg || '')) {
    const luminance = (hex) => {
      const raw = hex.slice(1)
      const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
      const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    }
    const ratio = (Math.max(luminance(colors.fg), luminance(colors.bg)) + 0.05) / (Math.min(luminance(colors.fg), luminance(colors.bg)) + 0.05)
    if (ratio < 4.5) issues.push(issue('low-contrast', `--fg 与 --bg 的对比度约为 ${ratio.toFixed(1)}:1，低于正文建议的 4.5:1。`))
  }
  if (/(?<![-\w])(?:width|min-width)\s*:\s*(?:1\d{3,}px|1\d{2}vw)(?!\s*\))/i.test(html)) {
    issues.push(issue('fixed-overflow', '页面包含可能导致窄屏溢出的固定宽度，请改用 max-width、流式布局或媒体查询。'))
  }
  return issues
}

/** 静态问题加运行时问题（运行时问题只在同一版页面上有效）：没问题的才显示，有问题的拦下并回传给 Agent。 */
export function splitFrames(frames, runtime) {
  const shown = []
  const rejected = []
  for (const f of frames) {
    const rt = runtime[f.id]
    const issues = [...(f.issues || []), ...(rt && rt.url === f.url ? rt.issues : [])]
    if (issues.length) rejected.push({ id: f.id, title: f.title, file: f.file, page: f.page, issues })
    else shown.push(f)
  }
  return { shown, rejected }
}
