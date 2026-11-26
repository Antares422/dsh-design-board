const FILE_PREFIX = 'dsh-resource://file/'

/** 资源地址 → 路径；会话地址取会话内相对路径，绝对地址补回开头斜杠。 */
export function pathOfAddress(address) {
  if (!address.startsWith(FILE_PREFIX)) return undefined
  const parts = address.slice(FILE_PREFIX.length).split(/[?#]/)[0].split('/')
  const scope = parts.shift()
  if (scope === 'session') parts.shift()
  const path = parts.map(decodeURIComponent).join('/')
  return scope === 'absolute' && !/^[A-Za-z]:/.test(path) ? '/' + path : path
}

export function dirOf(path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '.' : path.slice(0, i)
}

/** 会话内路径 → 资源地址（pathOfAddress 的反向）。 */
export const fileAddress = (sessionId, path) => `${FILE_PREFIX}session/${sessionId}/${path.split('/').map(encodeURIComponent).join('/')}`
