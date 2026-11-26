import data from './presetPages.json'
import { renderPage } from './presetPage.js'

export const ARTIFACTS = [
  ['landing', '落地页'], ['deck', '演示文稿'], ['email', '邮件'], ['form', '表单'], ['newsletter', '简报'], ['poster', '海报'],
]

/** 渲染某套预设自带的整页（kit / kitDark / 各素材）；没有这一页返回 undefined。 */
export function pageHtml(preset, key) {
  const entry = data.pages[preset.id]?.[key]
  if (!entry) return undefined
  const [template, root, od] = entry
  const part = (i) => (i === null ? undefined : data.blobs[i])
  return renderPage(data.templates[template], { root: part(root), od: part(od) }, { name: preset.name, category: preset.categoryEn, description: preset.description })
}
