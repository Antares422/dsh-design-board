import { useEffect, useRef, useState } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useBoard } from './context.js'
import { hitAnnotations } from './erase.js'
import { Icon } from './icons.jsx'
import { BORDER, BRAND, BRAND_ACTIVE, CANVAS, DOCK, FG2, FLOAT, INK, PILL, ROUND, tint } from './theme.js'

const ERASE_MIN = 8 // 屏幕像素：橡皮擦半径范围
const ERASE_MAX = 120
const ERASE_DEFAULT = 28
const ERASE_KEY = 'dsb:eraser-radius'

const NOTE_MAX_WIDTH = 360
const NOTE_PADDING = '5px 8px'
const NOTE_RADIUS = 8
const NOTE_FONT_SIZE = 13
const NOTE_LINE_HEIGHT = 1.5

const loadEraseRadius = () => {
  try {
    const n = Number(localStorage.getItem(ERASE_KEY))
    if (Number.isFinite(n) && n >= ERASE_MIN && n <= ERASE_MAX) return n
  } catch { /* 忽略存储读取异常 */ }
  return ERASE_DEFAULT
}

const anchorOf = (a) => (a.type === 'pen' ? a.points[0] : { x: a.x, y: a.y })

function NoteEditor({ annotation, onSave, onDelete, onClose, onMove, anchorScreen, scale, zoom }) {
  const [value, setValue] = useState(annotation.note || '')
  const dragRef = useRef(null)
  const handleSave = () => {
    const trimmed = value.trim()
    if (!trimmed) onDelete()
    else onSave(trimmed)
  }

  const s = scale || 1
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800

  const placeLeft = Math.min(winW - 40, Math.max(8, anchorScreen.x))
  const placeTop = Math.min(winH - 40, Math.max(8, anchorScreen.y))

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 10, cursor: 'default' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          handleSave()
        }}
      />

      <div
        onPointerDown={(e) => {
          e.stopPropagation()
          if (e.button !== 0 || e.target.tagName === 'TEXTAREA') return
          e.currentTarget.setPointerCapture(e.pointerId)
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: annotation.x, origY: annotation.y }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current
          if (!d) return
          e.stopPropagation()
          onMove?.(d.origX + (e.clientX - d.startX) / (zoom || 1), d.origY + (e.clientY - d.startY) / (zoom || 1))
        }}
        onPointerUp={() => { dragRef.current = null }}
        onPointerCancel={() => { dragRef.current = null }}
        style={{
          ...FLOAT,
          position: 'absolute',
          left: placeLeft,
          top: placeTop,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          minWidth: 28,
          maxWidth: NOTE_MAX_WIDTH,
          borderRadius: NOTE_RADIUS,
          padding: NOTE_PADDING,
          fontSize: NOTE_FONT_SIZE,
          lineHeight: NOTE_LINE_HEIGHT,
          boxSizing: 'border-box',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          zIndex: 11,
          cursor: 'grab',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            visibility: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            font: 'inherit',
            fontSize: NOTE_FONT_SIZE,
            lineHeight: NOTE_LINE_HEIGHT,
            minHeight: 20,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {value ? (value.endsWith('\n') ? `${value} ` : value) : '字'}
        </div>

        <textarea
          autoFocus
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSave()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              if (!annotation.note) onDelete()
              else onClose()
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            font: 'inherit',
            fontSize: NOTE_FONT_SIZE,
            lineHeight: NOTE_LINE_HEIGHT,
            color: INK,
            background: 'transparent',
            border: 'none',
            borderRadius: NOTE_RADIUS,
            padding: NOTE_PADDING,
            margin: 0,
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            cursor: 'text',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />
      </div>
    </>
  )
}

