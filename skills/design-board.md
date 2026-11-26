# Design Board（设计画布）

用户要看设计稿、对比多个方向、或说「设计一个…」时，不要只贴代码：把每个方案做成一个 HTML 文件，用看板交付。

**默认只出一个方案。** 用户说「设计一个…」「做一个…」就只做一个方案、一个 HTML；只有用户明确要求对比、「几个方向」「多个方案」「A/B 方案」时才出多个，数量以用户说的为准（没说数量就两个），不要自作主张凑成三个。用户看完单个方案后想看别的方向，再按需追加。

## 硬规则：看板会自动校验，不合格的方案不显示

每个 html 一写出来，看板就检查下面四条。**不通过的方案不会出现在看板上**，同时你会在下一步自动收到 `<design-check>`，列出是哪个文件、哪条没过。收到后原地改那个文件，不要新建、不要改 id；改过就自动重新校验。

1. **必须有真交互**：页面里要有 `addEventListener` 或 `onclick` 之类的处理，做出能用的控件（见下面「最少交互」）。静态稿在 Play 里点不动，所以不放行。
2. **必须有深浅两套主题**：颜色全部走 CSS 变量，浅色放 `:root`，深色放 `:root[data-theme="dark"]`（或 `.dark` 类、`light-dark()`）。
3. **自包含**：样式、脚本、图片全部内联（图片用 `data:` 或 https 地址）。不要写相对路径的 `<img src="a.png">`、`<link href="a.css">`、`<script src="a.js">`，看板里加载不到。
4. **加载时不能报错**：沙箱里访问 `localStorage`/`sessionStorage`/`document.cookie` 会抛错，要用就包 try/catch，状态放内存变量。

## 视觉克制与文案禁忌（必须严格遵守）

所有产出的界面稿无论使用何种设计体系，都必须遵守以下克制底线：

- **禁止爹味灰字提示**：不要在标题下方、表单旁、卡片底部或空白处堆叠说教式的解释文案与冗余引导灰字（如「点击上方按钮切换视图」「提示：可在此处筛选」「支持实时预览与交互」等）。控件本身要做到自解释，没必要写的说明一律删掉。
- **禁止出现括号**：界面中的标题、导航、按钮、标签、表头、状态词与卡片文案**一律禁止使用中英文括号 `()` / `（）`**来做补充解释、中英夹杂注释或凑字数（不要写「设计系统（Design System）」「备注（选填）」「导出（PNG）」），直接写最干脆的主词。
- **禁止 AI slop 过度设计**：
  - 严禁使用卡片左侧竖向彩色粗边框装饰条（如 `border-left: 3px/4px solid <accent>`），统一用四边细边框、克制留白或简洁标签建立层次；
  - 严禁在界面文案、按钮或图标位使用 emoji，统一使用简洁线性 SVG 图标或纯文字；
  - 严禁滥用霓虹紫蓝渐变、弥散发光光斑背景、悬浮装饰胶囊、无意义玻璃拟态堆叠和假大空营销角标，保持结构克制、信息真实、比例精准。
- **禁止竖向排版文字**：禁止使用 `writing-mode: vertical-*`、单字强制折行竖排或旋转 90° 的装饰性竖排侧边文字，所有文本保持自然水平阅读流。

## 先判断类型，再动手

先想清这是哪一类，不同类型的做法不一样：

- **工具/看板/后台/表单**（OKR 看板、管理后台、数据面板）：当系统设计师。信息密度是重点，数字用等宽或 `font-variant-numeric: tabular-nums`，每个数据都要能点开、能筛选、能改。**用户选了设计体系，就以体系的章节节奏为准**：Apple 的黑色首屏接浅色内容区、浅灰底上放黑色大卡片，就是它的签名，要照做，不要为了「统一」把它抹平成一片灰白。没选体系时，工具类默认单一底色，白卡片或细线分区。
- **展示页/官网/落地页/海报**：当品牌设计师。一个首屏、3–6 个章节、真实文案、一个决定性的亮点，章节节奏按设计体系来。

不管哪种节奏，明暗块要成「整块」：整屏或整张卡片是深色，里面的字、图标、控件全部换深色块自己的前景色，不要在同一个控件组里一半黑一半白，也不要深色块里出现看不清的深色字。
- **手机/应用原型**：只有用户明确要求手机端、移动端或手机原型时才制作；否则只做用户要求的平台，不额外生成手机方案。明确要求后，当交互设计师处理真实屏幕和状态，点击区至少 44px。

### 最少交互（按类型，都要真能用）

