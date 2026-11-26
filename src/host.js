import { createPresetRunner, PARTS } from './presetTool.js'
import { createContextStore, createContextHandler } from './hiddenContext.js'
import { buildBoardBinding } from './feedback.js'
import { boardPathOfDesignFile, createBindingHandler, createSessionDesignBindings, extractToolDesignPath } from './sessionDesign.js'
import guide from '../skills/design-board.md'
import appleStyle from '../presets/apple/DESIGN.md'

export const name = 'design-board'
export const inject = ['skills', 'tools', 'webServer']

const SOURCE_KIND = 'design-board'

const hiddenMessage = (text) => Object.freeze({
  id: globalThis.crypto.randomUUID(),
  role: 'user',
  content: Object.freeze([Object.freeze({ type: 'text', text })]),
  source: Object.freeze({ kind: SOURCE_KIND }),
})

const text = (_args, value) => [{ type: 'text', text: value }]

export function apply(ctx) {
  const runPreset = createPresetRunner(new URL('./presets/', import.meta.url))
  const store = createContextStore()
  const bindings = createSessionDesignBindings(null)
  const onBind = (sessionId, boardPath) => store.ensure(sessionId, buildBoardBinding(boardPath))
  const isBlankSession = async (sessionId) => {
    const sessions = ctx.get('sessions')
    if (!sessions) return false
    const live = sessions.get?.(sessionId)
    if (live) {
      const meta = ctx.get('sessionProjections')?.cachedSnapshot?.(live)?.values?.sessionListMetadata
      if (typeof meta?.blank === 'boolean') return meta.blank
      if (typeof live.snapshotEvents === 'function') {
        return !live.snapshotEvents().some(e => e?.type === 'turn/start' || e?.type === 'user/message')
      }
      return live.seq === 0
    }
    const persistence = ctx.get('sessionPersistence')
    if (!persistence) return false
    const stored = await persistence.stat?.(sessionId)
    if (!stored?.header) return true
    const meta = ctx.get('sessionProjectionCache')?.cachedSnapshot?.(stored.header)?.values?.sessionListMetadata
    return meta?.blank === true
  }
  const claimDesign = (sessionId, boardPath) => {
    if (!sessionId || !boardPath) return
    const before = bindings.get(sessionId)
    if (bindings.bind(sessionId, boardPath) && !before) onBind(sessionId, bindings.get(sessionId))
  }
  const claimPresentedFiles = (session, files) => {
    if (!session?.id || session.header?.origin === 'subagent' || bindings.get(session.id) || !Array.isArray(files)) return
    for (const file of files) {
      const boardPath = boardPathOfDesignFile(file?.path, session.header?.cwd)
      if (boardPath) { claimDesign(session.id, boardPath); return }
    }
  }
  const restoreFromSession = (session) => {
    if (!session?.id || session.header?.origin === 'subagent' || bindings.get(session.id) || typeof session.snapshotEvents !== 'function') return
    for (const event of session.snapshotEvents()) {
      if (event?.type === 'deliverables/presented') claimPresentedFiles(session, event.data?.files)
      if (bindings.get(session.id)) return
    }
  }
  ctx.effect(() => ctx.get('webServer').register({
    kind: 'exact',
    path: '/dsh-design-board/context',
    handler: createContextHandler(store),
  }), 'dsh-design-board: hidden context route')
  ctx.effect(() => ctx.get('webServer').register({
    kind: 'exact',
    path: '/dsh-design-board/binding',
    handler: createBindingHandler(bindings, onBind, isBlankSession),
  }), 'dsh-design-board: session binding route')
  ctx.on('session/event', (session, event) => {
    if (event?.type === 'deliverables/presented') claimPresentedFiles(session, event.data?.files)
  })
  ctx.on('tools/result', (exec, result) => {
    if (result?.isError || !exec?.agent?.session || exec.agent.session.header?.origin === 'subagent') return
    const boardPath = extractToolDesignPath(exec)
    if (boardPath) claimDesign(exec.agent.session.id, boardPath)
  })
  // 看板的选择/标注/设计体系在下一步前追加成隐藏消息：聊天里不显示，也不进输入框
  ctx.on('agent/pre-step', async ({ agent, step, signal }, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted || agent.session.header.origin === 'subagent') return decision
    restoreFromSession(agent.session)
    if (step === 1 && decision.messages.length === 0) return decision
    const pending = store.take(agent.session.id)
    return pending === undefined ? decision : { ...decision, messages: [...decision.messages, hiddenMessage(pending)] }
  })
  ctx.effect(() => ctx.skills.register({
    name: 'design-board',
    description: '做界面/页面/官网/海报等视觉设计，或用户想对比多个设计方案时先读（默认只出一个方案，用户明确要对比才出多个）：先写 board.json 列出方案并立刻 present，再逐个写自包含 HTML 帧，在右侧「设计画布」并排展示；用户选元素、圈标注的反馈会自动附带给你。',
    content: guide,
    source: 'runtime',
  }), 'dsh-design-board: design-board')
  ctx.effect(() => ctx.skills.register({
    name: 'design-board-apple-style',
    description: 'Apple 风格的设计规范（克制留白、黑白交替章节节奏、SF Pro 字体层级、#0071e3 强调色与组件规则）。做设计且用户没指定风格时默认按需加载，并可配合 design_preset 读取 id:"apple" 的 tokens 与 components。',
    content: appleStyle,
    source: 'runtime',
  }), 'dsh-design-board: design-board-apple-style')
  ctx.effect(() => ctx.tools.register({
    name: 'design_preset',
    description: 'Design Board 内置设计体系库（165 套预设，如 Airbnb、Linear、Apple 风格）。list 列出（可按名称/类别筛选），read 读取某套的 DESIGN.md / tokens.css / components.html / components.manifest.json。用户在看板里选了设计体系或要按某品牌风格做设计时用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'read'], description: 'list 列出内置设计体系，read 读取某套设计体系内容。' },
        id: { type: 'string', description: 'read 时必填：设计体系 id（如 apple、airbnb、linear）。' },
        part: { type: 'string', enum: Object.keys(PARTS), description: 'read 时读哪一份，默认 design。tokens 是要贴进 <style> 的变量表。' },
        query: { type: 'string', description: 'list 时的筛选词。' },
      },
    },
    output: { schema: { type: 'string' }, render: text },
    execute: (args) => runPreset(args),
  }), 'dsh-design-board: design_preset')
}
