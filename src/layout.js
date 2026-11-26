export const DEFAULT_SIZE = { width: 480, height: 360 }

export const TITLE_HEIGHT = 44
const DEFAULT_GAP = 120
const MAX_AUTO_COLUMNS = 3

/** 按行排布各帧：返回带 x/y/width/height 的新数组；行高 = 该行最高帧 + 标题高度。 */
export function layoutFrames(frames, options = {}) {
  const gap = options.gap ?? DEFAULT_GAP
  const titleHeight = options.titleHeight ?? TITLE_HEIGHT
  const columns = Number.isInteger(options.columns) && options.columns > 0
    ? options.columns
    : Math.min(frames.length, MAX_AUTO_COLUMNS) || 1

  const sized = frames.map(f => ({
    ...f,
    width: f.width > 0 ? f.width : DEFAULT_SIZE.width,
    height: f.height > 0 ? f.height : DEFAULT_SIZE.height,
  }))

  const out = []
  let top = 0
  for (let start = 0; start < sized.length; start += columns) {
    const row = sized.slice(start, start + columns)
    let left = 0
    for (const f of row) {
      out.push({ ...f, x: left, y: top })
      left += f.width + gap
    }
    top += Math.max(...row.map(f => f.height)) + titleHeight + gap
  }
  return out
}
