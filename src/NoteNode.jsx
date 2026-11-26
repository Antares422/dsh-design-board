import { DISPLAY } from './theme.js'

/** 画布上的注释节点：标题（大字号分组）或便签。内容由 Agent 写进 board.json，看板只读。 */
export function NoteNode({ data }) {
  const note = data.note
  if (note.kind === 'title') {
    return (
      <div style={{
        width: '100%', fontFamily: DISPLAY, fontWeight: 600, fontSize: 40, lineHeight: 1.2,
        letterSpacing: '-0.02em', whiteSpace: 'pre-wrap', color: 'inherit',
      }}>{note.text}</div>
    )
  }
  return (
    <div style={{
      width: '100%', minHeight: 72, padding: '12px 14px', boxSizing: 'border-box',
      borderRadius: 6, background: 'light-dark(#fff6c9, #4a4320)', color: 'light-dark(#3a3320, #f5edd0)',
      boxShadow: '0 2px 10px rgba(0,0,0,.12)', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap',
    }}>{note.text}</div>
  )
}