- 工具/看板：至少三项——标签或视图切换、筛选或排序、展开收起或详情抽屉；数值悬停有提示更好。数据来自页面里的 JS 数组，交互改数据，视图跟着变。
- 展示页：导航高亮或平滑滚动、可展开的 FAQ/卡片、一个能提交并给出反馈的表单或按钮。
- 手机原型：底部导航切屏、列表进详情再返回、一个输入加校验提示。
- 所有可点元素都要有 `:hover`、`:active`、`:focus-visible` 样式和 `cursor:pointer`，状态切换用 CSS transition；不要留死按钮；链接用 `href="#"` 加 `preventDefault`，不要真跳转。

### 最小骨架（照着这个形状写，别从零发明）

```html
<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>方案标题</title>
<meta name="viewport" content="width=1280,height=800">
<style>
:root{--bg:#fff;--fg:#1d1d1f;--card:#f5f5f7;--line:#d2d2d7;--accent:#0071e3}
:root[data-theme="dark"]{--bg:#111113;--fg:#f5f5f7;--card:#1c1c1e;--line:#3a3a3c;--accent:#2997ff}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,system-ui,"PingFang SC","Microsoft YaHei",sans-serif}
.tab{cursor:pointer;transition:background .15s}.tab[aria-selected=true]{background:var(--accent);color:#fff}
</style></head><body>
<nav id="tabs"></nav><main id="view"></main>
<script>
const data = [/* 页面里的示例数据 */]
const state = { tab: 'all' }
function render() { /* 按 state 和 data 生成 #tabs 与 #view 的内容 */ }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]')
  if (!t) return
  state.tab = t.dataset.tab
  render()
})
render()
</script></body></html>
```

## 交付步骤

1. **严格按会话隔离目录**：所有 `board.json` 与 HTML 帧必须写入隐藏上下文 `<design-board dir="design/..."/>` 给出的**当前会话专属目录**；**严禁扫描、读取、复用或修改 `design/` 下的其他目录**（其他目录属于不同会话，跨会话读取会导致串台）。同一会话后续新增方案、重做或修改一律在该专属目录内完成。
2. **先写该目录下的 `board.json`** 列出所有方案（推荐：能提前占位、指定尺寸；不写也行，目录里的 `.html` 写出来会自动出现，标题取 `<title>`，尺寸取上面的 viewport meta，都没有就用文件名和 480×360）：

```json
{
  "title": "产品官网首页",
  "frames": [
    { "id": "home", "title": "官网首页", "file": "home.html", "width": 1280, "height": 800 }
  ]
}
```

   标题写成一句短话（看板标题、方案标题、页面名和便签标题都一样），不要用「·」「|」「—」把几段拼在一起，也不要用副标题重复拼接状态、版本、目录名等元信息。

   `id` 稳定唯一；`file` 相对 board.json；尺寸按用户明确要求的平台给（网页 1280×800；用户要求手机端时 390×844；弹窗 480×360）。

   方案多时可以分页、排序。不要主动生成便签或画布标题便签；只有用户明确要求便签/画布标题时才使用 `notes`。

   ```json
   {
     "title": "官网改版",
     "pages": [{ "id": "web", "name": "网页" }, { "id": "mobile", "name": "手机" }],
     "frames": [
       { "id": "a", "title": "网页首页", "file": "a.html", "width": 1280, "height": 800, "page": "web" },
       { "id": "b", "title": "手机首页", "file": "b.html", "width": 390, "height": 844, "page": "mobile" }
     ],
     "order": ["a", "b"],
     "notes": [
       { "text": "网页方向", "kind": "title", "page": "web", "x": 0, "y": -140 },
       { "text": "这里还要补空状态", "page": "web", "x": 1320, "y": 0 }
     ]
   }
   ```

   - `pages` 形成看板顶部的页签；`frames[].page` 不写就归第一页，写错也归第一页。
   - `order` 按帧 id 重排；没列出的帧排在后面。
   - `notes` 是画布上的只读便签：`kind: "title"` 是大标题，不写就是黄色便签，`x`/`y` 是画布坐标。用户不能在看板里改便签，要改就改 board.json。

3. **board.json 一写好就用 `present` 交付它**（只交付这一次）：右侧看板立刻打开，没写出来的方案显示「正在生成」。
4. 然后**一个方案一个文件**逐个写，写完一个就出现一个；不要攒到最后一起写，也不要启动任何浏览器或截图脚本做预览。
5. 之后改方案：**原地改对应的 html**，不要新建、不要改 id。看板只重载改动的帧，用户的缩放位置和标注都留着（改过的帧上的标注标成「过期」）。

## 做帧的注意事项

- 画布默认把帧当缩略图（不可点），用户点工具栏「交互」（Play）后才能直接点、滚；「单独查看」也可操作。所以首屏要一眼完整，**不要**用滚动触发的出现动画，否则默认状态下是一片空白。
- 视口就是 `width×height`：`100vh` 等于 `height`。长页面给足 `height`。
- 只有用户要求多个方案时，这些方案要**方向不同**（版式、字体、信息层次、组件形态），不是同一稿换个颜色。不要靠「一个浅一个深」来凑方向：深浅色不是「方向」，两套主题每个方案自己都要有。
- 深色下图片、阴影、边框、半透明层也要重新看一遍，别只换背景和文字。

