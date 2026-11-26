// 底色/边框/文字取宿主主题变量；选中、标注、主按钮用 Apple 蓝（变量在 Board.jsx 的 OVERRIDE_CSS 里定义）
export const SELECT = 'var(--dsb-select)'
export const BRAND = 'var(--dsb-primary)'
export const BRAND_ACTIVE = 'var(--dsb-primary-active)'
export const INK = 'var(--dsb-ink)'
export const CANVAS = 'var(--dsb-canvas)'
export const FG2 = 'var(--dsb-muted)'
export const BORDER = 'var(--dsb-hair)'
export const DISPLAY = 'var(--dsb-display)'

/** 胶囊：按钮、药丸形控件统一用这个圆角。 */
export const PILL = 980
// 宿主全局给圆角加了 superellipse：胶囊要改回正圆弧，大面板保留连续圆角
export const ROUND = 'round'

/** 画布下方的工具条：跟随浅/深色主题，浅色下是白胶囊，深色下是石墨胶囊。 */
export const DOCK = {
  background: 'light-dark(#fff, #272729)', color: 'light-dark(#1d1d1f, #f5f5f7)',
  border: '1px solid light-dark(#d2d2d7, #272729)', borderRadius: PILL, cornerShape: ROUND,
  boxShadow: '0 12px 32px light-dark(rgba(0,0,0,.10), rgba(0,0,0,.22))',
}

export const tint = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`

/** 浮在画布上的面板：卡片底 + 细边 + 圆角 18 */
export const FLOAT = {
  background: 'var(--dsb-float)',
  color: INK,
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  boxShadow: '0 12px 32px rgba(0,0,0,.08)',
}

export const ICON_BUTTON = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  minWidth: 28, height: 28, padding: '0 6px', border: 'none', borderRadius: PILL, cornerShape: ROUND,
  background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap',
}

/** 面板里的主按钮 / 次按钮：胶囊形，尺寸统一，不参与压缩（文字不竖排）。 */
export const PRIMARY = { flex: 'none', whiteSpace: 'nowrap', height: 36, padding: '0 22px', background: BRAND, color: '#fff', fontWeight: 600, fontSize: 14 }
export const SECONDARY = { flex: 'none', whiteSpace: 'nowrap', height: 36, padding: '0 18px', border: `1px solid ${BRAND}`, color: BRAND_ACTIVE, fontWeight: 600, fontSize: 14 }
