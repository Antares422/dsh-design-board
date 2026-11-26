import { metaOfHtml, normalizeManifest } from './manifest.js'

const ROOT = 'design'

const HTML_FILE = /\.html?$/i

async function decodeFile(readBytes, filePath) {
  try {
    const res = await readBytes(filePath)
    if (!res?.ok) return undefined
    return new TextDecoder().decode(res.value.data)
  } catch { return undefined }
}

async function readFirstPreview(dirPath, entries, readBytes) {
  const hasManifest = entries.some(e => e.type === 'file' && e.name === 'board.json')
  if (hasManifest) {
    const raw = await decodeFile(readBytes, `${dirPath}/board.json`)
    if (raw) {
      try {
        const manifest = normalizeManifest(JSON.parse(raw))
        for (const frame of manifest.frames) {
          if (frame.file.startsWith('/')) continue
          if (frame.file.split('/').includes('..')) continue
          const html = await decodeFile(readBytes, `${dirPath}/${frame.file}`)
          if (html !== undefined) {
            return { html, width: frame.width ?? metaOfHtml(html).width ?? 1280, file: frame.file }
          }
        }
      } catch { /* 清单不可用时回退按目录内 html 顺序读取 */ }
    }
  }
  const htmlFiles = entries
    .filter(e => e.type === 'file' && HTML_FILE.test(e.name))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  for (const name of htmlFiles) {
    const html = await decodeFile(readBytes, `${dirPath}/${name}`)
    if (html !== undefined) {
      return { html, width: metaOfHtml(html).width ?? 1280, file: name }
    }
  }
  return null
}

/**
 * 扫描 design/<任务名>/：有 board.json 或有 html 的目录都算一块看板（后者没有清单，路径照记为 board.json）。list 是 workspaceFiles.list 绑定了会话后的函数，返回 { ok, value: { entries } }。
 * 目录不存在、某个子目录读失败都视为没有，不抛错。
 */
export async function scanBoards(list) {
  const top = await list(ROOT)
  if (!top.ok) return []
  const dirs = top.value.entries.filter(e => e.type === 'directory').map(e => e.name)
  const found = await Promise.all(dirs.map(async (name) => {
    const sub = await list(`${ROOT}/${name}`)
    return sub.ok && sub.value.entries.some(e => e.type === 'file' && (e.name === 'board.json' || HTML_FILE.test(e.name))) ? `${ROOT}/${name}/board.json` : undefined
  }))
  return found.filter(Boolean).sort()
}

/** 返回设计目录，入口页用它让用户先选目录再进入画布；传入 readBytes 时附带首个 HTML 预览。 */
export async function scanDesignDirs(list, readBytes) {
  const top = await list(ROOT)
  if (!top.ok) return []
  const rows = await Promise.all(top.value.entries
    .filter(e => e.type === 'directory')
    .map(async (entry) => {
      const path = `${ROOT}/${entry.name}`
      const sub = await list(path)
      if (!sub.ok || !sub.value.entries.some(e => e.type === 'file' && (e.name === 'board.json' || HTML_FILE.test(e.name)))) return undefined
      const manifest = sub.value.entries.find(e => e.type === 'file' && e.name === 'board.json')
      const base = { path, name: entry.name, files: sub.value.entries.filter(e => e.type === 'file').length, updatedAt: manifest?.modifiedAt ?? manifest?.updatedAt }
      return readBytes ? { ...base, preview: await readFirstPreview(path, sub.value.entries, readBytes) } : base
    }))
  return rows.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

/** 基线之后新出现的第一个看板路径。 */
export const newBoard = (baseline, current) => current.find(p => !baseline.includes(p))
