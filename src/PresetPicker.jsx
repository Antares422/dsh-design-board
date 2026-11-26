import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './icons.jsx'
import presets from './presets.json'
import { ARTIFACTS, pageHtml } from './pagesOf.js'
import { ScaledFrame } from './ScaledFrame.jsx'
import { BORDER, BRAND, BRAND_ACTIVE, FG2, FLOAT, ICON_BUTTON, DISPLAY, PRIMARY, ROUND, tint } from './theme.js'

const ALL = '全部'
const byId = new Map(presets.map(p => [p.id, p]))
export const presetById = id => byId.get(id)

const categories = (() => {
  const counts = new Map()
  for (const p of presets) counts.set(p.category, (counts.get(p.category) || 0) + 1)
  return [ALL, ...[...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name)]
})()

const colorOf = (p, name) => p?.palette?.find(c => c.name === name)?.hex

/** 列表左侧的小缩略图：底色 + 文字线 + 强调色块。 */
function Thumb({ preset }) {
  const bg = colorOf(preset, '背景') || '#fff'
  return (
    <span style={{ width: 40, height: 28, flex: 'none', borderRadius: 6, background: bg, border: `1px solid ${BORDER}`, position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 5, top: 7, width: 16, height: 3, borderRadius: 2, background: colorOf(preset, '文字') }} />
      <span style={{ position: 'absolute', left: 5, top: 14, width: 10, height: 3, borderRadius: 2, background: colorOf(preset, '次要文字') }} />
      <span style={{ position: 'absolute', right: 4, bottom: 4, width: 11, height: 7, borderRadius: 3, background: colorOf(preset, '强调色') }} />
    </span>
  )
}

const section = { fontSize: 12, color: FG2, margin: '18px 0 8px', letterSpacing: 0.3 }

/** 点击放大：可点的缩略块，悬停时有提示。 */
function Zoomable({ onOpen, children }) {
  return (
    <button type="button" title="点击放大" onClick={onOpen} style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'zoom-in', color: 'inherit', font: 'inherit' }}>
      {children}
    </button>
  )
}

const COLOR_LABELS = [
  ['bg', '背景'], ['surface', '表面'], ['surface-warm', '暖表面'], ['fg', '文字'], ['fg-2', '次要文字'], ['muted', '弱化文字'],
  ['border', '边框'], ['accent', '强调色'], ['accent-on', '强调色上的文字'], ['accent-hover', '强调色悬停'], ['success', '成功'], ['warn', '警告'], ['danger', '危险'],
]
const FONT_LABELS = [['display', '标题'], ['body', '正文'], ['mono', '等宽']]
const GLYPHS = 'Aa Bb Cc 0123456789'
const familyName = (stack) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '')

const ORIGINAL_PAGES = [['typography', '字体排版'], ['colors', '调色板'], ['spacing', '布局与间距'], ['kit', '设计系统'], ['kitDark', '设计系统 · 深色'], ...ARTIFACTS]

function Swatch({ role, label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ height: 36, borderRadius: 6, background: value, border: `1px solid ${BORDER}` }} />
      <div style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: FG2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`--${role}: ${value}`}>{value}</div>
    </div>
  )
}

const CLOSE_BTN = { ...ICON_BUTTON, position: 'absolute', top: 12, right: 14, zIndex: 10, width: 28, height: 28, padding: 0, color: FG2 }

