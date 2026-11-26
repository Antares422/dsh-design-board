import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, ReactFlow, ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react'
import flowCss from '@xyflow/react/dist/style.css'
import { BoardContext } from './context.js'
import { FrameNode } from './FrameNode.jsx'
import { NoteNode } from './NoteNode.jsx'
import { AnnotationLayer } from './AnnotationLayer.jsx'
import { Icon } from './icons.jsx'
import { buildBoardBinding, buildFeedback, buildPreset } from './feedback.js'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { PresetPicker, presetById } from './PresetPicker.jsx'
export { presetById } from './PresetPicker.jsx'
import { findHitSelection, intersectFramesWithMarquee, pickCovered, toggleSelections } from './hit.js'
export { findHitSelection, intersectFramesWithMarquee } from './hit.js'
import { hitSelections } from './erase.js'
import { DEFAULT_SIZE, TITLE_HEIGHT, layoutFrames } from './layout.js'
import { currentPageId, framesOnPage, notesOnPage } from './pages.js'
import { buildHtmlGallery, buildPdf, dataUrlBytes, downloadBytes, downloadDataUrl, downloadText, exportName, frameImage } from './export.js'
import { fileAddress, pathOfAddress } from './paths.js'
import { useFrames } from './useFrames.js'
import { splitFrames } from './validate.js'
import { scanDesignDirs } from './scan.js'
import { resolveSessionDesignPhase } from './sessionDesign.js'
import { BORDER, BRAND, BRAND_ACTIVE, CANVAS, DOCK, FG2, FLOAT, ICON_BUTTON, PILL, ROUND, SELECT, DISPLAY, tint } from './theme.js'

const nodeTypes = { frame: FrameNode, note: NoteNode }
const noop = () => {}
const TOOLS = [
  ['select', '选择 V · 点击或框选，Esc 清空'], ['hand', '抓手 H'], ['text', '文字 T'], ['eraser', '橡皮擦 E'],
  ['play', '交互 I · 直接操作方案页面'],
]
const SHORTCUTS = { v: 'select', h: 'hand', t: 'text', e: 'eraser', i: 'play' }
const TOAST_MS = 2600
const SYNC_MS = 500

export const OVERRIDE_CSS = `
.dsb-root {
  --dsb-canvas: var(--dsw-alias-bg-base, light-dark(#fff, #18181a));
  --dsb-card: var(--dsw-alias-bg-document-preview, light-dark(#f5f5f7, #1d1d1f));
  --dsb-float: var(--dsw-alias-bg-layer-2, light-dark(#fff, #2a2a2d));
  --dsb-hair: var(--dsw-alias-border-l2, light-dark(#d2d2d7, #ffffff1f));
  --dsb-ink: var(--dsw-alias-label-primary, light-dark(#0f1115, #f2f3f5));
  --dsb-muted: var(--dsw-alias-label-secondary, light-dark(#6e6e73, #a0a4ab));
  --dsb-primary: light-dark(#0071e3, #2997ff);
  --dsb-select: var(--dsb-primary);
  --dsb-primary-active: light-dark(#0066cc, #0077ed);
  --dsb-display: "SF Pro Display", "SF Pro Icons", -apple-system, "Helvetica Neue", Helvetica, Arial, "PingFang SC", sans-serif;
  background: var(--dsb-canvas); color: var(--dsb-ink);
}
.dsb-root button:focus, .dsb-root button:focus-visible { outline: none; box-shadow: none; }
.dsb-root .dsb-close-btn:hover { background: light-dark(rgba(0,0,0,.06), rgba(255,255,255,.10)); color: var(--dsb-ink); }
.dsb-dock-shell {
  background: light-dark(rgba(232, 232, 237, 0.78), rgba(40, 40, 44, 0.84));
  backdrop-filter: blur(26px) saturate(190%);
  -webkit-backdrop-filter: blur(26px) saturate(190%);
  border: 0.5px solid light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.14));
  border-radius: 980px;
  corner-shape: round;
  box-shadow:
    0 8px 28px light-dark(rgba(0, 0, 0, 0.10), rgba(0, 0, 0, 0.45)),
    0 1px 3px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.28)),
    inset 0 0.5px 0 light-dark(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.14));
}
.dsb-dock-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.dsb-dock-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 44px;
  height: 34px;
  border-radius: 980px;
  corner-shape: round;
  pointer-events: none;
  background: light-dark(#ffffff, #56565c);
  border: 0.5px solid light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.14));
  box-sizing: border-box;
  box-shadow:
    0 2px 8px light-dark(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.42)),
    0 0.5px 1.5px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.3)),
    inset 0 0.5px 0 light-dark(rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.2));
  transition: transform 260ms cubic-bezier(0.28, 0, 0.22, 1);
}
.dsb-dock-btn {
  position: relative;
  z-index: 1;
  width: 44px;
  height: 34px;
  border-radius: 980px;
  corner-shape: round;
  color: light-dark(#6e6e73, #aeaeb2);
  transition: color 180ms cubic-bezier(0.28, 0, 0.22, 1), transform 120ms cubic-bezier(0.28, 0, 0.22, 1);
}
.dsb-dock-btn:hover { color: light-dark(#1d1d1f, #ffffff); }
.dsb-dock-btn:active { transform: scale(0.93); }
.dsb-dock-btn[data-active="true"] { color: var(--dsb-primary); }
.dsb-dock-action {
  width: 34px;
  height: 34px;
  border-radius: 980px;
  corner-shape: round;
  color: light-dark(#6e6e73, #aeaeb2);
  transition: color 160ms ease, background-color 160ms ease, transform 120ms ease;
}
.dsb-dock-action:hover {
  color: light-dark(#1d1d1f, #ffffff);
  background: light-dark(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.12));
}
.dsb-dock-action:active { transform: scale(0.93); }
.dsb-dock-action[data-active="true"] {
  color: var(--dsb-primary);
  background: light-dark(#ffffff, #56565c);
  box-shadow: 0 1px 4px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.35));
}
.dsb-dock-divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: light-dark(rgba(0, 0, 0, 0.09), rgba(255, 255, 255, 0.14));
  flex: none;
}
.dsb-zoom-btn {
  color: light-dark(#6e6e73, #98989d);
  transition: color 160ms ease, background-color 160ms ease, transform 120ms ease;
}
.dsb-zoom-btn:hover {
  color: light-dark(#1d1d1f, #f5f5f7);
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.09));
}
.dsb-zoom-btn:active { transform: scale(0.94); }
.dsb-zoom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 76px;
  height: 18px;
  margin: 0 2px;
  background: transparent;
  cursor: pointer;
  outline: none;
}
.dsb-zoom-slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--dsb-primary) 0%,
    var(--dsb-primary) var(--dsb-zoom-pct, 50%),
    light-dark(rgba(0, 0, 0, 0.13), rgba(255, 255, 255, 0.2)) var(--dsb-zoom-pct, 50%),
    light-dark(rgba(0, 0, 0, 0.13), rgba(255, 255, 255, 0.2)) 100%
  );
}
.dsb-zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5.5px;
  border-radius: 50%;
  background: #ffffff;
  border: 0.5px solid light-dark(rgba(0, 0, 0, 0.14), rgba(255, 255, 255, 0.24));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22), 0 0.5px 1px rgba(0, 0, 0, 0.1);
  transition: transform 160ms cubic-bezier(0.28, 0, 0.22, 1), box-shadow 160ms ease;
}
.dsb-zoom-slider:hover::-webkit-slider-thumb {
  transform: scale(1.1);
  box-shadow: 0 1.5px 4px rgba(0, 0, 0, 0.26), 0 0.5px 1px rgba(0, 0, 0, 0.12);
}
.dsb-zoom-slider:active::-webkit-slider-thumb {
  transform: scale(1.16);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), 0 0 0 3px light-dark(rgba(0, 113, 227, 0.16), rgba(41, 151, 255, 0.24));
}
.dsb-zoom-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22), 0 0.5px 1px rgba(0, 0, 0, 0.1);
}
.dsb-root .react-flow { --xy-background-color: transparent; background: var(--dsb-card); }
.dsb-root .react-flow__viewport { will-change: transform; backface-visibility: hidden; }
.dsb-root .react-flow__node { padding: 0; border: none; background: transparent; box-shadow: none; backface-visibility: hidden; }
.dsb-root .react-flow__background-pattern { fill: light-dark(#d2d2d7, rgba(255,255,255,.14)) !important; }
.dsb-dir-page {
  container-type: inline-size;
  background: light-dark(#f5f5f7, #141416);
}
.dsb-dir-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 236px), 1fr));
  gap: 18px;
  margin-top: 20px;
}
@container (max-width: 499px) {
  .dsb-dir-grid { grid-template-columns: minmax(0, 1fr); }
}
@container (min-width: 500px) and (max-width: 819px) {
  .dsb-dir-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (min-width: 820px) and (max-width: 1179px) {
  .dsb-dir-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container (min-width: 1180px) {
  .dsb-dir-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.dsb-dir-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0;
  overflow: hidden;
  background: light-dark(#ffffff, #1f1f22);
  color: ${FLOAT.color};
  border: 0.5px solid light-dark(rgba(0, 0, 0, 0.07), rgba(255, 255, 255, 0.1));
  border-radius: 18px;
  box-shadow:
    0 1px 2px light-dark(rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.24)),
    0 6px 18px light-dark(rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.28));
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: transform 220ms cubic-bezier(0.28, 0, 0.22, 1), box-shadow 220ms cubic-bezier(0.28, 0, 0.22, 1), border-color 180ms ease;
}
.dsb-dir-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: light-dark(#fbfbfd, #26262a);
  border-bottom: 0.5px solid light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
  flex: none;
}
.dsb-dir-new-badge {
  width: 48px;
  height: 48px;
  border-radius: 980px;
  corner-shape: round;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: light-dark(#ffffff, #323236);
  color: var(--dsb-primary);
  border: 0.5px solid light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.12));
  box-shadow:
    0 2px 10px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.36)),
    0 0.5px 1.5px light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.24));
  transition: transform 220ms cubic-bezier(0.28, 0, 0.22, 1), background-color 180ms ease, color 180ms ease, box-shadow 220ms ease;
}
.dsb-dir-preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${FG2};
}
.dsb-dir-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 64px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  flex: none;
}
.dsb-dir-enter {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  font-size: 12px;
  font-weight: 500;
  color: ${FG2};
  opacity: 0.72;
  transition: color 180ms ease, opacity 180ms ease, transform 180ms cubic-bezier(0.28, 0, 0.22, 1);
}
.dsb-dir-card:hover {
  transform: translateY(-2px);
  border-color: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.18));
  box-shadow:
    0 2px 6px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.3)),
    0 14px 32px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.42));
}
.dsb-dir-card:hover .dsb-dir-new-badge {
  transform: scale(1.06);
  background: var(--dsb-primary);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 4px 14px light-dark(rgba(0, 113, 227, 0.32), rgba(41, 151, 255, 0.36));
}
.dsb-dir-card:hover .dsb-dir-enter,
.dsb-dir-card:focus-visible .dsb-dir-enter {
  color: ${BRAND};
  opacity: 1;
  transform: translateX(1px);
}
.dsb-dir-card:active {
  transform: scale(0.985);
  box-shadow: 0 1px 4px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.26));
}
.dsb-dir-card:active .dsb-dir-enter {
  color: ${BRAND_ACTIVE};
}
.dsb-dir-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px ${SELECT}, 0 6px 18px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.3));
}
`

