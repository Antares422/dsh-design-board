/**
 * 注入每个帧的脚本（帧是不透明源沙箱，只能靠 postMessage 与宿主通信）。
 *   probe：按坐标找元素 → probed；list：列出可见元素 → listed；ready：加载完成；
 *   key：把 Esc 转给看板；
 *   theme：切换深浅色（data-theme / .dark / color-scheme）→ themeinfo（当前是否深色、页面是否做了两套主题）；
 *   snapshot：把渲染后的 DOM 交回宿主 → snapshot（导出 PNG/PDF 用，宿主在无脚本的同源 iframe 里栅格化）。
 */
export const FRAME_SCRIPT = '<script>(' + function () {
  var SKIP = { SCRIPT: 1, STYLE: 1, META: 1, LINK: 1, HEAD: 1, TITLE: 1, NOSCRIPT: 1, BR: 1 }
  var LIMIT = 2000

  function selector(el) {
    var parts = []
    while (el && el.nodeType === 1 && el !== document.documentElement && parts.length < 5) {
      var s = el.tagName.toLowerCase()
      if (el.id) { parts.unshift(s + '#' + CSS.escape(el.id)); break }
      var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      if (cls.length) s += '.' + cls.map(CSS.escape).join('.')
      else {
        var n = 1
        for (var sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) if (sib.tagName === el.tagName) n++
        s += ':nth-of-type(' + n + ')'
      }
      parts.unshift(s)
      el = el.parentElement
    }
    return parts.join(' > ')
  }

  function describe(el) {
    var r = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      selector: selector(el),
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
    }
  }

  function list() {
    var ids = new Map()
    var out = []
    var all = document.body ? document.body.getElementsByTagName('*') : []
    for (var i = 0; i < all.length && out.length < LIMIT; i++) {
      var el = all[i]
      if (SKIP[el.tagName] || el.ownerSVGElement) continue
      var info = describe(el)
      if (!(info.rect.w > 0 && info.rect.h > 0)) continue
      var p = el.parentElement
      while (p && !ids.has(p)) p = p.parentElement
      info.id = String(out.length)
      info.parent = p ? ids.get(p) : null
      ids.set(el, info.id)
      out.push(info)
    }
    return out
  }

  function isDark() {
    var h = document.documentElement
    var t = h.getAttribute('data-theme')
    if (t) return t === 'dark'
    var els = [document.body, h]
    for (var i = 0; i < els.length; i++) {
      var m = els[i] && getComputedStyle(els[i]).backgroundColor.match(/rgba?\(([^)]+)\)/)
      if (!m) continue
      var p = m[1].split(',').map(parseFloat)
      if (p.length < 4 || p[3] > 0.5) return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] < 128
    }
    return false
  }

  // 页面只有声明了 [data-theme] / .dark / light-dark() 才算做了两套主题，切换才有效
  function supportsTheme() {
    var sheets = document.styleSheets
    for (var i = 0; i < sheets.length; i++) {
      var rules
      try { rules = sheets[i].cssRules } catch (err) { continue }
      for (var j = 0; j < rules.length; j++) {
        var css = rules[j].cssText
        if (css.indexOf('data-theme') >= 0 || css.indexOf('.dark') >= 0 || css.indexOf('light-dark(') >= 0) return true
      }
    }
    return false
  }

  function themeInfo() { parent.postMessage({ dsb: 'themeinfo', dark: isDark(), supported: supportsTheme() }, '*') }

  function checkLayout() {
    var root = document.documentElement
    if (!root || !root.clientWidth) return
    var cw = root.clientWidth
    var sw = root.scrollWidth
    if (sw > cw + 4) {
      parent.postMessage({
        dsb: 'layout',
        message: '页面渲染后出现横向溢出（视口宽 ' + cw + 'px，实际内容宽 ' + sw + 'px，超出 ' + (sw - cw) + 'px）。请检查表格列宽、抽屉定位或未换行的 Flex/Grid 子项，确保在视口宽度内完整呈现。',
      }, '*')
    }
  }

  // 导出：clone 出来的 DOM 没有运行时值，先把表单当前值和 canvas 像素补进去
  function snapshotHtml() {
    var clone = document.documentElement.cloneNode(true)
    var live = document.querySelectorAll('input, textarea, select')
    var copy = clone.querySelectorAll('input, textarea, select')
    for (var i = 0; i < live.length && i < copy.length; i++) {
      var src = live[i], dst = copy[i]
      if (src.tagName === 'TEXTAREA') dst.textContent = src.value
      else if (src.tagName === 'SELECT') {
        var options = dst.querySelectorAll('option')
        for (var j = 0; j < options.length; j++) {
          if (j === src.selectedIndex) options[j].setAttribute('selected', '')
          else options[j].removeAttribute('selected')
        }
      } else if (src.type === 'checkbox' || src.type === 'radio') {
        if (src.checked) dst.setAttribute('checked', '')
        else dst.removeAttribute('checked')
      } else {
        dst.setAttribute('value', src.value)
      }
    }
    var canvases = document.querySelectorAll('canvas')
    var clones = clone.querySelectorAll('canvas')
    for (var c = 0; c < canvases.length && c < clones.length; c++) {
      try {
        var img = document.createElement('img')
        img.setAttribute('src', canvases[c].toDataURL('image/png'))
        img.setAttribute('width', canvases[c].width)
        img.setAttribute('height', canvases[c].height)
        var style = canvases[c].getAttribute('style')
        if (style) img.setAttribute('style', style)
        clones[c].parentNode.replaceChild(img, clones[c])
      } catch (err) { /* 跨域 canvas 拿不到像素，保留原样 */ }
    }
    return clone.outerHTML
  }

  addEventListener('message', function (e) {
    var d = e.data
    if (!d || !d.dsb) return
    if (d.dsb === 'probe') {
      var el = document.elementFromPoint(d.x, d.y)
      var ok = el && el !== document.documentElement && el !== document.body
      parent.postMessage({ dsb: 'probed', id: d.id, el: ok ? describe(el) : null }, '*')
    } else if (d.dsb === 'theme') {
      var h = document.documentElement
      h.setAttribute('data-theme', d.mode)
      h.classList.toggle('dark', d.mode === 'dark')
      h.style.colorScheme = d.mode
      themeInfo()
    } else if (d.dsb === 'list') {
      parent.postMessage({ dsb: 'listed', id: d.id, els: list() }, '*')
    } else if (d.dsb === 'snapshot') {
      parent.postMessage({ dsb: 'snapshot', id: d.id, html: snapshotHtml() }, '*')
    }
  })
  // 焦点在帧里时按键到不了看板：把 Esc 转给看板（退出全屏、取消选择）
  addEventListener('keydown', function (e) { if (e.key === 'Escape') parent.postMessage({ dsb: 'key', key: 'Escape' }, '*') })

  // Play 模式下鼠标在画布帧上时，滚轮/捏合缩放与按住拖拽转发给宿主移动画布（全屏单独查看除外）
  if (window.name !== 'dsb-immersive') {
    addEventListener('wheel', function (e) {
      e.preventDefault()
      parent.postMessage({
        dsb: 'wheel',
        clientX: e.clientX,
        clientY: e.clientY,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        ctrlKey: !!(e.ctrlKey || e.metaKey),
        shiftKey: !!e.shiftKey,
      }, '*')
    }, { passive: false })

    var pan = null
    var suppressClickUntil = 0
    function isNativeDragTarget(el) {
      while (el && el.nodeType === 1) {
        var tag = el.tagName
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true
        if (tag === 'INPUT') {
          var type = (el.type || 'text').toLowerCase()
          if (type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'checkbox' && type !== 'radio') return true
        }
        if (el.getAttribute('draggable') === 'true' || el.isContentEditable) return true
        el = el.parentElement
      }
      return false
    }
    addEventListener('pointerdown', function (e) {
      if (e.button === 0 && isNativeDragTarget(e.target)) return
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return
      pan = { id: e.pointerId, sx: e.screenX, sy: e.screenY, active: e.button !== 0 }
      if (pan.active) {
        e.preventDefault()
        try { document.documentElement.setPointerCapture(e.pointerId) } catch (err) {}
        parent.postMessage({ dsb: 'pan', phase: 'start', screenX: e.screenX, screenY: e.screenY }, '*')
      }
    })
    addEventListener('pointermove', function (e) {
      if (!pan || e.pointerId !== pan.id) return
      if (!pan.active) {
        if (Math.hypot(e.screenX - pan.sx, e.screenY - pan.sy) < 5) return
        pan.active = true
        try { window.getSelection().removeAllRanges() } catch (err) {}
        document.documentElement.style.userSelect = 'none'
        try { document.documentElement.setPointerCapture(e.pointerId) } catch (err) {}
        parent.postMessage({ dsb: 'pan', phase: 'start', screenX: pan.sx, screenY: pan.sy }, '*')
      }
      e.preventDefault()
      parent.postMessage({ dsb: 'pan', phase: 'move', screenX: e.screenX, screenY: e.screenY }, '*')
    })
    function endPan(e) {
      if (!pan || (e && e.pointerId !== undefined && e.pointerId !== pan.id)) return
      if (pan.active) {
        document.documentElement.style.userSelect = ''
        suppressClickUntil = Date.now() + 120
        parent.postMessage({ dsb: 'pan', phase: 'end' }, '*')
      }
      pan = null
    }
    addEventListener('pointerup', endPan)
    addEventListener('pointercancel', endPan)
    addEventListener('lostpointercapture', endPan)
    addEventListener('click', function (e) {
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation()
        e.preventDefault()
        suppressClickUntil = 0
      }
    }, true)
    addEventListener('contextmenu', function (e) {
      if (Date.now() < suppressClickUntil || (pan && pan.active)) e.preventDefault()
    }, true)
  }

  parent.postMessage({ dsb: 'ready' }, '*')
  themeInfo()
  if (document.readyState === 'complete') setTimeout(checkLayout, 60)
  else addEventListener('load', function () { setTimeout(checkLayout, 60) })
}.toString() + ')()</script>'

/** 页面最先跑的探针：加载头 2.5 秒内的脚本报错回报给看板（报错的页面 Play 里什么都点不动）。 */
export const PRE_SCRIPT = '<script>(' + function () {
  var t0 = Date.now()
  function report(msg) {
    if (Date.now() - t0 < 2500) parent.postMessage({ dsb: 'health', message: String(msg).slice(0, 200) }, '*')
  }
  addEventListener('error', function (e) { report(e.message || 'error') })
  addEventListener('unhandledrejection', function (e) { report((e.reason && e.reason.message) || e.reason) })
}.toString() + ')()</script>'

/** 探针放最前（<head> 之后，不能放在文档类型前面否则变怪异模式），看板脚本放最后。 */
export function withFrameScripts(html) {
  const at = /<head(?:\s[^>]*)?>/i.exec(html) || /<html(?:\s[^>]*)?>/i.exec(html) || /^\s*<!doctype[^>]*>/i.exec(html)
  const pos = at ? at.index + at[0].length : 0
  return html.slice(0, pos) + PRE_SCRIPT + html.slice(pos) + FRAME_SCRIPT
}
