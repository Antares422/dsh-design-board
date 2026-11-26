import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const PARTS = { design: 'DESIGN.md', tokens: 'tokens.css', components: 'components.html', manifest: 'components.manifest.json' }

/** 返回 design_preset 工具的执行函数；dirUrl 指向内置 presets/ 目录（以 / 结尾）。 */
export function createPresetRunner(dirUrl) {
  let index
  const loadIndex = async () => (index ??= JSON.parse(await readFile(fileURLToPath(new URL('index.json', dirUrl)), 'utf8')))

  return async function run({ action, id, part = 'design', query }) {
    const all = await loadIndex()
    if (action === 'list') {
      const q = String(query || '').trim().toLowerCase()
      const rows = all.filter(e => !q || `${e.id} ${e.name} ${e.category} ${e.description}`.toLowerCase().includes(q))
      if (!rows.length) return `没有匹配「${query}」的设计体系`
      return rows.map(e => `${e.id} | ${e.name} | ${e.category} | ${e.description.slice(0, 80)}`).join('\n')
    }
    if (action !== 'read') throw new Error('action 只能是 list 或 read')
    // id 必须出自索引，防止用 ../ 读到目录外的文件
    const entry = all.find(e => e.id === id)
    if (!entry) throw new Error(`没有设计体系「${id}」，先用 action:"list" 查看`)
    const file = PARTS[part]
    if (!file) throw new Error(`part 只能是 ${Object.keys(PARTS).join(' / ')}`)
    try {
      return await readFile(fileURLToPath(new URL(`${entry.id}/${file}`, dirUrl)), 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      throw new Error(`「${entry.name}」没有 ${file}（官方源里就缺），改读 design 或 tokens`)
    }
  }
}
