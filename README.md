# dsh-design-board

[English](README.md) | [中文](README.zh.md)

**Interactive side-by-side design canvas plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).**

Turn DSH's right sidebar into a Figma-like design review canvas for AI-generated HTML prototypes: compare multiple directions side by side, inspect or marquee-select DOM elements, draw rectangle/text annotations, and send structured feedback directly back to the agent without copy-pasting code or screenshots.

---

## Features

- **Side-by-Side Infinite Canvas**: Powered by `@xyflow/react`, automatically opens when the agent writes or presents `design/<task>/board.json` (or any directory of `.html` frames). Supports zooming, panning, multi-page tabs (`pages`), frame ordering (`order`), and read-only canvas sticky notes (`notes`).
- **Visual Element Picking & Annotation Feedback**:
  - Click or drag-select DOM elements inside any frame to capture exact CSS selectors and text snippets.
  - Draw rectangle callouts or place text notes on frames or the canvas.
  - Feedback is injected silently before the next agent step as structured `<design-feedback>` XML — no cluttered chat prompts.
- **Interactive Play Mode & Light/Dark Theme Switching**: Toggle between annotation mode and live interactive mode (`Play`), or switch all frames between light and dark themes in one click.
- **Automatic Quality Gate (`<design-check>`)**: Automatically validates each generated HTML frame for real interactivity, light/dark theme support, self-contained assets, and runtime errors; failing frames notify the agent silently to fix in place.
- **165 Built-in Design System Presets (Apple Style by Default)**:
  - Browse, search, filter by category, and visually preview 165 curated design systems (Apple, Linear, Airbnb, Stripe, Notion, Vercel, and more) with full palettes, typography scales, spacing/radius tokens, and rendered preview pages.
  - Exposes the `design_preset` tool (`list` / `read`) to the agent so generated pages follow real `DESIGN.md`, `tokens.css`, and `components.html` specs.
  - Defaults to the built-in **Apple design system** (`design-board-apple-style` skill) when no preset is explicitly selected.
- **One-Click Export**: Export individual frames or the whole board to PNG, PDF, or a standalone HTML gallery.

---

## Compatibility

- **DeepSeek Harness (DSH)**: `>=0.2.0-0 <0.3.0` (tested against `dsh-v0.2.3-alpha.2`)
- **Surface**: DSH Web / Desktop right sidebar (`@deepseek-ai/dsh-client-ui-sidebar-right`)

---

## Installation

### Option 1: Install from a local clone (recommended before npm publish)

```bash
git clone https://github.com/Antares422/dsh-design-board.git
```

Then install it into your DSH profile via CLI:

```bash
dsh plugin add /absolute/path/to/dsh-design-board
```

Or in the DSH Desktop / Web UI: open **Plugins** -> **Add plugin** and select the cloned `dsh-design-board` directory.

> Prebuilt `index.js` and `client.js` bundles are committed in this repository, so no build step is required to install and use the plugin.

### Option 2: Install from npm (once published)

```bash
dsh plugin add dsh-design-board
```

---

## Usage

1. Enable **Design Board** in your DSH profile.
2. Ask the agent to design a page, dashboard, or compare multiple visual directions, for example:
   - *"Design a SaaS billing dashboard."*
   - *"Give me 2 distinct visual directions for an AI code editor landing page."*
3. The agent writes `design/<task>/board.json` and HTML frames. The right sidebar opens **Design Board** automatically.
4. Click the **Design System** button in the top-right toolbar to pick any of the 165 built-in presets, or pick elements / draw annotations on the canvas and send your next message — the agent receives your exact selections and notes automatically.

---

## Architecture

| Part | Entry | Responsibility |
| --- | --- | --- |
| Host plugin (Node / Cordis) | `index.js` (`src/host.js`) | Registers `/dsh-design-board/context` & `/dsh-design-board/binding` routes, injects hidden context on `agent/pre-step`, registers `design-board` & `design-board-apple-style` skills, and exposes the `design_preset` tool. |
| Client plugin (Browser) | `client.js` (`src/index.jsx`) | Registers the `design-board` tab in `ctx.sidebarRightTabs`, mounts `<Board />` into `sidebar.right.pane.tab`, and syncs session bindings & visual feedback to the host. |
| Bundle patch | `cordis.patch.yml` | Inserts the `design-board` plugin row into the DSH profile composition. |

---

## Development

```bash
npm install
npm run build   # Rebuild client.js and index.js via esbuild
npm test        # Run all Node built-in unit tests
```

---

## License

MIT License — see [LICENSE](LICENSE).

Built-in design system presets under `presets/` are compiled from open community design system specifications for agent reference and preview purposes.
