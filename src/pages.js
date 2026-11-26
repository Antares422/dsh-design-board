const firstPage = (pages) => (pages?.length ? pages[0].id : null)

/** 当前页：请求的页不存在时回落到第一页；没有 pages 时返回 null（单页模式）。 */
export function currentPageId(pageId, pages) {
  if (!pages?.length) return null
  return pages.some(p => p.id === pageId) ? pageId : firstPage(pages)
}

/** 某一页的帧；没有 pages 时返回全部。未标 page 的帧归第一页。 */
export function framesOnPage(frames, pageId, pages) {
  if (!pages?.length) return frames
  const id = currentPageId(pageId, pages)
  return frames.filter(f => (f.page ?? firstPage(pages)) === id)
}

/** 某一页的便签；没有 pages 时返回全部。未标 page 的便签归第一页。 */
export function notesOnPage(notes, pageId, pages) {
  if (!pages?.length) return notes
  const id = currentPageId(pageId, pages)
  return notes.filter(n => (n.page ?? firstPage(pages)) === id)
}
