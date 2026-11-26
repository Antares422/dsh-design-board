import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPresetRunner } from '../src/presetTool.js'

const run = createPresetRunner(new URL('../presets/', import.meta.url))

test('list 不带筛选时列出全部，每行 id | 名称 | 类别 | 描述', async () => {
  const out = await run({ action: 'list' })
  const rows = out.split('\n')
  assert.ok(rows.length >= 150)
  assert.match(rows.find(r => r.startsWith('airbnb |')), /^airbnb \| Airbnb \| 电商与零售 \| /)
  assert.match(rows.find(r => r.startsWith('apple |')), /^apple \| Apple \| 媒体与消费 \| /)
})

test('list 按名称或类别筛选，无匹配时给出提示', async () => {
  const out = await run({ action: 'list', query: '汽车' })
  assert.ok(out.split('\n').every(r => r.includes('汽车')))
  assert.match(await run({ action: 'list', query: '不存在的体系xyz' }), /没有匹配/)
})

test('read 默认读 DESIGN.md，part 可选 tokens / components / manifest', async () => {
  assert.match(await run({ action: 'read', id: 'airbnb' }), /^# /m)
  assert.match(await run({ action: 'read', id: 'airbnb', part: 'tokens' }), /--accent:\s*#ff385c/)
  assert.match(await run({ action: 'read', id: 'apple' }), /Apple/)
  assert.match(await run({ action: 'read', id: 'apple', part: 'tokens' }), /#0071e3/)
})

test('read 拒绝不在索引里的 id（包括路径穿越与 me/ co/ 前缀）', async () => {
  await assert.rejects(run({ action: 'read', id: '../index' }), /没有设计体系/)
  await assert.rejects(run({ action: 'read', id: 'nope' }), /没有设计体系/)
  await assert.rejects(run({ action: 'read', id: 'me/custom' }), /没有设计体系/)
  await assert.rejects(run({ action: 'read', id: 'co/company' }), /没有设计体系/)
})

test('read 拒绝未知 part，未知 action 报错', async () => {
  await assert.rejects(run({ action: 'read', id: 'airbnb', part: 'x' }), /part 只能是/)
  await assert.rejects(run({ action: 'delete' }), /action 只能是/)
  await assert.rejects(run({ action: 'save', id: 'acme' }), /action 只能是/)
  await assert.rejects(run({ action: 'publish', id: 'acme' }), /action 只能是/)
})

test('预设缺某个文件时给出可读的错误，而不是路径', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'presets-'))
  mkdirSync(join(dir, 'x'))
  writeFileSync(join(dir, 'index.json'), JSON.stringify([{ id: 'x', name: 'X', category: 'c', description: 'd' }]))
  writeFileSync(join(dir, 'x', 'DESIGN.md'), '# x')
  const customRun = createPresetRunner(pathToFileURL(dir + '/'))
  await assert.rejects(customRun({ action: 'read', id: 'x', part: 'manifest' }), /「X」没有 components\.manifest\.json/)
  assert.equal(await customRun({ action: 'read', id: 'x' }), '# x')
})