let styleRefs = 0
function useInjectedStyle() {
  useEffect(() => {
    const css = flowCss + OVERRIDE_CSS
    let el = document.querySelector('style[data-dsb]')
    if (!el) {
      el = document.createElement('style')
      el.dataset.dsb = ''
      el.textContent = css
      document.head.appendChild(el)
    } else if (el.textContent !== css) {
      el.textContent = css
    }
    styleRefs++
    return () => { if (--styleRefs === 0) el.remove() }
  }, [])
}

const BLANK = '(blank)' // 从「开始」页打开、还没有 board.json 时的存储键
const storeKey = (boardPath) => 'dsb:annotations:' + (boardPath ?? BLANK)
const loadAnnotations = (boardPath) => {
  try {
    const list = JSON.parse(localStorage.getItem(storeKey(boardPath)) || '[]')
    return list.filter(a => a.type !== 'text' || a.note) // 没填备注的文字标注是没写完的，丢弃
  } catch { return [] }
}
// 设计体系双重持久化：以画板路径（boardPath）为主，会话（sessionId）兜底（空白画板被接管后自动迁移至 boardPath）
export const NONE = '__none__'
export const boardPresetKey = (boardPath) => 'dsb:preset:board:' + (boardPath ?? BLANK)
export const sessionPresetKey = (sessionId) => 'dsb:preset:session:' + (sessionId || 'default')

export const loadPreset = (sessionId, boardPath, manifestPresetId) => {
  if (boardPath) {
    try {
      const stored = localStorage.getItem(boardPresetKey(boardPath))
      if (stored === NONE) return null
      if (stored && presetById(stored)) return stored
    } catch { /* 忽略存储不可用 */ }
  }
  if (manifestPresetId && presetById(manifestPresetId)) return manifestPresetId
  if (sessionId) {
    try {
      const stored = localStorage.getItem(sessionPresetKey(sessionId))
      if (stored === NONE) return null
      if (stored && presetById(stored)) return stored
    } catch { /* 忽略存储不可用 */ }
  }
  return null
}

export const savePreset = (sessionId, boardPath, id) => {
  const val = id || NONE
  try {
    if (boardPath) localStorage.setItem(boardPresetKey(boardPath), val)
    else localStorage.setItem(boardPresetKey(BLANK), val)
    if (sessionId) localStorage.setItem(sessionPresetKey(sessionId), val)
  } catch { /* 存储不可用就不持久化 */ }
}
const saveAnnotations = (boardPath, list) => {
  try { localStorage.setItem(storeKey(boardPath), JSON.stringify(list)) } catch { /* 存储不可用就不持久化 */ }
}

const viewportKey = (sessionId, boardPath, pageId) => `dsb:viewport:${sessionId}:${boardPath || BLANK}:${pageId || 'default'}`

