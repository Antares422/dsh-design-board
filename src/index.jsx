/**
 * Design Board（浏览器半）：右侧栏按文件名 board.json 接管，画布见 Board.jsx。
 * 每个会话只建一次绑定：函数引用要稳定，否则正文的 effect 每次渲染都重跑。
 */
import { Board } from './Board.jsx'
import { Icon } from './icons.jsx'
import { buildBoardBinding } from './feedback.js'
import { composeContext } from './hiddenContext.js'
import { fileAddress, pathOfAddress } from './paths.js'
import { createSessionDesignBindings } from './sessionDesign.js'

const TAB_ID = 'dsh-design-board'
const TAB_ID_KIND = 'design-board'
const BINDING_POLL_MS = 1500

export default {
  inject: ['slots', 'sidebarRight', 'sidebarRightTabs', 'remote', 'remote.workspaceFiles'],
  apply(ctx) {
    const bound = new Map()
    const designBindings = createSessionDesignBindings()
    // 选择/标注/设计体系/绑定目录推给宿主，由宿主作为隐藏上下文注入；不碰输入框
    const parts = new Map()
    const pushContext = (sessionId, key, block) => {
      const prev = parts.get(sessionId)
      if ((prev?.[key] ?? '') === (block ?? '')) return Promise.resolve()
      const next = { ...prev, [key]: block }
      parts.set(sessionId, next)
      return fetch('/dsh-design-board/context', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, text: composeContext({ board: '', feedback: '', preset: '', ...next }) }),
      }).catch(() => {})
    }
    const syncBindingToServer = (sessionId, boardPath) => fetch('/dsh-design-board/binding', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, boardPath }),
    }).catch(() => {})
    const getSessions = () => {
      try { return ctx.get?.('sessions') ?? ctx.sessions } catch { return undefined }
    }
    const sessionState = (sessionId) => {
      const list = getSessions()?.list?.getSnapshot?.()
      if (!list) return 'active'
      const row = list.byId?.[sessionId]
      if (row) return row.blank ? 'blank' : 'active'
      return list.phase === 'ready' ? 'active' : 'settling'
    }
    const isKnownBlank = (sessionId) => sessionState(sessionId) === 'blank'
    const canBindSession = (sessionId) => sessionState(sessionId) === 'active'
    const clearSessionDesign = (sessionId) => {
      const had = designBindings.clear(sessionId)
      if (had) {
        pushContext(sessionId, 'board', '')
        pushContext(sessionId, 'feedback', '')
      }
      return had
    }
    const commitSessionDesign = (sessionId, path) => {
      if (!canBindSession(sessionId)) return false
      const accepted = designBindings.bind(sessionId, path)
      const current = designBindings.get(sessionId)
      if (current) {
        pushContext(sessionId, 'board', buildBoardBinding(current))
        syncBindingToServer(sessionId, current)
      }
      return accepted
    }
    const bindSession = (sessionId) => {
      let face = bound.get(sessionId)
      if (!face) {
        face = {
          sessionId,
          list: (path, signal) => ctx.remote.workspaceFiles.list(sessionId, path, signal),
          readBytes: (path, signal) => ctx.remote.workspaceFiles.readBytes(sessionId, path, {}, signal),
          watchDir: (path, signal) => ctx.remote.workspaceFiles.changes(sessionId, path, signal),
          syncBoard: (block) => pushContext(sessionId, 'board', block),
          syncFeedback: (block) => pushContext(sessionId, 'feedback', block),
          syncPreset: (block) => pushContext(sessionId, 'preset', block),
          getDesignPath: () => designBindings.get(sessionId),
          bindDesign: path => commitSessionDesign(sessionId, path),
          clearDesign: () => clearSessionDesign(sessionId),
          isBlankSession: () => isKnownBlank(sessionId),
          subscribeDesign: listener => designBindings.subscribe(sessionId, listener),
        }
        bound.set(sessionId, face)
      }
      return face
    }

    // 同步当前屏幕会话的权威绑定：若 Agent 在本会话产出/present 了设计目录，自动锁定并展开看板；新会话不执行锁定
    ctx.effect(() => {
      const mounted = ctx.sidebarRight?.mounted
      if (!mounted) return undefined
      let stop
      let watchedState
      const watch = () => {
        stop?.()
        const sessionId = mounted.getSnapshot()
        watchedState = sessionId ? sessionState(sessionId) : undefined
        if (!sessionId || watchedState === 'settling') { stop = undefined; return }
        if (watchedState === 'blank') {
          clearSessionDesign(sessionId)
          stop = undefined
          return
        }
        const existing = designBindings.get(sessionId)
        if (existing) {
          pushContext(sessionId, 'board', buildBoardBinding(existing))
          syncBindingToServer(sessionId, existing)
          stop = undefined
          return
        }
        const controller = new AbortController()
        let timer
        let unsub
        const cleanup = () => {
          controller.abort()
          clearInterval(timer)
          unsub?.()
        }
        unsub = designBindings.subscribe(sessionId, () => cleanup())
        let polling = false
        const tick = async () => {
          if (polling || controller.signal.aborted || designBindings.get(sessionId)) return
          if (isKnownBlank(sessionId)) { clearSessionDesign(sessionId); cleanup(); return }
          polling = true
          try {
            const res = await fetch(`/dsh-design-board/binding?sessionId=${encodeURIComponent(sessionId)}`, {
              credentials: 'same-origin',
              signal: controller.signal,
            })
            if (!res.ok || controller.signal.aborted) return
            const data = await res.json()
            if (!data?.boardPath || controller.signal.aborted || isKnownBlank(sessionId)) return
            designBindings.bind(sessionId, data.boardPath)
            pushContext(sessionId, 'board', buildBoardBinding(data.boardPath))
            const hasDesignTab = (ctx.sidebarRight.tabsIn?.(sessionId) || []).some(t => t.kind === TAB_ID_KIND)
            if (!hasDesignTab) {
              ctx.sidebarRight.openResource(fileAddress(sessionId, data.boardPath), { kind: TAB_ID_KIND })
            }
            cleanup()
          } catch { /* 下一轮重试 */ } finally { polling = false }
        }
        tick()
        timer = setInterval(tick, BINDING_POLL_MS)
        stop = cleanup
      }
      watch()
      const unsubscribe = mounted.subscribe(watch)
      const unsubscribeSessions = getSessions()?.list?.subscribe?.(() => {
        const sessionId = mounted.getSnapshot()
        if (sessionId && sessionState(sessionId) !== watchedState) watch()
      })
      return () => { unsubscribe(); unsubscribeSessions?.(); stop?.() }
    }, 'dsh-design-board: sync session design binding')

    ctx.effect(() => ctx.sidebarRightTabs.register({
      id: TAB_ID,
      kind: 'design-board',
      patterns: ['board.json'],
      priority: 'extension',
      canOpen: (address) => pathOfAddress(address) !== undefined,
      title: () => '设计画布',
      guide: [{
        id: 'board',
        order: 120,
        title: () => '设计画布',
        description: () => '预览、对比与标注设计稿',
        icon: (props) => <Icon name="palette" size={props.size || 16} />,
      }],
    }), 'dsh-design-board: tab type')

    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab',
      key: TAB_ID,
      inject: (sessionId) => bindSession(sessionId),
    }, Board)), 'dsh-design-board: tab content')
  },
}
