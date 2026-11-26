import { newBoard } from './scan.js'

/** 自动打开的一步：没有基线就只建基线；之后新出现的看板打开一次，并和当前扫到的一起记入基线。 */
export function autoOpenStep(baseline, current) {
  if (baseline === undefined) return { baseline: current, open: undefined }
  return { baseline: [...new Set([...baseline, ...current])], open: newBoard(baseline, current) }
}
