# dsh-design-board（设计画布）

[English](README.md) | 中文

**面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 最新版本的开源交互式设计画布插件。**

将 DSH 右侧栏扩展为类 Figma 的多帧设计评审画布：并排展示 Agent 产出的交互式 HTML 设计稿，直接在画布上点选/框选 DOM 元素、绘制矩形与文字标注，并自动将结构化反馈回传给 Agent，无需复制代码或截图标注。

---

## 核心特性

- **多帧无限画布**：基于 `@xyflow/react`，当 Agent 写入或 `present` `design/<任务名>/board.json`（或任意 `.html` 设计目录）时自动打开右侧画布；支持缩放平移、多页签（`pages`）、排序（`order`）与画布便签（`notes`）。
- **所见即所得的元素指认与标注回传**：
  - 在画布帧内直接点选或拖拽框选 DOM 元素，精准捕获 CSS 选择器与文本片段。
  - 支持在帧上或画布空白处添加矩形框选与文字批注。
  - 选中与标注在下一轮对话前以隐藏 `<design-feedback>` 上下文自动注入给 Agent，不污染聊天输入框。
- **交互模式（Play）与深浅主题一键切换**：随时在「标注模式」与「可点击交互模式」间切换，并一键切换全画布帧的浅色 / 深色主题。
- **自动质量门禁（`<design-check>`）**：自动校验每个 HTML 帧是否包含真实交互、深浅双主题、资源自包含与零运行时报错；未通过的帧会静默通知 Agent 原地修复。
- **内置 165 套设计体系预设（默认 Apple 设计规范）**：
  - 内置 165 套精选品牌与风格设计体系（Apple、Linear、Airbnb、Stripe、Notion、Vercel 等），支持搜索、分类筛选、调色板/字体阶梯/圆角间距/完整参考页可视化预览。
  - 向 Agent 提供 `design_preset` 工具（`list` / `read`），按需读取真实 `DESIGN.md`、`tokens.css` 与 `components.html`。
  - 未显式选择体系时，默认通过内置技能 `design-board-apple-style` 采用 **Apple 设计规范**。
- **一键导出**：支持将单帧或整个画板导出为高清 PNG、多页 PDF 或单文件 HTML 画廊。

---

## 版本兼容

- **DeepSeek Harness (DSH)**：`>=0.2.0-0 <0.3.0`（已对齐最新 `dsh-v0.2.3-alpha.2` 插件规范）
- **运行端**：DSH Web / Desktop 右侧栏（`@deepseek-ai/dsh-client-ui-sidebar-right`）

---

## 安装方式

### 方式一：本地克隆安装（开箱即用）

```bash
git clone https://github.com/Antares422/dsh-design-board.git
```

通过 DSH CLI 安装到当前 Profile：

```bash
dsh plugin add /绝对路径/dsh-design-board
```

或在 DSH 桌面端 / Web 界面中点击 **插件（Plugins）** → **添加插件（Add plugin）**，选择克隆后的 `dsh-design-board` 目录即可。

> 仓库已包含预构建的 `index.js` 与 `client.js`，克隆后无需先执行构建即可直接安装使用。

### 方式二：通过 npm 安装（发布至 npm 后）

```bash
dsh plugin add dsh-design-board
```

---

## 使用流程

1. 在 DSH 中安装并启用 **设计画布（Design Board）** 插件。
2. 直接在对话里让 Agent 做页面或视觉方案，例如：
   - 「帮我设计一个 SaaS 账单管理后台」
   - 「给我两个不同视觉方向的 AI 编程工具官网首屏」
3. Agent 会自动写入 `design/<任务名>/board.json` 与自包含 HTML 帧，右侧栏自动展开设计画布。
4. 可在画布右上角点击「设计体系」切换 165 套内置风格；也可直接在帧上点选元素或画标注，随后在聊天框输入修改意见，Agent 会自动收到精准定位并原地更新。

---

## 架构概览

| 组成部分 | 入口文件 | 职责说明 |
| --- | --- | --- |
| 宿主端（Node / Cordis） | `index.js`（源码 `src/host.js`） | 注册 `/dsh-design-board/context` 与 `/dsh-design-board/binding` 路由；在 `agent/pre-step` 注入隐藏上下文；注册 `design-board` 与 `design-board-apple-style` 技能及 `design_preset` 工具。 |
| 浏览器端（Client） | `client.js`（源码 `src/index.jsx`） | 向 `ctx.sidebarRightTabs` 注册 `design-board` 标签页，在 `sidebar.right.pane.tab` 挂载 `<Board />`，负责会话目录锁定与标注反馈同步。 |
| 组合补丁 | `cordis.patch.yml` | 将 `design-board` 条目插入当前 DSH Profile。 |

---

## 本地开发与测试

```bash
npm install
npm run build   # 使用 esbuild 重新构建 client.js 与 index.js
npm test        # 运行全量单元测试（Node 内置 test runner）
```

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。
