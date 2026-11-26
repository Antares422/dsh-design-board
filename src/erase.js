const ANCHOR_RADIUS = 14 // 文字标注锚点（小点）的可擦半径，流坐标

const distToSegment = (p, a, b) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// 点到矩形的距离（点在矩形内为 0），橡皮擦是圆形，按圆与矩形是否相交判断
const distToRect = (p, x, y, w, h) => Math.hypot(Math.max(x - p.x, 0, p.x - (x + w)), Math.max(y - p.y, 0, p.y - (y + h)))

function hits(a, p, tol) {
  if (a.type === 'rect') return distToRect(p, a.x, a.y, a.w, a.h) <= tol
  if (a.type === 'pen') {
    const pts = a.points
    if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= tol
    return pts.slice(1).some((q, i) => distToSegment(p, pts[i], q) <= tol)
  }
  return Math.hypot(p.x - a.x, p.y - a.y) <= Math.max(tol, ANCHOR_RADIUS)
}

/** 橡皮擦位置命中的标注 id，后画的在前；tol 是流坐标下的容差。 */
export function hitAnnotations(annotations, point, tol) {
  return annotations.filter(a => hits(a, point, tol)).map(a => a.id).reverse()
}

/** 橡皮擦位置命中的「选中元素」key；originOf(frameId) 给帧在画布上的左上角，选中框是帧内坐标。 */
export function hitSelections(selections, originOf, point, tol) {
  return selections.filter((s) => {
    const o = originOf(s.frameId)
    if (!o) return false
    const { x, y, w, h } = s.rect
    return distToRect(point, o.x + x, o.y + y, w, h) <= tol
  }).map(s => s.key)
}
