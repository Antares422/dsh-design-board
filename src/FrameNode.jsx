import { memo, useCallback, useRef, useState } from 'react'
import { useBoard } from './context.js'
import { Icon } from './icons.jsx'
import { BORDER, FG2, FLOAT, ICON_BUTTON, SELECT, DISPLAY, tint } from './theme.js'
import { TITLE_HEIGHT } from './layout.js'

const box = (rect, extra) => ({
  position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
  pointerEvents: 'none', boxSizing: 'border-box', ...extra,
})

export const FrameNode = memo(function FrameNode({ id }) {
  const b = useBoard()
  const overlay = useRef(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [marquee, setMarquee] = useState(null)
  const dragStart = useRef(null)
  const hasDragged = useRef(false)
  const justDragged = useRef(false)
  const setIframeRef = useCallback((el) => {
    if (el) b.iframes.current.set(id, el)
    else b.iframes.current.delete(id)
  }, [b.iframes, id])
  const frame = b.frameById.get(id)
  if (!frame) return null

  const { width, height } = b.sizeOf(frame)
  const selecting = b.tool === 'select'
  const playing = b.tool === 'play' // 交互模式：帧里的页面可以点、可以滚
  const hover = selecting && b.hover && b.hover.frameId === id ? b.hover.el : null
  const selected = b.selections.filter(s => s.frameId === id)
  const theme = b.themeInfo[id]

  /** 鼠标位置 → 帧内坐标（画布缩放后按框的实际大小折算，限定在帧尺寸内）。 */
  const localPoint = (event) => {
    const el = overlay.current
    if (!el) return [0, 0]
    const r = el.getBoundingClientRect()
    const x = Math.min(width, Math.max(0, (event.clientX - r.left) * (width / r.width)))
    const y = Math.min(height, Math.max(0, (event.clientY - r.top) * (height / r.height)))
    return [x, y]
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const [x, y] = localPoint(e)
    dragStart.current = { clientX: e.clientX, clientY: e.clientY, x, y, single: e.altKey }
    hasDragged.current = false
  }

  const onPointerMove = (e) => {
    if (!dragStart.current) {
      b.hoverAt(id, ...localPoint(e))
      return
    }
    const start = dragStart.current
    const dx = e.clientX - start.clientX
    const dy = e.clientY - start.clientY
    if (!hasDragged.current && Math.hypot(dx, dy) >= 4) {
      hasDragged.current = true
      b.clearHover()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 忽略不支持 */ }
    }
    if (hasDragged.current) {
      const [curX, curY] = localPoint(e)
      setMarquee({
        x: Math.min(start.x, curX),
        y: Math.min(start.y, curY),
        w: Math.abs(curX - start.x),
        h: Math.abs(curY - start.y),
      })
    }
  }

  const onPointerUp = (e) => {
    if (!dragStart.current) return
    const start = dragStart.current
    const wasDragged = hasDragged.current
    const currentMarquee = marquee
    dragStart.current = null
    hasDragged.current = false
    setMarquee(null)
    if (wasDragged) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* 忽略不支持 */ }
      if (currentMarquee) {
        justDragged.current = true
        b.pickBox?.(id, currentMarquee, { single: start.single })
      }
    }
  }

  const onPointerCancel = () => {
    dragStart.current = null
    hasDragged.current = false
    setMarquee(null)
  }

  const onClick = (e) => {
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    b.pickAt(id, ...localPoint(e), { single: e.altKey })
  }

  return (
    <div style={{ width, height, position: 'relative' }}>
      <div className="nodrag nopan" style={{
        position: 'absolute', left: 0, top: -TITLE_HEIGHT, width: '100%', height: TITLE_HEIGHT,
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '-0.015em', color: FG2,
      }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{frame.title}</span>
        <button
          type="button" disabled={!theme?.supported} onClick={() => b.toggleTheme(id)}
          title={!theme ? '正在检测页面主题…' : theme.supported ? (theme.dark ? '切换到浅色' : '切换到深色') : '这个页面没做深浅两套主题：让 Agent 补上'}
          style={{ ...ICON_BUTTON, opacity: theme?.supported ? 1 : 0.35, cursor: theme?.supported ? 'pointer' : 'default' }}
        ><Icon name={theme?.dark ? 'sun' : 'moon'} size={22} /></button>
        <button type="button" title="单独查看" style={ICON_BUTTON} onClick={() => b.setImmersive(id)}><Icon name="expand" size={22} /></button>
        <div style={{ position: 'relative' }}>
          <button type="button" title="下载" style={ICON_BUTTON} onClick={() => setExportOpen(o => !o)}><Icon name="download" size={22} /></button>
          {exportOpen && (
            <div className="nodrag nopan" style={{ ...FLOAT, position: 'absolute', right: 0, top: 32, zIndex: 20, width: 120, padding: 6 }}>
              {['html', 'png', 'pdf'].map(type => (
                <button key={type} type="button" style={{ ...ICON_BUTTON, display: 'flex', width: '100%', justifyContent: 'flex-start', padding: '0 8px', height: 32, borderBottom: type === 'pdf' ? 'none' : `1px solid ${BORDER}` }} onClick={() => { setExportOpen(false); b.exportFrame(frame, type) }}>{type.toUpperCase()}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{
        position: 'relative', width, height, background: theme?.dark ? '#1d1d1f' : '#fff', borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,.18), 0 0 0 1px rgba(128,128,128,.25)',
        backfaceVisibility: 'hidden', transform: 'translateZ(0)',
      }}>
        {frame.url && (
          <iframe
            key={frame.url}
            ref={setIframeRef}
            src={frame.url} sandbox="allow-scripts" title={frame.title}
            style={{
              width, height, border: 'none', borderRadius: 8,
              pointerEvents: playing ? 'auto' : 'none', display: 'block',
              backfaceVisibility: 'hidden', transform: 'translateZ(0)',
            }}
          />
        )}
        {frame.error && !frame.url && (
          <div style={{ padding: 16, color: FG2, fontSize: 14 }} title={frame.error}>
            生成中…
            <div style={{ fontSize: 12, marginTop: 4 }}>等待 {frame.file} 写出</div>
          </div>
        )}

        {hover && !marquee && <div style={box(hover.rect, { border: `1.5px solid ${SELECT}`, background: tint(SELECT, 8) })} />}
        {selected.map(s => (
          <div key={s.key} style={box(s.rect, { border: `2px solid ${SELECT}`, background: tint(SELECT, 14) })}>
            <span style={{
              position: 'absolute', left: -2, top: -20, padding: '0 5px', fontSize: 11, lineHeight: '18px',
              background: SELECT, color: '#fff', borderRadius: 3, whiteSpace: 'nowrap',
            }}>{s.tag}</span>
          </div>
        ))}
        {marquee && (
          <div style={box(marquee, {
            border: `1.5px dashed ${SELECT}`,
            background: tint(SELECT, 12),
            borderRadius: 3,
            zIndex: 10,
          })} />
        )}

        {selecting && (
          <div
            ref={overlay}
            style={{ position: 'absolute', inset: 0, cursor: 'default' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onMouseLeave={() => { b.clearHover(); if (!dragStart.current) setMarquee(null) }}
            onClick={onClick}
            onDoubleClick={() => b.setImmersive(id)}
          />
        )}
      </div>
    </div>
  )
})
