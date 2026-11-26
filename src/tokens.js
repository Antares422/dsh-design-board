const COLOR_KEYS = [
  'bg', 'surface', 'surface-warm', 'fg', 'fg-2', 'muted', 'meta', 'border', 'border-soft',
  'accent', 'accent-on', 'accent-hover', 'accent-active', 'success', 'warn', 'danger',
]
const FONT_KEYS = [['display', 'font-display'], ['body', 'font-body'], ['mono', 'font-mono']]
const TEXT_STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']
const RADIUS_STEPS = ['sm', 'md', 'lg', 'pill']
const SPACE_STEPS = ['1', '2', '3', '4', '5', '6', '8', '12']

/**
 * 把设计体系的 tokens.css 解析成和官方预设预览同构的结构：
 * colors / fonts / text / radius / space / elevRaised。只认「--名: 值;」。
 */
export function parseTokens(css) {
  const text = String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
  const vars = Object.fromEntries(
    [...text.matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)].map(([, name, value]) => [name, value.trim()]),
  )
  const colors = {}
  for (const key of COLOR_KEYS) if (vars[key] !== undefined) colors[key] = vars[key]
  const fonts = {}
  for (const [key, name] of FONT_KEYS) if (vars[name] !== undefined) fonts[key] = vars[name]
  const steps = (prefix, keys) => {
    const out = {}
    for (const key of keys) {
      const value = vars[`${prefix}-${key}`]
      if (value !== undefined) out[key] = value
    }
    return out
  }
  return {
    colors,
    fonts,
    text: steps('text', TEXT_STEPS),
    radius: steps('radius', RADIUS_STEPS),
    space: steps('space', SPACE_STEPS),
    elevRaised: vars['elev-raised'],
  }
}
