// 看板的选中/标注/设计体系不进输入框：浏览器半推到宿主，宿主在 Agent 下一步前作为隐藏上下文注入。

const MAX_TEXT = 60000
const HEADER = '以下是 Design Board（设计画布）看板里当前绑定的设计目录、选择、标注、设计体系和自动校验结果。用户没有输入这段文字，是界面自动附带的；请按它理解用户接下来的消息，其中若带有 <design-board> 则本会话所有设计产出与修改必须固定在该目录内（不要新建第二个 design 子目录），<design-check> 是看板的校验结果，要先照着修好：'
const CLEARED = 'Design Board（设计画布）看板里之前附带的选择、标注、设计体系和校验提示已清空，之前那份不再有效。'

export const composeContext = ({ board = '', feedback = '', preset = '' }) => [board, preset, feedback].filter(Boolean).join('\n')

/** 每个会话只记最新内容和已注入的内容：没变就不重复注入，清空只在之前注入过时通知一次。 */
export function createContextStore() {
  const latest = new Map()
  const injected = new Map()
  return {
    set: (sessionId, text) => { latest.set(sessionId, text) },
    ensure: (sessionId, text) => { if (text && latest.get(sessionId) === undefined) latest.set(sessionId, text) },
    take(sessionId) {
      const text = latest.get(sessionId)
      if (text === undefined || text === (injected.get(sessionId) ?? '')) return undefined
      injected.set(sessionId, text)
      return text === '' ? CLEARED : `${HEADER}\n${text}`
    },
  }
}

const readBody = async (req) => {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

/** POST { sessionId, text }；回 204。 */
export function createContextHandler(store) {
  return async (req, res) => {
    const reply = (status) => { res.writeHead(status); res.end() }
    if (req.method !== 'POST') return reply(405)
    let data
    try { data = JSON.parse(await readBody(req)) } catch { return reply(400) }
    if (typeof data?.sessionId !== 'string' || typeof data?.text !== 'string') return reply(400)
    if (data.text.length > MAX_TEXT) return reply(413)
    store.set(data.sessionId, data.text)
    return reply(204)
  }
}