const HtmlPreview = memo(function HtmlPreview({ html, width = 1280, title }) {
  const boxRef = useRef(null)
  const [boxWidth, setBoxWidth] = useState(260)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const update = () => { if (el.clientWidth > 0) setBoxWidth(el.clientWidth) }
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const designWidth = width > 0 ? Math.max(320, width) : 1280
  const designHeight = Math.ceil(designWidth * 0.625) + 2
  const scale = boxWidth / designWidth
  return (
    <div ref={boxRef} className="dsb-dir-preview" aria-hidden="true">
      {html ? (
        <iframe
          title={title}
          srcDoc={html}
          sandbox="allow-scripts"
          scrolling="no"
          tabIndex={-1}
          style={{
            width: designWidth,
            height: designHeight,
            border: 'none',
            display: 'block',
            transformOrigin: '0 0',
            transform: `scale(${scale})`,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <span className="dsb-dir-preview-empty">暂无页面预览</span>
      )}
    </div>
  )
})

export function DirectoryPickerView({ state, open, onCreateNew }) {
  const createNew = onCreateNew || (open ? () => open(BLANK) : undefined)
  return (
    <div className="dsb-root dsb-dir-page" style={{ position: 'relative', height: '100%', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, lineHeight: '32px', letterSpacing: '-0.022em' }}>设计目录</h1>
        {state.status === 'loading' && (
          <div role="status" style={{ ...FLOAT, marginTop: 18, borderRadius: 16, boxShadow: 'none', padding: '28px 20px', color: FG2, fontSize: 13, lineHeight: '20px' }}>正在读取…</div>
        )}
        {state.status === 'error' && (
          <div role="alert" style={{ ...FLOAT, marginTop: 18, borderRadius: 16, boxShadow: 'none', padding: '28px 20px', color: FG2, fontSize: 13, lineHeight: '20px' }}>读取设计目录失败</div>
        )}
        {state.status === 'ready' && (
          <div className="dsb-dir-grid">
            {createNew && (
              <button type="button" className="dsb-dir-card" title="新建" onMouseDown={(e) => e.preventDefault()} onClick={createNew}>
                <div className="dsb-dir-preview" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="dsb-dir-new-badge">
                    <Icon name="plus" size={20} />
                  </span>
                </div>
                <span className="dsb-dir-meta">
                  <strong style={{ display: 'block', fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, lineHeight: '20px', letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>新建</strong>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, lineHeight: '18px' }}>
                    <span style={{ color: FG2, fontSize: 12, whiteSpace: 'nowrap' }}>空白画布</span>
                    <span className="dsb-dir-enter">
                      <span>进入</span>
                      <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }} aria-hidden="true"><Icon name="chevron" size={14} /></span>
                    </span>
                  </span>
                </span>
              </button>
            )}
            {state.items.map(item => (
              <button key={item.path} type="button" className="dsb-dir-card" title={item.name} onMouseDown={(e) => e.preventDefault()} onClick={() => open(`${item.path}/board.json`)}>
                <HtmlPreview html={item.preview?.html} width={item.preview?.width} title={item.name} />
                <span className="dsb-dir-meta">
                  <strong style={{ display: 'block', fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, lineHeight: '20px', letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</strong>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, lineHeight: '18px' }}>
                    <span style={{ color: FG2, fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{item.files} 个文件</span>
                    <span className="dsb-dir-enter">
                      <span>进入</span>
                      <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }} aria-hidden="true"><Icon name="chevron" size={14} /></span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DirectoryPicker({ list, readBytes, open, onSelect, onCreateNew }) {
  useInjectedStyle()
  const [state, setState] = useState({ status: 'loading', items: [] })
  useEffect(() => {
    let alive = true
    const load = () => scanDesignDirs(path => list(path), readBytes ? path => readBytes(path) : undefined)
      .then(items => alive && setState({ status: 'ready', items }), () => alive && setState({ status: 'error', items: [] }))
    load()
    const timer = setInterval(load, 2500)
    return () => { alive = false; clearInterval(timer) }
  }, [list, readBytes])
  const targetOpen = onSelect || open
  return (
    <DirectoryPickerView
      state={state}
      open={targetOpen}
      onCreateNew={onCreateNew || (targetOpen ? () => targetOpen(BLANK) : undefined)}
    />
  )
}

function ToolButton({ active, title, onClick, className = 'dsb-dock-btn', children }) {
  return (
    <button
      type="button"
      title={title}
      data-active={active ? 'true' : 'false'}
      aria-pressed={active}
      className={className}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flex: 'none',
      }}
    >{children}</button>
  )
}

function CanvasMarqueeLayer({ marquee }) {
  const { x: vx, y: vy, zoom } = useViewport()
  if (!marquee) return null
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 25, cursor: 'crosshair' }} />
      <div
        style={{
          position: 'absolute',
          left: marquee.x * zoom + vx,
          top: marquee.y * zoom + vy,
          width: marquee.w * zoom,
          height: marquee.h * zoom,
          border: `1.5px dashed ${SELECT}`,
          background: tint(SELECT, 12),
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 30,
          boxSizing: 'border-box',
        }}
      />
    </>
  )
}

function ZoomControls({ rf }) {
  const { zoom } = useViewport()
  const percent = Math.max(10, Math.min(200, Math.round(zoom * 100)))
  const progress = ((percent - 10) / 190) * 100
  const keepFocus = (e) => e.preventDefault()
  return (
    <div style={{ ...DOCK, position: 'absolute', left: 12, top: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px' }}>
      <button type="button" title="缩小 ←" className="dsb-zoom-btn" onMouseDown={keepFocus} style={{ ...ICON_BUTTON, minWidth: 26, width: 26, height: 26, padding: 0 }} onClick={() => rf.zoomOut({ duration: 120 })}><Icon name="minus" size={14} /></button>
      <input
        type="range"
        min={10}
        max={200}
        step={1}
        value={percent}
        aria-label="缩放比例"
        title={`缩放 ${percent}%`}
        className="dsb-zoom-slider"
        style={{ '--dsb-zoom-pct': `${progress}%` }}
        onChange={(e) => rf.zoomTo(Number(e.target.value) / 100, { duration: 0 })}
      />
      <button type="button" title="放大 →" className="dsb-zoom-btn" onMouseDown={keepFocus} style={{ ...ICON_BUTTON, minWidth: 26, width: 26, height: 26, padding: 0 }} onClick={() => rf.zoomIn({ duration: 120 })}><Icon name="plus" size={14} /></button>
      <button
        type="button"
        title="重置为 100%"
        className="dsb-zoom-btn"
        onMouseDown={keepFocus}
        style={{ ...ICON_BUTTON, minWidth: 42, height: 26, padding: '0 4px', fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}
        onClick={() => rf.zoomTo(1, { duration: 140 })}
      >{percent}%</button>
      <span className="dsb-dock-divider" aria-hidden="true" style={{ height: 14, margin: '0 2px' }} />
      <button type="button" title="适应窗口" className="dsb-zoom-btn" onMouseDown={keepFocus} style={{ ...ICON_BUTTON, minWidth: 26, width: 26, height: 26, padding: 0 }} onClick={() => rf.fitView({ padding: 0.12, duration: 160 })}><Icon name="fit" size={15} /></button>
    </div>
  )
}

function BoardInner({ sessionId, boardPath, isBound = true, onBack, onCommitBind, readBytes, list, watchDir, syncBoard, syncFeedback, syncPreset }) {
  useInjectedStyle()
  const rf = useReactFlow()

  const [tool, setTool] = useState('select')
  const [hover, setHover] = useState(null)
  const [selections, setSelections] = useState([])
  const selectionsRef = useRef(selections)
  selectionsRef.current = selections
  const commitBindRef = useRef(null)
  commitBindRef.current = !isBound && onCommitBind ? onCommitBind : null
  const [annotations, setAnnotations] = useState(() => loadAnnotations(boardPath))
  const [editing, setEditing] = useState(null)
  const [immersive, setImmersive] = useState(null)
  const [toast, setToast] = useState('')
  const [preset, setPreset] = useState(() => loadPreset(sessionId, boardPath, null))
  useEffect(() => { setPreset(loadPreset(sessionId, boardPath, null)) }, [sessionId, boardPath])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pageId, setPageId] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [canvasMarquee, setCanvasMarquee] = useState(null)
  const canvasDrag = useRef(null)
  const hasCanvasDragged = useRef(false)
  const viewportReadyKey = useRef('')

  const iframes = useRef(new Map())
  const [themeInfo, setThemeInfo] = useState({}) // 帧 id → { dark, supported }
  const immersiveRef = useRef(null) // 全屏 iframe
  const immersiveIdRef = useRef(null)
  const escapeRef = useRef(() => {})
  const [immersiveTheme, setImmersiveTheme] = useState(null)
  const themeChoice = useRef(new Map()) // 帧 id → 用户选的 'light' | 'dark'
  const pending = useRef(new Map())
  const seq = useRef(0)
  const probeSeq = useRef(0)
  const toastTimer = useRef()

  const showToast = useCallback((text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const onChanged = useCallback((ids) => {
    const changed = new Set(ids)
    setAnnotations(list => list.map(a => (changed.has(a.frameId) ? { ...a, stale: true } : a)))
    setSelections(list => list.filter(s => !changed.has(s.frameId)))
    setHover(null)
    showToast(`已刷新 ${ids.length} 个帧，对应标注标为过期`)
  }, [showToast])

  const state = useFrames({ boardPath, readBytes, list, watchDir, onChanged })
  // 校验：静态问题来自 useFrames，运行时报错来自帧里的探针；没通过的不上画板，只回传给 Agent
  const [runtime, setRuntime] = useState({}) // 帧 id → { url, issues }
  const { shown: frames, rejected } = useMemo(() => splitFrames(state.frames || [], runtime), [state.frames, runtime])
  const framesRef = useRef(frames)
  framesRef.current = frames
  const manifest = state.manifest ?? { title: '设计画布', frames: [], pages: [], notes: [] }

  useEffect(() => { saveAnnotations(boardPath, annotations) }, [boardPath, annotations])

  // 清单里若自带体系（如 Agent 生成的 board.json），在用户未显式修改时自动载入并记忆
  useEffect(() => {
    const filePresetId = manifest.preset?.id
    if (!filePresetId || !presetById(filePresetId)) return
    setPreset(current => {
      if (current) return current
      try {
        if (boardPath && localStorage.getItem(boardPresetKey(boardPath)) === NONE) return current
        if (sessionId && localStorage.getItem(sessionPresetKey(sessionId)) === NONE) return current
      } catch { /* 忽略存储读取异常 */ }
      savePreset(sessionId, boardPath, filePresetId)
      return filePresetId
    })
  }, [manifest.preset?.id, sessionId, boardPath])

  // 空白画板绑定具体路径后，将此前选用的体系写入该画板存储
  useEffect(() => {
    if (boardPath && preset) {
      try {
        if (!localStorage.getItem(boardPresetKey(boardPath))) {
          localStorage.setItem(boardPresetKey(boardPath), preset)
        }
      } catch { /* 忽略存储写入异常 */ }
    }
  }, [boardPath, preset])

  const frameById = useMemo(() => new Map(frames.map(f => [f.id, f])), [frames])
  useEffect(() => {
    if (!boardPath || state.status !== 'ready') return
    setAnnotations(list => (list.some(a => a.frameId && !a.stale && !frameById.has(a.frameId)) ? list.map(a => (a.frameId && !frameById.has(a.frameId) ? { ...a, stale: true } : a)) : list))
  }, [frameById]) // eslint-disable-line react-hooks/exhaustive-deps
  const sizeOf = useCallback((f) => ({ width: f.width || DEFAULT_SIZE.width, height: f.height || DEFAULT_SIZE.height }), [])

  const pages = manifest.pages || []
  const shownPage = currentPageId(pageId, pages)
  const pageFrames = useMemo(() => framesOnPage(frames, shownPage, pages), [frames, shownPage, pages])
  const pageNotes = useMemo(() => notesOnPage(manifest.notes || [], shownPage, pages), [manifest.notes, shownPage, pages])
  const pageRejected = useMemo(() => rejected.filter(f => pages.length === 0
    ? true
    : (f.page ?? pages[0]?.id) === shownPage), [rejected, pages, shownPage])
  useEffect(() => { setSelections([]); setHover(null) }, [shownPage])

  const layoutKey = pageFrames.map(f => `${f.id}:${f.width}:${f.height}`).join('|')
  const notesKey = pageNotes.map(n => `${n.id}:${n.x}:${n.y}`).join('|')
  const viewKey = `${shownPage ?? ''}|${layoutKey}|${notesKey}`
  const boxes = useMemo(() => layoutFrames(pageFrames.map(({ id, width, height }) => ({ id, width, height }))), [layoutKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const nodes = useMemo(() => [
    ...boxes.map(n => ({
      id: n.id, type: 'frame', position: { x: n.x, y: n.y + TITLE_HEIGHT }, data: {},
      width: n.width, height: n.height, draggable: false, selectable: false, focusable: false,
    })),
    ...pageNotes.map(n => ({
      id: `note:${n.id}`, type: 'note', position: { x: n.x, y: n.y }, data: { note: n },
      width: n.kind === 'title' ? 720 : 320, height: n.kind === 'title' ? 80 : 100,
      draggable: false, selectable: false, focusable: false,
    })),
  ], [boxes, pageNotes])

  useEffect(() => {
    viewportReadyKey.current = ''
    let alive = true
    const timer = setTimeout(async () => {
      try {
        let saved
        try { saved = JSON.parse(localStorage.getItem(viewportKey(sessionId, boardPath, shownPage)) || 'null') } catch { /* storage unavailable */ }
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom)) {
          await rf.setViewport(saved, { duration: 0 })
        } else if (nodes.length) {
          await rf.fitView({ padding: 0.12, duration: 0 })
        }
      } finally {
        requestAnimationFrame(() => { if (alive) viewportReadyKey.current = viewKey })
      }
    }, 80)
    return () => { alive = false; clearTimeout(timer) }
  }, [viewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveViewport = useCallback((_, viewport) => {
    if (viewportReadyKey.current !== viewKey) return
    try { localStorage.setItem(viewportKey(sessionId, boardPath, shownPage), JSON.stringify(viewport)) } catch { /* storage unavailable */ }
  }, [boardPath, sessionId, shownPage, viewKey])
  const saveViewportRef = useRef(saveViewport)
  saveViewportRef.current = saveViewport

  // 帧 iframe 发来的消息：只认已登记的 iframe（不透明源，不能比对 origin）。
  useEffect(() => {
    let framePan = null
    let wheelSaveTimer
    const onMessage = (event) => {
      const d = event.data
      if (!d || !d.dsb) return
      const fromImmersive = !!immersiveRef.current && immersiveRef.current.contentWindow === event.source
      const known = fromImmersive || [...iframes.current.entries()].find(([, el]) => el.contentWindow === event.source)
      if (!known) return
      if (d.dsb === 'key') { if (d.key === 'Escape') escapeRef.current(); return }
      if (d.dsb === 'wheel' && !fromImmersive) {
        const iframeEl = known[1]
        const canvasEl = rootRef.current?.querySelector('.react-flow')
        if (!iframeEl || !canvasEl) return
        const ir = iframeEl.getBoundingClientRect()
        const cr = canvasEl.getBoundingClientRect()
        const { x: curVx, y: curVy, zoom: curZoom } = rf.getViewport()
        if (d.ctrlKey) {
          const k = Math.min(2, Math.max(0.1, curZoom * 2 ** (-d.deltaY * (d.deltaMode === 1 ? 0.05 : 0.002) * 10)))
          const px = ir.left + d.clientX * curZoom - cr.left
          const py = ir.top + d.clientY * curZoom - cr.top
          rf.setViewport({ x: px - (px - curVx) * (k / curZoom), y: py - (py - curVy) * (k / curZoom), zoom: k })
        } else {
          rf.setViewport({ x: curVx - (d.shiftKey ? d.deltaY : d.deltaX), y: curVy - (d.shiftKey ? 0 : d.deltaY), zoom: curZoom })
        }
        clearTimeout(wheelSaveTimer)
        wheelSaveTimer = setTimeout(() => saveViewportRef.current?.(null, rf.getViewport()), 150)
        return
      }
      if (d.dsb === 'pan' && !fromImmersive) {
        if (d.phase === 'start') {
          const { x: curVx, y: curVy } = rf.getViewport()
          framePan = { sx: d.screenX, sy: d.screenY, vx: curVx, vy: curVy }
        } else if (d.phase === 'move' && framePan) {
          const { zoom: curZoom } = rf.getViewport()
          rf.setViewport({ x: framePan.vx + (d.screenX - framePan.sx), y: framePan.vy + (d.screenY - framePan.sy), zoom: curZoom })
        } else if (d.phase === 'end' && framePan) {
          framePan = null
          saveViewportRef.current?.(null, rf.getViewport())
        }
        return
      }
      if (d.dsb === 'health' || d.dsb === 'layout') {
        const frameId = fromImmersive ? immersiveIdRef.current : known[0]
        const url = framesRef.current.find(f => f.id === frameId)?.url
        if (!url) return
        const code = d.dsb === 'layout' ? 'layout-overflow' : 'runtime-error'
        const message = d.dsb === 'layout'
          ? String(d.message)
          : `页面脚本在加载时报错：${String(d.message).replace(/[.。]+$/, '')}。请修好；沙箱里访问 localStorage / sessionStorage / cookie 会抛错，要用就包 try/catch。`
        setRuntime(prev => {
          const old = prev[frameId]?.url === url ? prev[frameId].issues : []
          if (old.length >= 3 || old.some(i => i.code === code && i.message === message)) return prev
          return { ...prev, [frameId]: { url, issues: [...old, { code, message }] } }
        })
        return
      }
      if (d.dsb === 'themeinfo') {
        const frameId = fromImmersive ? immersiveIdRef.current : known[0]
        const info = { dark: d.dark, supported: d.supported }
        if (fromImmersive) setImmersiveTheme(info)
        else setThemeInfo(prev => ({ ...prev, [frameId]: info }))
        // 帧重载或刚打开全屏时页面回到默认主题：把用户选过的主题再发一次
        const choice = themeChoice.current.get(frameId)
        if (choice && d.supported && (choice === 'dark') !== d.dark) event.source.postMessage({ dsb: 'theme', mode: choice }, '*')
        return
      }
      if (d.dsb !== 'probed' && d.dsb !== 'listed' && d.dsb !== 'snapshot') return
      const resolve = pending.current.get(d.id)
      if (resolve) { pending.current.delete(d.id); resolve(d) }
    }
    window.addEventListener('message', onMessage)
    return () => {
      clearTimeout(wheelSaveTimer)
      window.removeEventListener('message', onMessage)
    }
  }, [])

  const ask = useCallback((frameId, message, timeout = 1500) => new Promise((resolve) => {
    const win = iframes.current.get(frameId)?.contentWindow
    if (!win) { resolve(null); return }
    const id = ++seq.current
    const timer = setTimeout(() => { pending.current.delete(id); resolve(null) }, timeout)
    pending.current.set(id, (reply) => { clearTimeout(timer); resolve(reply) })
    win.postMessage({ ...message, id }, '*')
  }), [])

  const toggleTheme = useCallback((frameId) => {
    const win = iframes.current.get(frameId)?.contentWindow
    const info = themeInfo[frameId]
    if (!win || !info || !info.supported) return
    const mode = info.dark ? 'light' : 'dark'
    themeChoice.current.set(frameId, mode)
    win.postMessage({ dsb: 'theme', mode }, '*')
  }, [themeInfo])

  const hoverAt = useCallback(async (frameId, x, y) => {
    const token = ++probeSeq.current
    const reply = await ask(frameId, { dsb: 'probe', x, y })
    if (token !== probeSeq.current) return
    const next = reply && reply.el ? { frameId, el: reply.el } : null
    setHover(prev => {
      if (!prev && !next) return prev
      if (prev && next && prev.frameId === next.frameId && prev.el.selector === next.el.selector
        && prev.el.rect.x === next.el.rect.x && prev.el.rect.y === next.el.rect.y
        && prev.el.rect.w === next.el.rect.w && prev.el.rect.h === next.el.rect.h) return prev
      return next
    })
  }, [ask])
  const clearHover = useCallback(() => { probeSeq.current++; setHover(prev => (prev ? null : prev)) }, [])

  const pickAt = useCallback(async (frameId, x, y, options) => {
    const single = typeof options === 'object' ? options?.single : options === false
    const list = selectionsRef.current
    const hitSelected = findHitSelection(list, frameId, { x, y })

    if (hitSelected) {
      // 点击了已选中的元素（或其标签）：执行反选（取消选中）
      const next = single
        ? (list.length === 1 && list[0].key === hitSelected.key ? [] : [hitSelected])
        : list.filter(s => s.key !== hitSelected.key)
      setSelections(next)
      return
    }

    const reply = await ask(frameId, { dsb: 'probe', x, y })
    const el = reply && reply.el
    if (!el) return
    const key = `${frameId}|${el.selector}|${Math.round(el.rect.x)},${Math.round(el.rect.y)}`
    const exists = list.some(s => s.key === key || (s.frameId === frameId && s.selector === el.selector))
    const next = single
      ? (exists && list.length === 1 ? [] : [{ key, frameId, via: 'click', ...el }])
      : (exists ? list.filter(s => s.key !== key && s.selector !== el.selector) : [...list, { key, frameId, via: 'click', ...el }])
    setSelections(next)
    if (next.length > 0 && !exists) commitBindRef.current?.()
  }, [ask])

  const pickBox = useCallback(async (frameId, box, options) => {
    const single = typeof options === 'object' ? options?.single : false
    const reply = await ask(frameId, { dsb: 'list' })
    if (!reply || !reply.els) return
    const covered = pickCovered(reply.els, box, 50)
    const list = selectionsRef.current
    if (!covered.length) {
      if (single && list.some(s => s.frameId === frameId)) {
        setSelections(list.filter(s => s.frameId !== frameId))
      }
      return
    }
    const newItems = covered.map(el => ({
      key: `${frameId}|${el.selector}|${Math.round(el.rect.x)},${Math.round(el.rect.y)}`,
      frameId,
      via: 'box',
      ...el,
    }))
    const keys = new Set(list.map(s => s.key))
    const next = single ? newItems : toggleSelections(list, newItems)
    setSelections(next)
    if (newItems.some(item => !keys.has(item.key))) commitBindRef.current?.()
  }, [ask])

  const boxOf = (frameId) => {
    const n = boxes.find(b => b.id === frameId)
    return n && { x: n.x, y: n.y + TITLE_HEIGHT, w: n.width, h: n.height }
  }

  const onCanvasPointerDownCapture = (e) => {
    if (tool !== 'select') return
    if (e.button !== 0) return
    if (pickerOpen || menuOpen || exportOpen || immersive) return
    if (e.target.closest?.('.react-flow__node') || e.target.closest?.('button, input, textarea, select, a, [role="button"], .nodrag, .nopan')) {
      return
    }
    const startFlow = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    canvasDrag.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startFlow,
      single: e.altKey,
    }
    hasCanvasDragged.current = false
  }

  const onCanvasPointerMove = (e) => {
    if (!canvasDrag.current) return
    const { clientX, clientY, startFlow } = canvasDrag.current
    const dx = e.clientX - clientX
    const dy = e.clientY - clientY
    if (!hasCanvasDragged.current && Math.hypot(dx, dy) >= 4) {
      hasCanvasDragged.current = true
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 忽略不支持 */ }
    }
    if (hasCanvasDragged.current) {
      const curFlow = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setCanvasMarquee({
        x: Math.min(startFlow.x, curFlow.x),
        y: Math.min(startFlow.y, curFlow.y),
        w: Math.abs(curFlow.x - startFlow.x),
        h: Math.abs(curFlow.y - startFlow.y),
      })
    }
  }

  const onCanvasPointerUp = async (e) => {
    if (!canvasDrag.current) return
    const { single } = canvasDrag.current
    const wasDragged = hasCanvasDragged.current
    const currentMarquee = canvasMarquee
    canvasDrag.current = null
    hasCanvasDragged.current = false
    setCanvasMarquee(null)
    if (wasDragged) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* 忽略不支持 */ }
    }

    if (wasDragged && currentMarquee && currentMarquee.w > 2 && currentMarquee.h > 2) {
      const hits = intersectFramesWithMarquee(currentMarquee, pageFrames, boxOf)
      if (!hits.length) {
        if (single) setSelections([])
        return
      }
      const list = selectionsRef.current
      const frameResults = await Promise.all(hits.map(async ({ frameId, localBox }) => {
        const reply = await ask(frameId, { dsb: 'list' })
        if (!reply || !reply.els) return []
        const covered = pickCovered(reply.els, localBox, 50)
        return covered.map(el => ({
          key: `${frameId}|${el.selector}|${Math.round(el.rect.x)},${Math.round(el.rect.y)}`,
          frameId,
          via: 'box',
          ...el,
        }))
      }))
      const newItems = frameResults.flat()
      if (!newItems.length) {
        if (single) setSelections([])
        return
      }
      const keys = new Set(list.map(s => s.key))
      const next = single ? newItems : toggleSelections(list, newItems)
      setSelections(next)
      if (newItems.some(item => !keys.has(item.key))) commitBindRef.current?.()
    }
  }

  const onCanvasPointerCancel = () => {
    canvasDrag.current = null
    hasCanvasDragged.current = false
    setCanvasMarquee(null)
  }

  // 橡皮擦也擦选中的元素（选中框是帧内坐标，按帧原点折算）
  const eraseSelectionsAt = useCallback((point, tol) => {
    setSelections(list => {
      const keys = new Set(hitSelections(list, boxOf, point, tol))
      return keys.size ? list.filter(s => !keys.has(s.key)) : list
    })
  }, [boxes]) // eslint-disable-line react-hooks/exhaustive-deps

  const addAnnotation = useCallback((shape) => {
    const cx = shape.x + (shape.w || 0) / 2
    const cy = shape.y + (shape.h || 0) / 2
    const host = boxes.find(n => cx >= n.x && cx <= n.x + n.width && cy >= n.y + TITLE_HEIGHT && cy <= n.y + TITLE_HEIGHT + n.height)
    const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    setAnnotations(list => [...list, { id, note: '', frameId: host ? host.id : null, ...shape }])
    if (shape.type === 'text') setEditing(id) // 只有文字工具要输入；矩形/画笔只是标记，意见写在输入框里
    else commitBindRef.current?.()
  }, [boxes])

  const saveNote = useCallback((id, note) => {
    const trimmed = note.trim()
    setAnnotations(list => {
      const target = list.find(a => a.id === id)
      if (target && target.type === 'text' && !trimmed) return list.filter(a => a.id !== id)
      return list.map(a => (a.id === id ? { ...a, note: trimmed } : a))
    })
    setEditing(null)
    if (trimmed) commitBindRef.current?.()
  }, [])
  const removeAnnotation = useCallback((id) => { setAnnotations(list => list.filter(a => a.id !== id)); setEditing(null) }, [])
  const moveAnnotation = useCallback((id, x, y) => {
    const host = boxes.find(n => x >= n.x && x <= n.x + n.width && y >= n.y + TITLE_HEIGHT && y <= n.y + TITLE_HEIGHT + n.height)
    setAnnotations(list => list.map(a => (a.id === id ? { ...a, x, y, frameId: host ? host.id : null } : a)))
  }, [boxes])

  const download = useCallback((frame) => {
    const url = URL.createObjectURL(new Blob([frame.html || ''], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = frame.title.replace(/[\\/:*?"<>|]/g, '-') + '.html'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const exportFrame = useCallback(async (frame, type) => {
    if (exporting) return
    if (type === 'html') {
      download(frame)
      return
    }
    setExporting(true)
    try {
      const { width, height } = sizeOf(frame)
      const dataUrl = await frameImage(ask, frame.id, width, height, { type: type === 'pdf' ? 'jpeg' : 'png', pixelRatio: 2 })
      if (type === 'png') downloadDataUrl(dataUrl, exportName(frame.title, '', 'png'))
      else downloadBytes(await buildPdf([{ jpeg: dataUrlBytes(dataUrl), width, height }]), exportName(frame.title, '', 'pdf'), 'application/pdf')
      showToast(`${type.toUpperCase()} 已导出`)
    } catch (error) {
      showToast(`导出失败：${String(error?.message || error)}`)
    } finally {
      setExporting(false)
    }
  }, [ask, download, exporting, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  const coversOf = useCallback(async (a, lists) => {
    const box = a.frameId && boxOf(a.frameId)
    if (!box) return []
    if (a.type === 'text') {
      const reply = await ask(a.frameId, { dsb: 'probe', x: a.x - box.x, y: a.y - box.y })
      return reply && reply.el ? [reply.el] : []
    }
    if (!lists.has(a.frameId)) lists.set(a.frameId, ask(a.frameId, { dsb: 'list' }))
    const reply = await lists.get(a.frameId)
    return reply ? pickCovered(reply.els, { x: a.x - box.x, y: a.y - box.y, w: a.w, h: a.h }) : []
  }, [ask, boxes]) // eslint-disable-line react-hooks/exhaustive-deps

  const collectFeedback = useCallback(async () => {
    const lists = new Map()
    const resolved = await Promise.all(annotations.map(async a => ({ ...a, covers: await coversOf(a, lists) })))
    return buildFeedback({ board: manifest.title, frames: manifest.frames, selections, annotations: resolved, rejected })
  }, [annotations, coversOf, manifest.frames, manifest.title, selections, rejected])

  const exportImages = useCallback(async (list, type, suffix) => {
    if (exporting || !list.length) return
    setExporting(true)
    try {
      if (type === 'html') {
        downloadText(buildHtmlGallery(list, manifest.title, {
          source: manifest.source || boardPath || 'design',
          version: manifest.version,
          status: manifest.status,
          preset: manifest.preset?.name,
        }), exportName(manifest.title, suffix, 'html'))
        showToast('HTML 已导出')
        return
      }
      const pagesData = []
      for (let i = 0; i < list.length; i++) {
        const frame = list[i]
        showToast(`正在导出 ${i + 1}/${list.length}…`)
        const { width, height } = sizeOf(frame)
        const dataUrl = await frameImage(ask, frame.id, width, height, { type: type === 'png' ? 'png' : 'jpeg', pixelRatio: 2 })
        if (type === 'png') downloadDataUrl(dataUrl, exportName(frame.title, '', 'png'))
        else pagesData.push({ jpeg: dataUrlBytes(dataUrl), width, height })
      }
      if (type === 'pdf') {
        const bytes = await buildPdf(pagesData)
        downloadBytes(bytes, exportName(list.length === 1 ? list[0].title : manifest.title, list.length === 1 ? '' : suffix, 'pdf'), 'application/pdf')
      }
      showToast(`${type.toUpperCase()} 已导出`)
    } catch (error) {
      showToast(`导出失败：${String(error?.message || error)}`)
    } finally {
      setExporting(false)
    }
  }, [ask, download, exporting, manifest.title, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  // 选中/标注/校验结果一变就把反馈块推给 Agent（防抖，不进输入框）；未绑定浏览态不推送，避免误污染会话上下文
  const synced = useRef(false)
  const rejectedKey = JSON.stringify(rejected)
  useEffect(() => {
    if ((!isBound && boardPath !== null) || state.status !== 'ready') return undefined
    if (!synced.current) {
      synced.current = true
      if (!selections.length && !annotations.length && !rejected.length) return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const text = await collectFeedback()
      if (!cancelled) syncFeedback(text)
    }, SYNC_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [isBound, boardPath, selections, annotations, state.status, rejectedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (boardPath) syncBoard?.(buildBoardBinding(boardPath))
    else syncBoard?.('')
  }, [isBound, boardPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentPreset = preset ? presetById(preset) : null
  const presetBlock = buildPreset(currentPreset)
  // 已记住的设计体系，开板后推给 Agent（宿主重启或换会话后也不丢）
  useEffect(() => { if (preset) syncPreset(presetBlock) }, [preset, presetBlock]) // eslint-disable-line react-hooks/exhaustive-deps

  // 选用/清除设计体系：记住选择并推给 Agent
  const choosePreset = (id) => {
    setPreset(id)
    savePreset(sessionId, boardPath, id)
    syncPreset(buildPreset(id ? presetById(id) : null))
  }

  // 备注输入框卸载后焦点会掉到 body，快捷键和 Esc 就收不到了：把焦点还给看板
  const rootRef = useRef(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing && document.activeElement === document.body) rootRef.current?.focus({ preventScroll: true })
    wasEditing.current = !!editing
  }, [editing])

  const exitOrCancel = () => {
    if (immersive) setImmersive(null)
    else if (pickerOpen) setPickerOpen(false)
    else if (exportOpen) setExportOpen(false)
    else if (menuOpen) setMenuOpen(false)
    else if (editing) setEditing(null)
    else { setTool('select'); setSelections([]) }
  }
  escapeRef.current = exitOrCancel
  immersiveIdRef.current = immersive
  useEffect(() => { setImmersiveTheme(null) }, [immersive])

  // 全屏页和画布里的同一帧一起切换，两边保持一致
  const toggleImmersiveTheme = () => {
    if (!immersiveTheme || !immersiveTheme.supported) return
    const mode = immersiveTheme.dark ? 'light' : 'dark'
    themeChoice.current.set(immersive, mode)
    immersiveRef.current?.contentWindow?.postMessage({ dsb: 'theme', mode }, '*')
    iframes.current.get(immersive)?.contentWindow?.postMessage({ dsb: 'theme', mode }, '*')
  }

  const onKeyDown = (event) => {
    const tag = event.target.tagName
    const isRangeInput = tag === 'INPUT' && event.target.type === 'range'
    if (tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable || (tag === 'INPUT' && !isRangeInput)) return
    if (event.key === 'Escape') { exitOrCancel(); return }
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (immersive || pickerOpen) return
        event.preventDefault()
        const delta = event.key === 'ArrowRight' ? 0.1 : -0.1
        const next = Math.max(0.1, Math.min(2, Math.round((rf.getZoom() + delta) * 100) / 100))
        rf.zoomTo(next, { duration: 100 })
        return
      }
      if (!isRangeInput && SHORTCUTS[event.key.toLowerCase()]) setTool(SHORTCUTS[event.key.toLowerCase()])
    }
  }

  const context = useMemo(() => ({
    frames, frameById, sizeOf, tool, hover, selections, annotations, editing, iframes, themeInfo, toggleTheme,
    hoverAt, clearHover, pickAt, pickBox, setImmersive, download, exportFrame, eraseSelectionsAt, addAnnotation, saveNote, removeAnnotation, moveAnnotation, setEditing,
  }), [
    frames, frameById, sizeOf, tool, hover, selections, annotations, editing, themeInfo, toggleTheme,
    hoverAt, clearHover, pickAt, pickBox, download, exportFrame, eraseSelectionsAt, addAnnotation, saveNote, removeAnnotation, moveAnnotation,
  ])

  if (state.status !== 'ready') return <div style={{ padding: 16, color: FG2 }}>加载中…</div>

  const pageName = pages.find(p => p.id === shownPage)?.name ?? ''
  const immersiveFrame = immersive && frameById.get(immersive)

  return (
    <BoardContext.Provider value={context}>
      <div
        ref={rootRef} className="dsb-root" tabIndex={-1} onKeyDown={onKeyDown}
        onPointerDown={(e) => { if (!['TEXTAREA', 'INPUT'].includes(e.target.tagName)) e.currentTarget.focus({ preventScroll: true }) }}
        style={{ position: 'relative', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', outline: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 13, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>
          {!isBound && onBack && (
            <button type="button" title="返回设计目录" aria-label="返回设计目录" style={{ ...ICON_BUTTON, flex: 'none' }} onClick={onBack}>
              <Icon name="back" size={16} />
            </button>
          )}
          <strong style={{ flex: '1 1 0', minWidth: 0, fontFamily: DISPLAY, fontWeight: 600, fontSize: 19, letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis' }} title={manifest.title}>{manifest.title}</strong>
          {(pageFrames.length > 0 || pageRejected.length > 0) && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <button
                type="button" title="导出当前页" disabled={exporting} onClick={() => setExportOpen(o => !o)}
                style={{ ...ICON_BUTTON, height: 32, padding: '0 12px', gap: 6, border: `1px solid ${exportOpen ? SELECT : BORDER}`, background: exportOpen ? tint(SELECT, 8) : 'transparent', color: exportOpen ? BRAND_ACTIVE : 'inherit', opacity: exporting ? 0.5 : 1 }}
              ><Icon name="download" size={15} />导出</button>
              {exportOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onPointerDown={() => setExportOpen(false)} />
                  <div style={{ ...FLOAT, position: 'absolute', right: 0, top: 38, zIndex: 20, boxSizing: 'border-box', width: 260, maxWidth: 'calc(100vw - 24px)', padding: 6 }}>
                    <div style={{ fontSize: 12, color: FG2, padding: '4px 8px' }}>当前页 · {pageFrames.length} 个方案</div>
                    {['html', 'png', 'pdf'].map(type => (
                      <button key={type} type="button" disabled={!pageFrames.length} style={{ ...ICON_BUTTON, display: 'flex', boxSizing: 'border-box', width: '100%', minHeight: 36, height: 'auto', padding: '8px', justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.35, opacity: pageFrames.length ? 1 : 0.45 }}
                        onClick={() => { setExportOpen(false); if (pageFrames.length) exportImages(pageFrames, type, pageName) }}>{type.toUpperCase()}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            type="button" title={currentPreset ? `设计体系：${currentPreset.name}` : '选择设计体系'} onClick={() => setPickerOpen(o => !o)}
            style={{ ...ICON_BUTTON, flex: '0 1 auto', minWidth: 28, height: 32, padding: '0 14px', gap: 6, border: `1px solid ${pickerOpen ? SELECT : BORDER}`, background: pickerOpen ? tint(SELECT, 8) : 'transparent', color: pickerOpen ? BRAND_ACTIVE : 'inherit', maxWidth: 180 }}
          >
            <Icon name="palette" size={15} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentPreset ? currentPreset.name : '设计体系'}</span>
          </button>
        </div>

        {pages.length > 1 && (
          <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {pages.map(p => (
              <button
                key={p.id} type="button" onClick={() => setPageId(p.id)}
                style={{ ...ICON_BUTTON, flex: 'none', height: 30, padding: '0 14px', borderRadius: PILL, cornerShape: ROUND, background: p.id === shownPage ? BRAND : 'transparent', color: p.id === shownPage ? '#fff' : 'inherit', fontWeight: p.id === shownPage ? 600 : 400 }}
              >{p.name}</button>
            ))}
          </div>
        )}

        <div
          style={{ position: 'relative', flex: 1, minHeight: 0, cursor: tool === 'hand' || tool === 'play' ? 'grab' : undefined }}
          onPointerDownCapture={onCanvasPointerDownCapture}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerCancel}
        >
          {pickerOpen && <ErrorBoundary fallback={null}><PresetPicker value={preset} onChange={choosePreset} onClose={() => setPickerOpen(false)} /></ErrorBoundary>}
          <ReactFlow
            nodes={nodes} edges={[]} nodeTypes={nodeTypes}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} selectNodesOnDrag={false} onMoveEnd={saveViewport}
            // 不可拖/不可选的节点默认 pointer-events:none，帧上的选取覆盖层会收不到鼠标；挂个空回调让它恢复
            onNodeClick={noop}
            panOnDrag={tool === 'hand' || tool === 'play' ? true : [1, 2]} panOnScroll zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false}
            minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1.5} />
          </ReactFlow>
          <ErrorBoundary fallback={null}><AnnotationLayer /></ErrorBoundary>

          <CanvasMarqueeLayer marquee={canvasMarquee} />

          {toast && <div style={{ ...FLOAT, position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', padding: '6px 14px', fontSize: 13, zIndex: 12 }}>{toast}</div>}

          <ZoomControls rf={rf} />

          <div className="dsb-dock-shell" style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', padding: 4 }}>
            <div className="dsb-dock-track" role="toolbar" aria-label="画布工具">
              <span
                className="dsb-dock-thumb"
                aria-hidden="true"
                style={{ transform: `translateX(${Math.max(0, TOOLS.findIndex(([name]) => name === tool)) * 46}px)` }}
              />
              {TOOLS.map(([name, title]) => (
                <ToolButton key={name} active={tool === name} title={title} onClick={() => setTool(name)}><Icon name={name} /></ToolButton>
              ))}
            </div>
            {pageFrames.length > 0 && (
              <>
                <span className="dsb-dock-divider" aria-hidden="true" />
                <ToolButton active={menuOpen} title="方案列表" className="dsb-dock-action" onClick={() => setMenuOpen(o => !o)}><Icon name="chevron" size={14} /></ToolButton>
              </>
            )}
          </div>
          {menuOpen && (
            <>
              <div style={{ position: 'absolute', inset: 0, zIndex: 9 }} onPointerDown={() => setMenuOpen(false)} />
              <div style={{ ...FLOAT, position: 'absolute', left: '50%', bottom: 78, transform: 'translateX(-50%)', zIndex: 11, padding: 6, minWidth: 220, maxWidth: 'calc(100% - 24px)' }}>
                <div style={{ fontSize: 12, color: FG2, padding: '4px 8px' }}>方案</div>
                {pageFrames.map((f, i) => (
                  <button
                    key={f.id} type="button" title={f.title}
                    onClick={() => { rf.fitView({ nodes: [{ id: f.id }], padding: 0.12, duration: 200 }); setMenuOpen(false) }}
                    style={{ ...ICON_BUTTON, width: '100%', justifyContent: 'flex-start', gap: 8, padding: '0 8px', height: 32, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    <span style={{ color: FG2, flex: 'none' }}>{i + 1}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {immersiveFrame && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', background: CANVAS }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 13, borderBottom: `1px solid ${BORDER}` }}>
              <button type="button" style={ICON_BUTTON} onClick={() => setImmersive(null)}><Icon name="back" size={16} />返回画布</button>
              <strong style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17, letterSpacing: '-0.015em' }}>{immersiveFrame.title}</strong>
              <div style={{ position: 'relative' }}>
                <button type="button" title="下载" style={ICON_BUTTON} onClick={() => setExportOpen(o => !o)}><Icon name="download" size={18} /></button>
                {exportOpen && (
                  <div style={{ ...FLOAT, position: 'absolute', right: 0, top: 32, zIndex: 21, width: 120, padding: 6 }}>
                    {['html', 'png', 'pdf'].map(type => (
                      <button key={type} type="button" style={{ ...ICON_BUTTON, display: 'flex', width: '100%', justifyContent: 'flex-start', padding: '0 8px', height: 32 }} onClick={() => { setExportOpen(false); exportFrame(immersiveFrame, type) }}>{type.toUpperCase()}</button>
                    ))}
                  </div>
                )}
              </div>
              <span style={{ marginLeft: 'auto' }} />
              <button
                type="button" disabled={!immersiveTheme?.supported} onClick={toggleImmersiveTheme}
                title={!immersiveTheme ? '正在检测页面主题…' : immersiveTheme.supported ? (immersiveTheme.dark ? '切换到浅色' : '切换到深色') : '这个页面没做深浅两套主题：让 Agent 补上'}
                style={{ ...ICON_BUTTON, opacity: immersiveTheme?.supported ? 1 : 0.35, cursor: immersiveTheme?.supported ? 'pointer' : 'default' }}
              ><Icon name={immersiveTheme?.dark ? 'sun' : 'moon'} size={18} /></button>
              <button type="button" title="退出全屏 (Esc)" style={ICON_BUTTON} onClick={() => setImmersive(null)}><Icon name="collapse" size={18} /></button>
            </div>
            <iframe ref={immersiveRef} name="dsb-immersive" src={immersiveFrame.url} sandbox="allow-scripts" title={immersiveFrame.title} style={{ flex: 1, minHeight: 0, width: '100%', border: 'none', background: '#fff' }} />
          </div>
        )}
      </div>
    </BoardContext.Provider>
  )
}

/** 右侧栏正文：未绑定会话先浏览目录卡片，返回或关标签均可重选；Agent 交付或已有对话会话的画布实质交互后正式绑定，新会话不执行锁定。 */
export function Board(props) {
  const { tab } = props.useTabInfo()
  const sessionSnap = props.useSession ? props.useSession(s => s) : undefined
  const summaryBlank = props.useSessions ? props.useSessions(s => (props.sessionId ? s.byId?.[props.sessionId]?.blank : undefined)) : undefined
  const phase = resolveSessionDesignPhase({
    session: sessionSnap,
    summaryBlank,
    fallbackBlank: Boolean(props.isBlankSession?.()),
  })
  const requestedPath = (tab.contentId && pathOfAddress(tab.contentId)) || null
  const [boundPath, setBoundPath] = useState(() => props.getDesignPath?.() || null)
  const [browsingPath, setBrowsingPath] = useState(null)
  useEffect(() => {
    setBoundPath(props.getDesignPath?.() || null)
    return props.subscribeDesign?.(() => setBoundPath(props.getDesignPath?.() || null))
  }, [props.getDesignPath, props.subscribeDesign, props.sessionId])
  useEffect(() => {
    if (phase === 'blank' && (boundPath || props.getDesignPath?.())) {
      props.clearDesign?.()
      setBoundPath(null)
    }
  }, [phase, boundPath, props.clearDesign, props.getDesignPath, props.sessionId])
  useEffect(() => { setBrowsingPath(null) }, [props.sessionId])
  const effectiveBoundPath = phase === 'blank' ? null : boundPath
  const open = useCallback((path) => tab.actions.openResource(fileAddress(props.sessionId, path), { replaceTab: true }), [tab.actions, props.sessionId])
  useEffect(() => {
    if (effectiveBoundPath && requestedPath && requestedPath !== effectiveBoundPath) open(effectiveBoundPath)
  }, [effectiveBoundPath, requestedPath, open])
  const activePath = effectiveBoundPath || browsingPath || requestedPath
  const boardPath = activePath === BLANK ? null : activePath
  const isBound = Boolean(effectiveBoundPath)
  const canBind = phase === 'active' && !isBound && Boolean(boardPath)
  const boundRef = useRef(isBound)
  boundRef.current = isBound
  useEffect(() => {
    if (!effectiveBoundPath && activePath === null) {
      props.syncBoard?.('')
      props.syncFeedback?.('')
    }
  }, [effectiveBoundPath, activePath, props.syncBoard, props.syncFeedback])
  useEffect(() => () => {
    if (!boundRef.current) {
      props.syncBoard?.('')
      props.syncFeedback?.('')
    }
  }, [props.syncBoard, props.syncFeedback])
  const commitBind = useCallback(() => {
    if (!boardPath || phase !== 'active') return false
    if (props.bindDesign?.(boardPath) === false) return false
    const next = props.getDesignPath?.() || boardPath
    setBoundPath(next)
    if (requestedPath && requestedPath !== next) open(next)
    return true
  }, [boardPath, phase, props.bindDesign, props.getDesignPath, requestedPath, open])
  const backToDirs = useCallback(() => {
    setBrowsingPath(null)
    if (requestedPath) tab.actions.openTab?.('design-board', { replaceTab: true })
  }, [requestedPath, tab.actions])
  if (activePath === null) {
    return (
      <ErrorBoundary>
        <DirectoryPicker
          sessionId={props.sessionId}
          syncPreset={props.syncPreset}
          list={props.list}
          readBytes={props.readBytes}
          open={setBrowsingPath}
          onSelect={setBrowsingPath}
          onCreateNew={() => setBrowsingPath(BLANK)}
        />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <BoardInner
          key={`${props.sessionId ?? ''}:${boardPath ?? BLANK}`}
          sessionId={props.sessionId}
          boardPath={boardPath}
          isBound={isBound}
          onBack={isBound ? undefined : backToDirs}
          onCommitBind={canBind ? commitBind : undefined}
          readBytes={props.readBytes}
          list={props.list}
          watchDir={props.watchDir}
          syncBoard={props.syncBoard}
          syncFeedback={props.syncFeedback}
          syncPreset={props.syncPreset}
        />
      </ReactFlowProvider>
    </ErrorBoundary>
  )
}
