import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { buildHtmlGallery, buildPdf, dataUrlBytes, exportName, exportScale } from '../src/export.js'

const PX_JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=='

test('导出文件名：去掉非法字符，空标题用 design，可选后缀', () => {
  assert.equal(exportName('官网 / 方案A', '', 'pdf'), '官网 - 方案A.pdf')
  assert.equal(exportName('  ', '2x', 'png'), 'design 2x.png')
  assert.equal(exportName('a:b*c?', '', 'png'), 'a-b-c-.png')
})

test('dataUrlBytes 解出 base64 字节', () => {
  const bytes = dataUrlBytes('data:image/jpeg;base64,' + PX_JPEG)
  assert.equal(bytes[0], 0xff)
  assert.equal(bytes[1], 0xd8)
  assert.ok(bytes.length > 100)
})

test('HTML 导出生成单文件画廊并转义标题和内嵌页面', () => {
  const html = buildHtmlGallery([{ title: 'A < B', html: '<h1 title="x">Hi</h1>', width: 390, height: 844 }], 'Board & title')
  assert.match(html, /Board &amp; title/)
  assert.match(html, /A &lt; B/)
  assert.match(html, /&lt;h1 title=&quot;x&quot;&gt;Hi&lt;\/h1&gt;/)
  assert.match(html, /height:844px/)
})

test('buildPdf 每张图一页，页面尺寸用传入的 CSS 像素', async () => {
  const bytes = await buildPdf([
    { jpeg: dataUrlBytes('data:image/jpeg;base64,' + PX_JPEG), width: 1280, height: 800 },
    { jpeg: dataUrlBytes('data:image/jpeg;base64,' + PX_JPEG), width: 390, height: 844 },
  ])
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF')
  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 2)
  assert.equal(doc.getPage(0).getWidth(), 1280)
  assert.equal(doc.getPage(1).getHeight(), 844)
})

test('导出倍率按像素上限收敛，超大或非法尺寸直接报错', () => {
  assert.equal(exportScale(1280, 800), 2)
  assert.equal(exportScale(8000, 2000), 1)
  assert.throws(() => exportScale(9000, 1000), /单边/)
  assert.throws(() => exportScale(Infinity, 100), /尺寸/)
  assert.throws(() => exportScale(8000, 8000), /面积/)
})

test('buildPdf 拒绝超出 PDF 页面范围的尺寸', async () => {
  await assert.rejects(buildPdf([{ jpeg: dataUrlBytes('data:image/jpeg;base64,' + PX_JPEG), width: 20000, height: 100 }]), /尺寸/)
})
