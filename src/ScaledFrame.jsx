import { useEffect, useRef, useState } from 'react'
import { BORDER } from './theme.js'

/** 按设计宽度渲染整页 HTML 再缩放到容器宽度；ratio 给定时只截取页面顶部（缩略图），否则按页面内容高度。无脚本，只看不交互。 */
export function ScaledFrame({ html, designWidth = 1280, ratio, title }) {
  const box = useRef(null)
  const [width, setWidth] = useState(0)
  const [natural, setNatural] = useState(0)
  const [pageBg, setPageBg] = useState('#fff')
  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // 先用很矮的高度加载再量内容高度，否则页面会被撑到初始高度
  useEffect(() => { setNatural(0); setPageBg('#fff') }, [html])
  const height = ratio ? designWidth * ratio : natural || 100
  const scale = width / designWidth
  return (
    <div ref={box} style={{ position: 'relative', boxSizing: 'border-box', width: '100%', height: height * scale, overflow: 'hidden', borderRadius: 8, border: `1px solid ${BORDER}`, background: pageBg }}>
      {width > 0 && (
        <iframe
          title={title} srcDoc={html} sandbox="allow-same-origin" scrolling="no"
          onLoad={(e) => {
            const doc = e.currentTarget.contentDocument
            if (!ratio) setNatural(doc?.documentElement.scrollHeight || 0)
            // 缩放后的取整缝隙会露出容器底色：取页面自己的底色，深色页就不会有白边
            const css = doc?.defaultView?.getComputedStyle.bind(doc.defaultView)
            const bg = css?.(doc.body).backgroundColor
            const root = css?.(doc.documentElement).backgroundColor
            const opaque = (v) => v && v !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(v)
            setPageBg(opaque(bg) ? bg : opaque(root) ? root : '#fff')
          }}
          style={{ width: designWidth, height, border: 'none', transformOrigin: '0 0', transform: `scale(${scale})`, pointerEvents: 'none' }}
        />
      )}
    </div>
  )
}
