import test from 'node:test'
import assert from 'node:assert/strict'
import { pathOfAddress, dirOf } from '../src/paths.js'

test('会话地址取会话内相对路径', () => {
  assert.equal(pathOfAddress('dsh-resource://file/session/s1/design/board.json'), 'design/board.json')
})

test('绝对地址补回开头斜杠', () => {
  assert.equal(pathOfAddress('dsh-resource://file/absolute/Users/me/board.json'), '/Users/me/board.json')
})

test('路径分段按 URI 解码，查询串和锚点被丢弃', () => {
  assert.equal(pathOfAddress('dsh-resource://file/session/s1/%E8%AE%BE%E8%AE%A1/board.json?x=1#y'), '设计/board.json')
})

test('不是文件地址返回 undefined', () => {
  assert.equal(pathOfAddress('https://example.com/board.json'), undefined)
})

test('dirOf 取父目录，无目录时为 .', () => {
  assert.equal(dirOf('a/b/board.json'), 'a/b')
  assert.equal(dirOf('board.json'), '.')
})
