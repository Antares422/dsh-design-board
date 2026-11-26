const MIN_OVERLAP = 0.5
const DEFAULT_LIMIT = 8

function overlapRatio(rect, box) {
  const area = rect.w * rect.h
  if (!(area > 0)) return 0
  const w = Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x)
  const h = Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / area
}

/** 从帧内元素清单里挑出被框圈中的：重叠达一半以上，祖先让位给后代，取前 limit 个（文档序）。 */
export function pickCovered(elements, box, limit = DEFAULT_LIMIT) {
  const byId = new Map(elements.map(e => [e.id, e]))
  const hit = elements.filter(e => overlapRatio(e.rect, box) >= MIN_OVERLAP)
  const hitIds = new Set(hit.map(e => e.id))

  const shadowed = new Set()
  for (const e of hit) {
    for (let p = byId.get(e.parent); p; p = byId.get(p.parent)) {
      if (hitIds.has(p.id)) shadowed.add(p.id)
    }
  }
  return hit.filter(e => !shadowed.has(e.id)).slice(0, limit)
}

/** 计算全局选框与各帧的相交矩形，转换为各帧内的局部坐标。 */
export function intersectFramesWithMarquee(marquee, pageFrames, boxOf) {
  if (!marquee || !pageFrames || !boxOf) return []
  const mx0 = marquee.x
  const my0 = marquee.y
  const mx1 = marquee.x + marquee.w
  const my1 = marquee.y + marquee.h
  const results = []
  for (const f of pageFrames) {
    const fb = boxOf(f.id)
    if (!fb || !(fb.w > 0 && fb.h > 0)) continue
    const ix0 = Math.max(mx0, fb.x)
    const iy0 = Math.max(my0, fb.y)
    const ix1 = Math.min(mx1, fb.x + fb.w)
    const iy1 = Math.min(my1, fb.y + fb.h)
    if (ix1 > ix0 && iy1 > iy0) {
      results.push({
        frameId: f.id,
        localBox: {
          x: ix0 - fb.x,
          y: iy0 - fb.y,
          w: ix1 - ix0,
          h: iy1 - iy0,
        },
      })
    }
  }
  return results
}

/** 框选的切换：框内已选的取消，未选的加入（与点击一致）。 */
export function toggleSelections(list, items) {
  const inBox = new Set(items.map(i => i.key))
  const had = new Set(list.map(s => s.key))
  return [...list.filter(s => !inBox.has(s.key)), ...items.filter(i => !had.has(i.key))]
}

/** 查找点击坐标命中的已选元素；命中多个时优先取面积最小的内层元素。 */
export function findHitSelection(selections, frameId, point) {
  if (!selections || !selections.length || !point) return null
  const { x, y } = point
  const hits = []
  for (const s of selections) {
    if (s.frameId !== frameId || !s.rect) continue
    const { x: sx, y: sy, w: sw, h: sh } = s.rect
    if (!(sw > 0 && sh > 0)) continue
    // 元素主体区域（带 3px 容差）
    const inBody = x >= sx - 3 && x <= sx + sw + 3 && y >= sy - 3 && y <= sy + sh + 3
    // 元素上方标签 badge 区域（高 20px，宽按 tag 长度预估）
    const badgeW = Math.max(32, (s.tag ? s.tag.length : 4) * 8 + 14)
    const inBadge = x >= sx - 4 && x <= sx + badgeW && y >= sy - 22 && y <= sy + 2
    if (inBody || inBadge) {
      hits.push(s)
    }
  }
  if (!hits.length) return null
  hits.sort((a, b) => (a.rect.w * a.rect.h) - (b.rect.w * b.rect.h))
  return hits[0]
}
