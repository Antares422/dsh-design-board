const KEY_PREFIX = 'design-board:session:'
const DESIGN_FILE = /\.(?:html?)$/i

const storageValue = (storage, key) => {
  try { return storage?.getItem(key) || undefined } catch { return undefined }
}

const saveStorageValue = (storage, key, value) => {
  try { storage?.setItem(key, value) } catch { /* 持久化不可用时仍保留内存绑定 */ }
}

const removeStorageValue = (storage, key) => {
  try { storage?.removeItem?.(key) } catch { /* 持久化不可用时忽略 */ }
}

const stripMacPrivate = p => p.replace(/^\/private(?=\/(?:tmp|var)(?:\/|$))/, '')

const normalizeSlashes = p => String(p).replace(/\\/g, '/').replace(/\/+$/, '')

/** 将 sessionId 规整为单段安全目录名，供多会话严格隔离使用。 */
export function sessionDesignSlug(sessionId) {
  if (typeof sessionId !== 'string') return undefined
  const clean = sessionId.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+|\.+$/g, '')
  return clean || undefined
}

/** 返回当前会话专属的设计看板路径 `design/<sessionSlug>/board.json`。 */
export function sessionBoardPath(sessionId) {
  const slug = sessionDesignSlug(sessionId)
  return slug ? `design/${slug}/board.json` : undefined
}

/** 判断本次工具调用是否刚读取了 `design-board` 技能，用于在写文件前即锁定并下发本会话专属目录。 */
export function isDesignBoardSkillRead(exec) {
  if (!exec || typeof exec !== 'object' || exec.name !== 'skill') return false
  let args = exec.arguments
  if (typeof args === 'string') {
    try { args = JSON.parse(args) } catch { return false }
  }
  if (!args || typeof args !== 'object') return false
  return (args.name ?? args.skill ?? args.id) === 'design-board'
}

/**
 * 将相对路径或工作区内绝对路径解析为规范看板路径 `design/<目录>/board.json`。
 * 只接受 `design/<目录>/board.json` 或 `design/<目录>/*.html`；不合法路径返回 undefined。
 */
export function boardPathOfDesignFile(filePath, cwd) {
  if (typeof filePath !== 'string' || !filePath.trim()) return undefined
  let rel = normalizeSlashes(filePath.trim())
  if (rel.startsWith('/')) {
    if (typeof cwd !== 'string' || !cwd.trim()) return undefined
    const root = stripMacPrivate(normalizeSlashes(cwd.trim()))
    const target = stripMacPrivate(rel)
    if (!target.startsWith(root + '/')) return undefined
    rel = target.slice(root.length + 1)
  }
  rel = rel.replace(/^(?:\.\/)+/, '')
  const parts = rel.split('/')
  if (parts.length !== 3 || parts.some(seg => !seg || seg === '.' || seg === '..')) return undefined
  if (parts[0] !== 'design') return undefined
  if (parts[2] !== 'board.json' && !DESIGN_FILE.test(parts[2])) return undefined
  return `design/${parts[1]}/board.json`
}

/** 从写入类工具调用提取目标设计看板路径；读取类或无关路径返回 undefined。 */
export function extractToolDesignPath(exec) {
  if (!exec || typeof exec !== 'object') return undefined
  let args = exec.arguments
  if (typeof args === 'string') {
    try { args = JSON.parse(args) } catch { return undefined }
  }
  if (!args || typeof args !== 'object') return undefined
  let rawPath
  if (exec.name === 'write' || exec.name === 'edit') rawPath = args.file_path
  else if (exec.name === 'str_replace_editor' && args.command && args.command !== 'view') rawPath = args.path
  if (typeof rawPath !== 'string') return undefined
  return boardPathOfDesignFile(rawPath, exec.agent?.session?.header?.cwd)
}

const defaultStorage = () => {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined } catch { return undefined }
}