/** 屏幕坐标系的标注层：形状按画布缩放变换，气泡和编辑框随缩放等比缩放（有上下限）。 */
export function AnnotationLayer() {
  const b = useBoard()
  const rf = useReactFlow()
  const { x: vx, y: vy, zoom } = useViewport()
  const [sweeping, setSweeping] = useState(false)
  const [hoveredNote, setHoveredNote] = useState(null)
  const [eraseRadius, setEraseRadius] = useState(loadEraseRadius)
  const [eraserPos, setEraserPos] = useState(null) // 橡皮擦圆圈位置（相对标注层的屏幕坐标）
  const changeEraseRadius = (value) => {
    const r = Math.min(ERASE_MAX, Math.max(ERASE_MIN, Number(value) || ERASE_DEFAULT))
    setEraseRadius(r)
    try { localStorage.setItem(ERASE_KEY, String(r)) } catch { /* 忽略存储写入异常 */ }
  }
  // 批注卡片和输入框保持舒适的阅读尺寸，缩小时不变成不可读的微型字
  const cardScale = Math.min(1.15, Math.max(0.9, Math.sqrt(zoom)))
  const noteDrag = useRef(null)
  const erasing = b.tool === 'eraser'
  const drawing = b.tool === 'text' || erasing

  // 按下后指针捕获会让拖动越出画布，坐标夹在画布范围内，标注不会画到顶栏上
  const toFlow = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return rf.screenToFlowPosition({ x: Math.min(r.right, Math.max(r.left, e.clientX)), y: Math.min(r.bottom, Math.max(r.top, e.clientY)) })
  }
  const toScreen = (p) => ({ x: p.x * zoom + vx, y: p.y * zoom + vy })

  // 橡皮擦：按下或拖过时擦掉命中的标注
  const erase = (e) => {
    const point = toFlow(e)
    for (const id of hitAnnotations(b.annotations, point, eraseRadius / zoom)) b.removeAnnotation(id)
    b.eraseSelectionsAt(point, eraseRadius / zoom)
  }

  // 标注层盖在画布上，滚轮和中/右键落不到画布：自己按 xyflow 的手感处理（ctrl+滚轮缩放，滚轮平移，中/右键拖动平移）
  const panning = useRef(null)
  const onWheel = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey) {
      const k = Math.min(2, Math.max(0.1, zoom * 2 ** (-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002) * 10)))
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      rf.setViewport({ x: px - (px - vx) * (k / zoom), y: py - (py - vy) * (k / zoom), zoom: k })
    } else {
      rf.setViewport({ x: vx - (e.shiftKey ? e.deltaY : e.deltaX), y: vy - (e.shiftKey ? 0 : e.deltaY), zoom })
    }
  }

  const onDown = (e) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      panning.current = { x: e.clientX, y: e.clientY, vx, vy }
      return
    }
    if (e.button !== 0) return
    if (erasing) {
      e.currentTarget.setPointerCapture(e.pointerId)
      setSweeping(true)
      erase(e)
    }
  }
  // 文字标注在 click 时创建：pointerdown 就建的话，随后的 mousedown 默认行为会抢走输入框焦点
  const onClick = (e) => {
    if (b.tool !== 'text' || e.target !== e.currentTarget) return
    const p = toFlow(e)
    b.addAnnotation({ type: 'text', x: p.x, y: p.y })
  }
  const onMove = (e) => {
    if (panning.current) {
      const p = panning.current
      rf.setViewport({ x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y, zoom })
      return
    }
    if (erasing) {
      const r = e.currentTarget.getBoundingClientRect()
      setEraserPos({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    if (sweeping) erase(e)
  }
  const onCancel = () => { setSweeping(false); panning.current = null }
  const onUp = () => {
    if (panning.current) { panning.current = null; return }
    if (sweeping) setSweeping(false)
  }

  const shape = (a, key) => {
    const style = { fill: 'none', stroke: BRAND_ACTIVE, strokeWidth: 2.5, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round', strokeLinecap: 'round', opacity: a.stale ? 0.4 : 1, strokeDasharray: a.stale ? '6 4' : undefined }
    if (a.type === 'rect') return <rect key={key} x={a.x} y={a.y} width={a.w} height={a.h} rx={4} {...style} fill={tint(BRAND, 10)} />
    if (a.type === 'pen') return <polyline key={key} points={a.points.map(p => `${p.x},${p.y}`).join(' ')} {...style} />
    return null
  }

  const editing = b.annotations.find(a => a.id === b.editing)

  return (
    <div
      onPointerDown={drawing ? onDown : undefined} onWheel={drawing ? onWheel : undefined} onContextMenu={drawing ? (e) => e.preventDefault() : undefined} onClick={onClick} onPointerMove={drawing ? onMove : undefined} onPointerUp={drawing ? onUp : undefined} onPointerCancel={onCancel} onLostPointerCapture={onCancel} onPointerLeave={() => setEraserPos(null)}
      style={{ position: 'absolute', inset: 0, zIndex: 6, overflow: 'hidden', pointerEvents: drawing ? 'auto' : 'none', cursor: b.tool === 'text' ? 'text' : erasing ? 'none' : 'default', touchAction: 'none' }}
    >
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <g transform={`translate(${vx} ${vy}) scale(${zoom})`}>
          {b.annotations.map(a => shape(a, a.id))}
        </g>
      </svg>

      {erasing && eraserPos && (
        <div style={{
          position: 'absolute', left: eraserPos.x - eraseRadius, top: eraserPos.y - eraseRadius, width: eraseRadius * 2, height: eraseRadius * 2,
          borderRadius: '50%', cornerShape: ROUND, boxSizing: 'border-box', pointerEvents: 'none',
          border: '1px solid light-dark(rgba(0, 113, 227, 0.55), rgba(41, 151, 255, 0.65))',
          background: sweeping
            ? 'light-dark(rgba(0, 113, 227, 0.14), rgba(41, 151, 255, 0.2))'
            : 'light-dark(rgba(0, 113, 227, 0.06), rgba(41, 151, 255, 0.1))',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          boxShadow: '0 2px 10px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.3))',
        }} />
      )}

      {erasing && (
        <div
          onPointerDown={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
          style={{ ...DOCK, position: 'absolute', left: '50%', bottom: 70, transform: 'translateX(-50%)', zIndex: 3, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', fontSize: 12, cursor: 'default', pointerEvents: 'auto' }}
        >
          <input
            type="range"
            min={ERASE_MIN}
            max={ERASE_MAX}
            value={eraseRadius}
            aria-label="橡皮擦大小"
            className="dsb-zoom-slider"
            style={{ width: 120, '--dsb-zoom-pct': `${((eraseRadius - ERASE_MIN) / (ERASE_MAX - ERASE_MIN)) * 100}%` }}
            onChange={(e) => changeEraseRadius(e.target.value)}
          />
          <span style={{ minWidth: 34, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: FG2 }}>{eraseRadius * 2}px</span>
        </div>
      )}

      {b.annotations.filter(a => a.type === 'text' && a.note && a.id !== b.editing).map(a => {
        const s = toScreen(anchorOf(a))
        return (
          <div
            key={a.id}
            onMouseEnter={() => setHoveredNote(a.id)}
            onMouseLeave={() => setHoveredNote(null)}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (e.button !== 0 || e.target.closest('button')) return
              e.currentTarget.setPointerCapture(e.pointerId)
              noteDrag.current = { id: a.id, startX: e.clientX, startY: e.clientY, origX: a.x, origY: a.y, moved: false }
            }}
            onPointerMove={(e) => {
              const d = noteDrag.current
              if (!d || d.id !== a.id) return
              e.stopPropagation()
              const dx = e.clientX - d.startX
              const dy = e.clientY - d.startY
              if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true
              if (d.moved) b.moveAnnotation(a.id, d.origX + dx / zoom, d.origY + dy / zoom)
            }}
            onPointerUp={(e) => {
              const d = noteDrag.current
              if (!d || d.id !== a.id) return
              e.stopPropagation()
              noteDrag.current = null
              if (!d.moved) b.setEditing(a.id)
            }}
            onPointerCancel={() => { noteDrag.current = null }}
            title={a.stale ? '该帧已更新，这条标注可能已过期' : undefined}
            style={{
              ...FLOAT,
              position: 'absolute',
              left: s.x,
              top: s.y,
              transform: `scale(${cardScale})`,
              transformOrigin: '0 0',
              pointerEvents: erasing ? 'none' : 'auto',
              minWidth: 28,
              maxWidth: NOTE_MAX_WIDTH,
              padding: NOTE_PADDING,
              borderRadius: NOTE_RADIUS,
              fontSize: NOTE_FONT_SIZE,
              lineHeight: NOTE_LINE_HEIGHT,
              boxSizing: 'border-box',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: 'grab',
              userSelect: 'none',
              opacity: a.stale ? 0.6 : 1,
              zIndex: 2,
            }}
          >
            <div style={{ color: INK, minHeight: 20 }}>{a.note}</div>
            {hoveredNote === a.id && (
              <button
                type="button"
                title="删除"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  b.removeAnnotation(a.id)
                }}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 16,
                  height: 16,
                  minWidth: 16,
                  minHeight: 16,
                  maxWidth: 16,
                  maxHeight: 16,
                  padding: 0,
                  margin: 0,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  background: 'var(--dsb-float)',
                  border: `1px solid ${BORDER}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  color: FG2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3,
                  outline: 'none',
                }}
              >
                <Icon name="close" size={10} />
              </button>
            )}
          </div>
        )
      })}

      {editing && (() => {
        const s = toScreen(anchorOf(editing))
        return (
          <NoteEditor
            key={editing.id}
            annotation={editing}
            anchorScreen={s}
            scale={cardScale}
            zoom={zoom}
            onMove={(x, y) => b.moveAnnotation(editing.id, x, y)}
            onSave={(note) => b.saveNote(editing.id, note)}
            onDelete={() => b.removeAnnotation(editing.id)}
            onClose={() => b.setEditing(null)}
          />
        )
      })()}
    </div>
  )
}
