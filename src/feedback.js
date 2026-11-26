const TEXT_LIMIT = 40

// 只转义会破坏结构的字符；'>' 在引号属性和正文里都合法，不转义以免草稿里一堆 &gt;
const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const escapeAttr = s => escapeText(s).replace(/"/g, '&quot;')

const clip = (s = '') => {
  const text = String(s).replace(/\s+/g, ' ').trim()
  return text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT) + '…' : text
}

const attrs = pairs => pairs
  .filter(([, v]) => v !== undefined && v !== '')
  .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
  .join('')

function selectedLine(s) {
  if (s.failed) return '<selected locate="failed"/>'
  return `<selected${attrs([['selector', s.selector], ['tag', s.tag], ['text', clip(s.text)], ['via', s.via]])}/>`
}

function annotationLine(a) {
  const covers = (a.covers || [])
    .map(c => c.text ? `${c.selector}（${clip(c.text)}）` : c.selector)
    .join('; ')
  const open = `<annotation${attrs([['type', a.type], ['covers', covers], ['stale', a.stale ? 'true' : undefined]])}`
  return a.note ? `${open}>${escapeText(a.note)}</annotation>` : `${open}/>`
}

/** 把选中项和标注拼成回传给 Agent 的文本块；什么都没有时返回空串。 */
export function buildFeedback({ board, frames = [], selections = [], annotations = [], note, rejected = [] }) {
  const known = new Set(frames.map(f => f.id))
  const onCanvas = annotations.filter(a => !known.has(a.frameId))

  const sections = []
  for (const f of frames) {
    const lines = [
      ...selections.filter(s => s.frameId === f.id).map(selectedLine),
      ...annotations.filter(a => a.frameId === f.id).map(annotationLine),
    ]
    if (!lines.length) continue
    sections.push([
      `  <frame${attrs([['id', f.id], ['title', f.title], ['file', f.file]])}>`,
      ...lines.map(l => '    ' + l),
      '  </frame>',
    ].join('\n'))
  }
  if (onCanvas.length) {
    sections.push(['  <canvas>', ...onCanvas.map(a => '    ' + annotationLine(a)), '  </canvas>'].join('\n'))
  }
  const feedback = sections.length ? [
    `<design-feedback${attrs([['board', board]])}>`,
    ...(note ? [`  <note>${escapeText(note)}</note>`] : []),
    ...sections,
    '</design-feedback>',
  ].join('\n') : ''
  return [feedback, checkBlock(board, rejected)].filter(Boolean).join('\n')
}

/** 看板自动校验没通过的方案：没有展示给用户，要 Agent 原地改到通过。 */
function checkBlock(board, rejected) {
  if (!rejected.length) return ''
  return [
    `<design-check${attrs([['board', board]])}>`,
    '  <instruction>以下方案未通过看板校验，没有展示给用户。请原地修改对应文件直到通过（不要新建文件，不要改 id）；改完这段提示会自动消失。</instruction>',
    ...rejected.flatMap(f => [
      `  <rejected${attrs([['id', f.id], ['file', f.file], ['title', f.title]])}>`,
      ...f.issues.map(i => `    <issue${attrs([['code', i.code]])}>${escapeText(i.message)}</issue>`),
      '  </rejected>',
    ]),
    '</design-check>',
  ].join('\n')
}

/** 选了设计体系时给 Agent 的标记；没选返回空串。 */
export const buildPreset = (preset) => (preset ? `<design-preset${attrs([['id', preset.id], ['name', preset.name], ['version', preset.version]])}/>` : '')

/** 会话已正式绑定设计目录时给 Agent 的标记；未绑定返回空串。 */
export const buildBoardBinding = (boardPath) => {
  if (!boardPath) return ''
  const dir = String(boardPath).replace(/\/board\.json$/, '')
  return `<design-board${attrs([['dir', dir], ['board', boardPath]])}/>`
}