/** 每个会话一旦正式绑定就永久固定一个设计目录；浏览目录不调用 bind，关闭标签不会解除已生效的绑定。 */
export function createSessionDesignBindings(storage = defaultStorage()) {
  const bindings = new Map()
  const listeners = new Map()
  const keyOf = sessionId => `${KEY_PREFIX}${sessionId}`
  const notify = (sessionId, boardPath) => {
    const set = listeners.get(sessionId)
    if (!set) return
    for (const fn of [...set]) fn(boardPath)
  }

  return {
    get(sessionId) {
      if (!sessionId) return undefined
      const current = bindings.get(sessionId) || storageValue(storage, keyOf(sessionId))
      if (current) bindings.set(sessionId, current)
      return current
    },
    bind(sessionId, boardPath) {
      if (!sessionId || typeof boardPath !== 'string' || !boardPath) return false
      const normalized = boardPathOfDesignFile(boardPath) || boardPath
      const current = this.get(sessionId)
      if (current && current !== normalized) return false
      if (current === normalized) return true
      bindings.set(sessionId, normalized)
      saveStorageValue(storage, keyOf(sessionId), normalized)
      notify(sessionId, normalized)
      return true
    },
    clear(sessionId) {
      if (!sessionId) return false
      const had = Boolean(bindings.get(sessionId) || storageValue(storage, keyOf(sessionId)))
      bindings.delete(sessionId)
      removeStorageValue(storage, keyOf(sessionId))
      if (had) notify(sessionId, undefined)
      return had
    },
    subscribe(sessionId, listener) {
      if (!sessionId || typeof listener !== 'function') return () => {}
      let set = listeners.get(sessionId)
      if (!set) { set = new Set(); listeners.set(sessionId, set) }
      set.add(listener)
      return () => {
        set.delete(listener)
        if (set.size === 0) listeners.delete(sessionId)
      }
    },
  }
}

const readBody = async (req) => {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

const sendJson = (res, status, payload) => {
  const text = JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(text)
}

/**
 * 判定当前会话是否可锁定设计目录：
 * - active：已有对话记录，可正常锁定与恢复绑定
 * - blank：确认没有任何对话的新会话，禁止锁定并清理历史误锁状态
 * - settling：历史会话冷启动尚未拉完元数据时暂缓判断，既不误清持久绑定，也不提前锁定
 */
export function resolveSessionDesignPhase({ session, summaryBlank, fallbackBlank } = {}) {
  if (session?.blank === false || summaryBlank === false) return 'active'
  if (summaryBlank === true || (session?.blank === true && session?.openState === 'open')) return 'blank'
  if (session !== undefined || summaryBlank !== undefined) return 'settling'
  return fallbackBlank ? 'blank' : 'active'
}

/** GET ?sessionId= 查询绑定；POST { sessionId, boardPath } 正式绑定会话设计目录（新会话不执行锁定）。 */
export function createBindingHandler(bindings, onBind, isBlankSession) {
  return async (req, res) => {
    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://localhost')
      const sessionId = url.searchParams.get('sessionId') || ''
      if (!sessionId) return sendJson(res, 400, { error: 'missing sessionId' })
      if (await isBlankSession?.(sessionId)) {
        bindings.clear?.(sessionId)
        return sendJson(res, 200, { boardPath: null })
      }
      return sendJson(res, 200, { boardPath: bindings.get(sessionId) ?? null })
    }
    if (req.method === 'POST') {
      let data
      try { data = JSON.parse(await readBody(req)) } catch { return sendJson(res, 400, { error: 'invalid json' }) }
      if (typeof data?.sessionId !== 'string' || !data.sessionId || typeof data?.boardPath !== 'string' || !data.boardPath) {
        return sendJson(res, 400, { error: 'invalid payload' })
      }
      if (await isBlankSession?.(data.sessionId)) {
        bindings.clear?.(data.sessionId)
        return sendJson(res, 200, { accepted: false, boardPath: null })
      }
      const before = bindings.get(data.sessionId)
      const accepted = bindings.bind(data.sessionId, data.boardPath)
      const current = bindings.get(data.sessionId) ?? null
      if (accepted && !before && current) onBind?.(data.sessionId, current)
      return sendJson(res, 200, { accepted, boardPath: current })
    }
    res.writeHead(405)
    res.end()
  }
}
