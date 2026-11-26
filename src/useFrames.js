import { useEffect, useRef, useState } from 'react'
import { dirOf } from './paths.js'
import { normalizeManifest, manifestFromListing, fillFromHtml } from './manifest.js'
import { withFrameScripts } from './frameScript.js'
import { validateFrame } from './validate.js'

/** 变更后等多久再重读：Agent 连写几个文件时合并成一次刷新。 */
const DEBOUNCE_MS = 200
/** 监听流中断（如休眠唤醒、RPC 重连）后的重连等待时间与前台兜底巡检间隔。 */
const RETRY_MS = 1500
const POLL_MS = 2000

function sameFrameMeta(a, b) {
  return a.id === b.id
    && a.url === b.url
    && a.title === b.title
    && a.file === b.file
    && a.width === b.width
    && a.height === b.height
    && a.page === b.page
    && a.error === b.error
}

function sameReadyState(prev, manifest, frames) {
  if (!prev || prev.status !== 'ready' || prev.warning || prev.watchError) return false
  if (JSON.stringify(prev.manifest) !== JSON.stringify(manifest)) return false
  if (!Array.isArray(prev.frames) || prev.frames.length !== frames.length) return false
  for (let i = 0; i < frames.length; i++) {
    if (!sameFrameMeta(prev.frames[i], frames[i])) return false
  }
  return true
}

async function readText(readBytes, path, signal) {
  const result = await readBytes(path, signal)
  if (!result.ok) throw new Error(result.error.message || String(result.error.code))
  return new TextDecoder().decode(result.value.data)
}

const revokeLater = url => setTimeout(() => URL.revokeObjectURL(url), 1000)

/**
 * 读清单和各帧 html，监听目录变化后重读。只有 html 变了的帧换 Blob 地址（iframe 才会重载），
 * 变了的帧 id 通过 onChanged 报给调用方。
 */
const BLANK_STATE = { status: 'ready', manifest: { title: '设计画布', frames: [] }, frames: [] }

export function useFrames({ boardPath, readBytes, list, watchDir, onChanged }) {
  const [state, setState] = useState({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const cache = useRef(new Map())
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  // 监听是非递归的：清单所在目录、其父目录（捕捉新建会话目录）以及每个帧文件所在目录都要监听
  const baseWatchDirs = (p) => {
    if (!p) return []
    const dir = dirOf(p)
    const parent = dirOf(dir)
    return parent && parent !== dir ? [parent, dir] : [dir]
  }
  const [dirs, setDirs] = useState(() => baseWatchDirs(boardPath))
  const dirsKey = dirs.join('|')

  useEffect(() => {
    if (!boardPath) return undefined
    const controller = new AbortController()
    let timer
    const retryTimers = new Set()
    const waitRetry = () => new Promise((resolve) => {
      const t = setTimeout(() => { retryTimers.delete(t); resolve() }, RETRY_MS)
      retryTimers.add(t)
    })
    const bump = () => {
      if (controller.signal.aborted) return
      clearTimeout(timer)
      timer = setTimeout(() => setTick(n => n + 1), DEBOUNCE_MS)
    }
    for (const dir of dirs) {
      ;(async () => {
        while (!controller.signal.aborted) {
          try {
            const stream = watchDir(dir, controller.signal)
            if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') break
            for await (const frame of stream) {
              if (controller.signal.aborted) return
              if (frame && frame.kind === 'change') bump()
            }
          } catch {
            if (controller.signal.aborted) return
          }
          if (controller.signal.aborted) return
          await waitRetry()
          if (!controller.signal.aborted) bump()
        }
      })()
    }
    const onFocus = () => bump()
    const onVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') bump()
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', onFocus)
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    const poll = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') bump()
    }, POLL_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
      clearInterval(poll)
      for (const t of retryTimers) clearTimeout(t)
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('focus', onFocus)
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [dirsKey, watchDir]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!boardPath) return undefined
    const controller = new AbortController()
    const { signal } = controller
    ;(async () => {
      try {
        const dir = dirOf(boardPath)
        // 没有 board.json（Agent 还没写或不写）或写到一半解析失败时，按目录里的 html 自动成帧照常显示
        const raw = await readBytes(boardPath, signal)
        let manifest
        if (raw.ok) {
          try {
            manifest = normalizeManifest(JSON.parse(new TextDecoder().decode(raw.value.data)))
          } catch {
            const listed = await list(dir, signal)
            manifest = manifestFromListing(dir, listed.ok ? listed.value.entries : [])
          }
        } else {
          const listed = await list(dir, signal)
          manifest = manifestFromListing(dir, listed.ok ? listed.value.entries : [])
        }
        const wanted = [...new Set([...baseWatchDirs(boardPath), ...manifest.frames.map(f => dirOf(dir + '/' + f.file))])]
        setDirs(prev => (prev.join('|') === wanted.join('|') ? prev : wanted))
        const loaded = await Promise.all(manifest.frames.map(async f => {
          try {
            const html = await readText(readBytes, dir + '/' + f.file, signal)
            return { ...fillFromHtml(f, html), html, issues: validateFrame(html) }
          } catch (error) { return { ...f, error: String(error.message || error) } }
        }))
        if (signal.aborted) return
        // 自动成帧的标题/尺寸读完页面才知道，回写到清单里（反馈文字用的是清单）
        manifest.frames = loaded.map(({ html, error, issues, ...frame }) => frame)

        const next = new Map()
        const changed = []
        const frames = loaded.map(f => {
          const prev = cache.current.get(f.id)
          // 读失败但之前有内容：沿用旧内容，避免写文件途中闪成空白
          if (f.error && prev) { next.set(f.id, prev); return { ...f, error: undefined, html: prev.html, url: prev.url } }
          if (f.error) return f
          if (prev && prev.html === f.html) { next.set(f.id, prev); return { ...f, url: prev.url } }
          const url = URL.createObjectURL(new Blob([withFrameScripts(f.html)], { type: 'text/html' }))
          next.set(f.id, { html: f.html, url })
          if (prev) { changed.push(f.id); revokeLater(prev.url) }
          return { ...f, url }
        })
        for (const [id, prev] of cache.current) if (!next.has(id)) revokeLater(prev.url)
        cache.current = next

        setState(s => (!changed.length && sameReadyState(s, manifest, frames)
          ? s
          : { status: 'ready', manifest, frames, count: (s.count || 0) + 1, watchError: undefined }))
        if (changed.length) onChangedRef.current?.(changed)
      } catch {
        if (signal.aborted) return
        // 清单或目录异常时保留上一次正常画面，首次加载也回退空白就绪画布照常渲染
        setState(s => (s.status === 'ready' ? s : BLANK_STATE))
      }
    })()
    return () => controller.abort()
  }, [boardPath, readBytes, list, tick])

  useEffect(() => () => { for (const { url } of cache.current.values()) URL.revokeObjectURL(url) }, [])

  return boardPath ? state : BLANK_STATE
}