/** 按预设的 tokens 重绘的预览；所有文字都取自预设本身（名称、描述）或档位名。 */
function Preview({ preset, reference, showHeader = true }) {
  const [open, setOpen] = useState(null)
  const t = preset.tokens
  const c = t.colors || {}
  const fonts = t.fonts || {}
  const text = t.text || {}
  const radius = t.radius || {}
  const space = t.space || {}
  const bodyFont = fonts.body || 'system-ui, sans-serif'
  const displayFont = fonts.display || bodyFont
  const muted = c.muted || c['fg-2'] || FG2
  const card = { background: c.bg, color: c.fg, border: `1px solid ${c.border || BORDER}`, borderRadius: 10, padding: 14 }
  const originals = ORIGINAL_PAGES.map(([key, label]) => [key, label, pageHtml(preset, key)]).filter(([, , html]) => html)
  const button = (extra) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: '1px solid transparent', borderRadius: radius.md, padding: '0 16px', height: 36, fontSize: 14, lineHeight: 1, whiteSpace: 'nowrap', fontFamily: bodyFont, cursor: 'default', ...extra })
  return (
    <>
      {showHeader && (
        <>
          <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>{preset.name}</div>
          <div style={{ fontSize: 12, color: FG2, marginTop: 2 }}>{preset.category}</div>
        </>
      )}
      {preset.description && <p style={{ fontSize: 13, lineHeight: 1.6, margin: showHeader ? '10px 0 0' : 0 }}>{preset.description}</p>}

      <div style={section}>调色板</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
        {COLOR_LABELS.filter(([role]) => c[role]).map(([role, label]) => <Swatch key={role} role={role} label={label} value={c[role]} />)}
      </div>

      <div style={section}>字体</div>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FONT_LABELS.filter(([key]) => fonts[key]).map(([key, label]) => (
          <div key={key} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: muted }}>{label} · {familyName(fonts[key])}</div>
            <div style={{ fontFamily: fonts[key], fontSize: key === 'display' ? 30 : 18, lineHeight: 1.25, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {key === 'display' ? preset.name : GLYPHS}
            </div>
          </div>
        ))}
        <div style={{ fontFamily: bodyFont, fontSize: 14, lineHeight: 1.6, color: c['fg-2'] || c.fg }}>{preset.description}</div>
      </div>

      <div style={section}>字号阶梯</div>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(text).reverse().map(([step, size]) => (
          <div key={step} style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span style={{ flex: 'none', width: 104, fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>{step} · {size}</span>
            <span style={{ flex: 1, minWidth: 0, fontFamily: displayFont, fontSize: `min(${size}, 44px)`, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
          </div>
        ))}
      </div>

      <div style={section}>圆角与间距</div>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {Object.entries(radius).map(([k, v]) => (
            <div key={k} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <div style={{ height: 40, background: c['surface-warm'] || c.surface, border: `1px solid ${c.border}`, borderRadius: v }} />
              <div style={{ fontSize: 11, color: muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k} · {parseInt(v, 10) >= 500 ? 'pill' : v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(space).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 'none', width: 104, fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>space-{k} · {v}</span>
              <span style={{ flex: 'none', height: 8, width: v, maxWidth: 'calc(100% - 114px)', background: c.accent, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={section}>组件</div>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={button({ background: c.accent, color: c['accent-on'] || '#fff' })}>Primary</span>
          <span style={button({ background: 'transparent', color: c.fg, borderColor: c.border })}>Secondary</span>
          <span style={button({ background: 'transparent', color: c.accent })}>Ghost</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', boxSizing: 'border-box', height: 38, padding: '0 12px', border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.muted, fontFamily: t.fonts.body, fontSize: 14 }}>Input</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['success', 'warn', 'danger'].filter(k => c[k]).map(k => (
            <span key={k} style={{ fontSize: 12, padding: '2px 10px', borderRadius: radius.pill, border: `1px solid ${c[k]}`, color: c[k], fontFamily: t.fonts.body }}>{k}</span>
          ))}
        </div>
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: radius.md, boxShadow: t.elevRaised, padding: 14 }}>
          <div style={{ fontFamily: displayFont, fontSize: 18 }}>{preset.name}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: muted, marginTop: 4, lineHeight: 1.5 }}>{preset.description}</div>
        </div>
      </div>

      {originals.length > 0 && (
        <>
          <div style={section}>原版页面 · {originals.length}（点开放大）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {originals.map(([key, label, html]) => (
              <Zoomable key={key} onOpen={() => setOpen([`${preset.name} · ${label}`, html])}>
                <ScaledFrame html={html} designWidth={1000} ratio={0.625} title={label} />
                <div style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
              </Zoomable>
            ))}
          </div>
        </>
      )}
      {reference && (
        <>
          <div style={section}>参考页</div>
          <ScaledFrame html={reference} designWidth={1100} title={`${preset.name} 参考页`} />
        </>
      )}
      {open && (
        <div onPointerDown={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onPointerDown={(e) => e.stopPropagation()} style={{ ...FLOAT, width: 'min(1440px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 8px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{open[0]}</span>
              <button type="button" title="关闭" style={ICON_BUTTON} onClick={() => setOpen(null)}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: 12 }}>
              <ScaledFrame html={open[1]} designWidth={1100} title={open[0]} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** 设计体系选择器：左侧搜索/分类/列表，右侧预览；选用后由调用方推给 Agent。 */
export function PresetPicker({ value, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL)
  const [focusId, setFocusId] = useState(value || null)
  const listRef = useRef(null)
  const previewRef = useRef(null)
  const scrolledRef = useRef(false)
  useEffect(() => {
    if (scrolledRef.current || !value) return
    const list = listRef.current
    const el = list?.querySelector(`[data-id="${value}"]`)
    if (el) {
      list.scrollTop += el.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - el.offsetHeight) / 2
      scrolledRef.current = true
    }
  }, [value])
  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = 0
  }, [focusId])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return presets.filter(p => (category === ALL || p.category === category) && (!q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)))
  }, [query, category])
  const focus = focusId ? byId.get(focusId) ?? null : null
  const apply = (id) => { onChange(id); onClose() }

  const row = (active) => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 8px', border: 'none', borderRadius: 10, textAlign: 'left',
    background: active ? tint(BRAND, 8) : 'transparent', color: active ? BRAND_ACTIVE : 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  })

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={onClose} />
      <div
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        style={{ ...FLOAT, position: 'absolute', zIndex: 20, top: 8, bottom: 12, right: 12, left: 12, display: 'flex', overflow: 'hidden' }}
      >
        <div style={{ width: 'clamp(210px, 25%, 310px)', flex: 'none', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER}`, minHeight: 0 }}>
          <div style={{ padding: '10px 8px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px', borderRadius: 8, cornerShape: ROUND, background: 'light-dark(rgba(0,0,0,.045), rgba(255,255,255,.07))', border: '0.5px solid light-dark(rgba(0,0,0,.10), rgba(255,255,255,.12))' }}>
              <span style={{ display: 'inline-flex', color: FG2, flex: 'none' }}><Icon name="search" size={14} /></span>
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索设计体系"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 13 }}
              />
              {query && (
                <button
                  type="button" title="清除搜索" onClick={() => setQuery('')}
                  style={{ ...ICON_BUTTON, minWidth: 18, width: 18, height: 18, padding: 0, color: FG2, flex: 'none' }}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>
          </div>
          <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 8px' }}>
            <button type="button" style={row(false)} onClick={() => apply(null)}>
              <span style={{ width: 40, height: 28, flex: 'none', borderRadius: 6, border: `1px dashed ${BORDER}` }} />
              <span style={{ flex: 1 }}>不指定设计系统</span>
              {!value && <Icon name="check" size={16} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: FG2, padding: '8px 8px 4px' }}>
              <span>内置预设 · {list.length}</span>
              <span style={{ position: 'relative', flex: 'none', display: 'inline-flex', alignItems: 'center', color: category === ALL ? FG2 : BRAND_ACTIVE }}>
                <select
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ appearance: 'none', fieldSizing: 'content', border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 12, padding: '0 14px 0 0', cursor: 'pointer', maxWidth: 96 }}
                >
                  {categories.map(c => <option key={c} value={c}>{c === ALL ? '全部' : c}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 0, pointerEvents: 'none', display: 'flex' }}><Icon name="chevron" size={12} /></span>
              </span>
            </div>
            {list.map(p => (
              <button key={p.id} data-id={p.id} type="button" style={row(p.id === focusId)} onClick={() => setFocusId(p.id)} onDoubleClick={() => apply(p.id)}>
                <Thumb preset={p} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: FG2 }}>{p.category}</span>
                </span>
                {p.id === value && <Icon name="check" size={16} />}
              </button>
            ))}
            {!list.length && <div style={{ padding: 16, fontSize: 13, color: FG2 }}>没有匹配的设计体系</div>}
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <button type="button" className="dsb-close-btn" title="关闭" onClick={onClose} style={CLOSE_BTN}>
            <Icon name="close" size={16} />
          </button>
          <div style={{ padding: 'clamp(14px, 2vw, 20px) calc(clamp(16px, 3vw, 28px) + 28px) 10px clamp(16px, 3vw, 28px)', flex: 'none' }}>
            <div style={{ minWidth: 0 }}>
              {focus ? (
                <>
                  <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{focus.name}</div>
                  <div style={{ fontSize: 12, color: FG2, marginTop: 2 }}>{focus.category}</div>
                </>
              ) : (
                <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: FG2 }}>设计体系预览</div>
              )}
            </div>
          </div>
          <div ref={previewRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 clamp(16px, 3vw, 28px) clamp(16px, 2.5vw, 24px)' }}>
            {focus ? (
              <Preview preset={focus} showHeader={false} />
            ) : (
              <div style={{ color: FG2, fontSize: 13, paddingTop: 40, textAlign: 'center' }}>从左侧选一个设计体系预览</div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '10px clamp(16px, 3vw, 28px)', borderTop: `1px solid ${BORDER}` }}>
            <button
              type="button" disabled={!focus || focus.id === value}
              style={{ ...ICON_BUTTON, ...PRIMARY, minWidth: 72, opacity: !focus || focus.id === value ? 0.4 : 1 }}
              onClick={() => focus && apply(focus.id)}
            >{focus && focus.id === value ? '已选用' : '选用'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
