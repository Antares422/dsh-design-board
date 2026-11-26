const ROOT = '/*ROOT*/'
const OD = '/*OD*/'
const ROOT_BLOCK = /:root\s*\{[\s\S]*?\n\s*\}/
const OD_BLOCK = /(?:^[ \t]*--od-[\w-]+:[^;]*;\n)+/m

/** 模板里的占位符，按这个顺序替换（先长后短，避免类别名被名称吃掉）。 */
const slots = ({ name, category, description }) => [
  ['{{DESC}}', description], ['{{CATUP}}', category.toUpperCase()], ['{{CAT}}', category], ['{{NAME}}', name],
]

/**
 * 把预设自带的预览页拆成「共用模板 + 各套特有的部分」：
 * :root 色值块、--od-* 变量块原样留在 parts，名称/类别/描述换成占位符。
 */
export function splitPage(html, meta) {
  const root = html.match(ROOT_BLOCK)?.[0]
  let template = root === undefined ? html : html.replace(ROOT_BLOCK, () => ROOT)
  const od = template.match(OD_BLOCK)?.[0]
  if (od !== undefined) template = template.replace(OD_BLOCK, () => OD + '\n')
  for (const [token, value] of slots(meta)) template = template.split(value).join(token)
  return { template, parts: { root, od } }
}

/** splitPage 的逆运算；meta 换成别的预设，渲染出的就是那一套的页面。 */
export function renderPage(template, parts, meta) {
  let html = template
  for (const [token, value] of slots(meta)) html = html.split(token).join(value)
  if (parts.od !== undefined) html = html.replace(OD + '\n', () => parts.od)
  if (parts.root !== undefined) html = html.replace(ROOT, () => parts.root)
  return html
}