## 交付前自检（逐条过，不合格先改完再交）

**严禁启动 Chrome / Chromium / Chrome for Testing / Playwright / Puppeteer 或任何浏览器脚本来截图或打开预览！** 右侧「设计画布」本身就是实时渲染预览器，并会在渲染后自动回传 `<design-check>` 运行时校验结果；起浏览器既慢又会在 macOS 触发钥匙串密码弹窗打断用户。

写完每个文件，只在终端跑一遍轻量文本检查，别凭感觉，也别写 Python/Node 脚本反复折腾：

```bash
cd design/<任务名>
grep -c "addEventListener\|onclick" *.html      # 每个 ≥ 1，否则没交互
grep -c 'data-theme\|\.dark\|light-dark' *.html # 每个 ≥ 1，否则没做主题
grep -n 'src="[^hd/#]\|href="[^h#]' *.html      # 不应有相对路径的资源
```

再对一遍：章节节奏是不是照设计体系的参考页来的（别自作主张抹平，也别把黑白拼在同一组控件里）？数据是不是具体可信（别写「指标 A / 指标 B」，别编没来源的「提速 10 倍」）？设计体系的 token 有没有贴进第一个 `<style>`？界面里有没有残留爹味灰字提示、中英文括号、emoji、卡片左侧粗彩条/AI slop 过度装饰或竖排文字（有就立刻删干净）？

## 用户反馈

用户在看板里选中元素或圈标注后，会自动作为上下文附在用户的下一条消息前（用户没有输入这段文字，也别在回复里复述这段标记）：

```xml
<design-feedback board="…">
  <note>…</note>                       <!-- 用户的补充说明（可能没有）-->
  <frame id="b" title="…" file="b.html">
    <selected selector="section.hero > h1" tag="h1" text="…"/>          <!-- 用户选中的元素；via="click" 是点选，via="box" 是拖拽框选（框一次会带出区域内一批元素，数量多是正常的，不代表逐个点了） -->
    <annotation type="rect" covers="a.btn（立即更新）; …">间距太小</annotation>   <!-- 矩形/画笔圈中的元素 + 备注 -->
    <annotation type="text">去掉关闭图标</annotation>
    <annotation type="rect" stale="true">…</annotation>                  <!-- 该帧此后改过，位置可能已变 -->
  </frame>
  <canvas><annotation type="text">整体偏暗</annotation></canvas>        <!-- 不属于任何方案 -->
</design-feedback>
```

- `selector` 是帧内的 CSS 选择器，直接去对应文件里定位；找不到时用 `text` 辅助。
- `covers` 是圈中的元素（已按重叠面积筛过，内层优先）；备注就是用户想怎么改。
- `locate="failed"` 表示没定位到元素，只能按备注理解。
- 逐条回应反馈，改完在对应文件里原地改；`stale` 的标注先确认是否还适用。
- 同一段上下文里还可能有 `<design-check>`：这是看板的自动校验结果（不是用户写的），列出被拦下的方案和原因，**先修好这些再处理别的**。

## 默认风格

用户消息里带 `<design-preset id="…" name="…"/>`（看板里选了设计体系）时，必须按它做：调工具 `design_preset`（`action:"read"`, `id`）依次读 `design`（DESIGN.md，视觉意图和禁忌）、`tokens`（tokens.css，把 `:root` 块原样贴进每个帧的第一个 `<style>`，之后一律用 `var(--*)`），再读 `components`（components.html，该体系自己的参考页：按钮、卡片、导航、章节节奏都照它的结构和类名写，不要凭印象自创）。读完再动手，开工前用一两句话说清这套的几条关键规则（主色用在哪、字重字距、圆角、禁忌）。字体栈里的专有字体（如 SF Pro）网页上不一定装了：保留原栈，前面补 `-apple-system, system-ui`，末尾补 `"PingFang SC", "Microsoft YaHei"` 以免中文掉成宋体。用户想看内置的 165 套设计体系，调 `action:"list"`（可带 `query` 按名称/类别筛）。

用户没指定风格时，默认按 Apple 的视觉语言设计：**加载技能 `design-board-apple-style`**，并调 `design_preset`（`id: "apple"`）读取 `tokens` 与 `components`（克制留白、纯黑与 `#f5f5f7` 浅灰交替章节节奏、SF Pro 紧凑排版层级、`#0071e3` 单一苹果蓝强调色、胶囊按钮与高对比度卡片规范）。

用户给了品牌/参考时以用户为准；做多方案对比时，只有其中一个方案需要贴这套风格，其余应走不同方向。
