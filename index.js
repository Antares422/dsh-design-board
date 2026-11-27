/* Generated file, do not edit by hand: source lives in src/host.js and skills/, run npm run build to regenerate. */

// src/presetTool.js
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
var PARTS = { design: "DESIGN.md", tokens: "tokens.css", components: "components.html", manifest: "components.manifest.json" };
function createPresetRunner(dirUrl) {
  let index;
  const loadIndex = async () => index ??= JSON.parse(await readFile(fileURLToPath(new URL("index.json", dirUrl)), "utf8"));
  return async function run({ action, id, part = "design", query }) {
    const all = await loadIndex();
    if (action === "list") {
      const q = String(query || "").trim().toLowerCase();
      const rows = all.filter((e) => !q || `${e.id} ${e.name} ${e.category} ${e.description}`.toLowerCase().includes(q));
      if (!rows.length) return `\u6CA1\u6709\u5339\u914D\u300C${query}\u300D\u7684\u8BBE\u8BA1\u4F53\u7CFB`;
      return rows.map((e) => `${e.id} | ${e.name} | ${e.category} | ${e.description.slice(0, 80)}`).join("\n");
    }
    if (action !== "read") throw new Error("action \u53EA\u80FD\u662F list \u6216 read");
    const entry = all.find((e) => e.id === id);
    if (!entry) throw new Error(`\u6CA1\u6709\u8BBE\u8BA1\u4F53\u7CFB\u300C${id}\u300D\uFF0C\u5148\u7528 action:"list" \u67E5\u770B`);
    const file = PARTS[part];
    if (!file) throw new Error(`part \u53EA\u80FD\u662F ${Object.keys(PARTS).join(" / ")}`);
    try {
      return await readFile(fileURLToPath(new URL(`${entry.id}/${file}`, dirUrl)), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      throw new Error(`\u300C${entry.name}\u300D\u6CA1\u6709 ${file}\uFF08\u5B98\u65B9\u6E90\u91CC\u5C31\u7F3A\uFF09\uFF0C\u6539\u8BFB design \u6216 tokens`);
    }
  };
}

// src/hiddenContext.js
var MAX_TEXT = 6e4;
var HEADER = "\u4EE5\u4E0B\u662F Design Board\uFF08\u8BBE\u8BA1\u753B\u5E03\uFF09\u770B\u677F\u91CC\u5F53\u524D\u7ED1\u5B9A\u7684\u8BBE\u8BA1\u76EE\u5F55\u3001\u9009\u62E9\u3001\u6807\u6CE8\u3001\u8BBE\u8BA1\u4F53\u7CFB\u548C\u81EA\u52A8\u6821\u9A8C\u7ED3\u679C\u3002\u7528\u6237\u6CA1\u6709\u8F93\u5165\u8FD9\u6BB5\u6587\u5B57\uFF0C\u662F\u754C\u9762\u81EA\u52A8\u9644\u5E26\u7684\uFF1B\u8BF7\u6309\u5B83\u7406\u89E3\u7528\u6237\u63A5\u4E0B\u6765\u7684\u6D88\u606F\uFF0C\u5176\u4E2D\u82E5\u5E26\u6709 <design-board> \u5219\u672C\u4F1A\u8BDD\u6240\u6709\u8BBE\u8BA1\u4EA7\u51FA\u4E0E\u4FEE\u6539\u5FC5\u987B\u56FA\u5B9A\u5728\u8BE5\u76EE\u5F55\u5185\uFF08\u4E0D\u8981\u65B0\u5EFA\u7B2C\u4E8C\u4E2A design \u5B50\u76EE\u5F55\uFF09\uFF0C<design-check> \u662F\u770B\u677F\u7684\u6821\u9A8C\u7ED3\u679C\uFF0C\u8981\u5148\u7167\u7740\u4FEE\u597D\uFF1A";
var CLEARED = "Design Board\uFF08\u8BBE\u8BA1\u753B\u5E03\uFF09\u770B\u677F\u91CC\u4E4B\u524D\u9644\u5E26\u7684\u9009\u62E9\u3001\u6807\u6CE8\u3001\u8BBE\u8BA1\u4F53\u7CFB\u548C\u6821\u9A8C\u63D0\u793A\u5DF2\u6E05\u7A7A\uFF0C\u4E4B\u524D\u90A3\u4EFD\u4E0D\u518D\u6709\u6548\u3002";
function createContextStore() {
  const latest = /* @__PURE__ */ new Map();
  const injected = /* @__PURE__ */ new Map();
  return {
    peek: (sessionId) => latest.get(sessionId),
    set: (sessionId, text2) => {
      latest.set(sessionId, text2);
    },
    ensure(sessionId, text2) {
      if (!text2) return;
      const current = latest.get(sessionId);
      if (!current) {
        latest.set(sessionId, text2);
        return;
      }
      if (text2.startsWith("<design-board ") && !current.includes("<design-board ")) {
        latest.set(sessionId, `${text2}
${current}`);
      }
    },
    take(sessionId) {
      const text2 = latest.get(sessionId);
      if (text2 === void 0 || text2 === (injected.get(sessionId) ?? "")) return void 0;
      injected.set(sessionId, text2);
      return text2 === "" ? CLEARED : `${HEADER}
${text2}`;
    }
  };
}
var readBody = async (req) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
};
function createContextHandler(store) {
  return async (req, res) => {
    const reply = (status) => {
      res.writeHead(status);
      res.end();
    };
    if (req.method !== "POST") return reply(405);
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch {
      return reply(400);
    }
    if (typeof data?.sessionId !== "string" || typeof data?.text !== "string") return reply(400);
    if (data.text.length > MAX_TEXT) return reply(413);
    store.set(data.sessionId, data.text);
    return reply(204);
  };
}

// src/feedback.js
var escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
var escapeAttr = (s) => escapeText(s).replace(/"/g, "&quot;");
var attrs = (pairs) => pairs.filter(([, v]) => v !== void 0 && v !== "").map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");
var buildBoardBinding = (boardPath) => {
  if (!boardPath) return "";
  const dir = String(boardPath).replace(/\/board\.json$/, "");
  return `<design-board${attrs([["dir", dir], ["board", boardPath]])}/>`;
};

// src/sessionDesign.js
var KEY_PREFIX = "design-board:session:";
var DESIGN_FILE = /\.(?:html?)$/i;
var storageValue = (storage, key) => {
  try {
    return storage?.getItem(key) || void 0;
  } catch {
    return void 0;
  }
};
var saveStorageValue = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
  } catch {
  }
};
var removeStorageValue = (storage, key) => {
  try {
    storage?.removeItem?.(key);
  } catch {
  }
};
var stripMacPrivate = (p) => p.replace(/^\/private(?=\/(?:tmp|var)(?:\/|$))/, "");
var normalizeSlashes = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "");
function sessionDesignSlug(sessionId) {
  if (typeof sessionId !== "string") return void 0;
  const clean = sessionId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+|\.+$/g, "");
  return clean || void 0;
}
function sessionBoardPath(sessionId) {
  const slug = sessionDesignSlug(sessionId);
  return slug ? `design/${slug}/board.json` : void 0;
}
function isDesignBoardSkillRead(exec) {
  if (!exec || typeof exec !== "object" || exec.name !== "skill") return false;
  let args = exec.arguments;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return false;
    }
  }
  if (!args || typeof args !== "object") return false;
  return (args.name ?? args.skill ?? args.id) === "design-board";
}
function boardPathOfDesignFile(filePath, cwd) {
  if (typeof filePath !== "string" || !filePath.trim()) return void 0;
  let rel = normalizeSlashes(filePath.trim());
  if (rel.startsWith("/")) {
    if (typeof cwd !== "string" || !cwd.trim()) return void 0;
    const root = stripMacPrivate(normalizeSlashes(cwd.trim()));
    const target = stripMacPrivate(rel);
    if (!target.startsWith(root + "/")) return void 0;
    rel = target.slice(root.length + 1);
  }
  rel = rel.replace(/^(?:\.\/)+/, "");
  const parts = rel.split("/");
  if (parts.length !== 3 || parts.some((seg) => !seg || seg === "." || seg === "..")) return void 0;
  if (parts[0] !== "design") return void 0;
  if (parts[2] !== "board.json" && !DESIGN_FILE.test(parts[2])) return void 0;
  return `design/${parts[1]}/board.json`;
}
function extractToolDesignPath(exec) {
  if (!exec || typeof exec !== "object") return void 0;
  let args = exec.arguments;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return void 0;
    }
  }
  if (!args || typeof args !== "object") return void 0;
  let rawPath;
  if (exec.name === "write" || exec.name === "edit") rawPath = args.file_path;
  else if (exec.name === "str_replace_editor" && args.command && args.command !== "view") rawPath = args.path;
  if (typeof rawPath !== "string") return void 0;
  return boardPathOfDesignFile(rawPath, exec.agent?.session?.header?.cwd);
}
var defaultStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : void 0;
  } catch {
    return void 0;
  }
};
function createSessionDesignBindings(storage = defaultStorage()) {
  const bindings = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  const keyOf = (sessionId) => `${KEY_PREFIX}${sessionId}`;
  const notify = (sessionId, boardPath) => {
    const set = listeners.get(sessionId);
    if (!set) return;
    for (const fn of [...set]) fn(boardPath);
  };
  return {
    get(sessionId) {
      if (!sessionId) return void 0;
      const current = bindings.get(sessionId) || storageValue(storage, keyOf(sessionId));
      if (current) bindings.set(sessionId, current);
      return current;
    },
    bind(sessionId, boardPath) {
      if (!sessionId || typeof boardPath !== "string" || !boardPath) return false;
      const normalized = boardPathOfDesignFile(boardPath) || boardPath;
      const current = this.get(sessionId);
      if (current && current !== normalized) return false;
      if (current === normalized) return true;
      bindings.set(sessionId, normalized);
      saveStorageValue(storage, keyOf(sessionId), normalized);
      notify(sessionId, normalized);
      return true;
    },
    clear(sessionId) {
      if (!sessionId) return false;
      const had = Boolean(bindings.get(sessionId) || storageValue(storage, keyOf(sessionId)));
      bindings.delete(sessionId);
      removeStorageValue(storage, keyOf(sessionId));
      if (had) notify(sessionId, void 0);
      return had;
    },
    subscribe(sessionId, listener) {
      if (!sessionId || typeof listener !== "function") return () => {
      };
      let set = listeners.get(sessionId);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        listeners.set(sessionId, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(sessionId);
      };
    }
  };
}
var readBody2 = async (req) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
};
var sendJson = (res, status, payload) => {
  const text2 = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(text2);
};
function createBindingHandler(bindings, onBind, isBlankSession) {
  return async (req, res) => {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const sessionId = url.searchParams.get("sessionId") || "";
      if (!sessionId) return sendJson(res, 400, { error: "missing sessionId" });
      if (await isBlankSession?.(sessionId)) {
        bindings.clear?.(sessionId);
        return sendJson(res, 200, { boardPath: null });
      }
      return sendJson(res, 200, { boardPath: bindings.get(sessionId) ?? null });
    }
    if (req.method === "POST") {
      let data;
      try {
        data = JSON.parse(await readBody2(req));
      } catch {
        return sendJson(res, 400, { error: "invalid json" });
      }
      if (typeof data?.sessionId !== "string" || !data.sessionId || typeof data?.boardPath !== "string" || !data.boardPath) {
        return sendJson(res, 400, { error: "invalid payload" });
      }
      if (await isBlankSession?.(data.sessionId)) {
        bindings.clear?.(data.sessionId);
        return sendJson(res, 200, { accepted: false, boardPath: null });
      }
      const before = bindings.get(data.sessionId);
      const accepted = bindings.bind(data.sessionId, data.boardPath);
      const current = bindings.get(data.sessionId) ?? null;
      if (accepted && !before && current) onBind?.(data.sessionId, current);
      return sendJson(res, 200, { accepted, boardPath: current });
    }
    res.writeHead(405);
    res.end();
  };
}

// skills/design-board.md
var design_board_default = '# Design Board\uFF08\u8BBE\u8BA1\u753B\u5E03\uFF09\n\n\u7528\u6237\u8981\u770B\u8BBE\u8BA1\u7A3F\u3001\u5BF9\u6BD4\u591A\u4E2A\u65B9\u5411\u3001\u6216\u8BF4\u300C\u8BBE\u8BA1\u4E00\u4E2A\u2026\u300D\u65F6\uFF0C\u4E0D\u8981\u53EA\u8D34\u4EE3\u7801\uFF1A\u628A\u6BCF\u4E2A\u65B9\u6848\u505A\u6210\u4E00\u4E2A HTML \u6587\u4EF6\uFF0C\u7528\u770B\u677F\u4EA4\u4ED8\u3002\n\n**\u9ED8\u8BA4\u53EA\u51FA\u4E00\u4E2A\u65B9\u6848\u3002** \u7528\u6237\u8BF4\u300C\u8BBE\u8BA1\u4E00\u4E2A\u2026\u300D\u300C\u505A\u4E00\u4E2A\u2026\u300D\u5C31\u53EA\u505A\u4E00\u4E2A\u65B9\u6848\u3001\u4E00\u4E2A HTML\uFF1B\u53EA\u6709\u7528\u6237\u660E\u786E\u8981\u6C42\u5BF9\u6BD4\u3001\u300C\u51E0\u4E2A\u65B9\u5411\u300D\u300C\u591A\u4E2A\u65B9\u6848\u300D\u300CA/B \u65B9\u6848\u300D\u65F6\u624D\u51FA\u591A\u4E2A\uFF0C\u6570\u91CF\u4EE5\u7528\u6237\u8BF4\u7684\u4E3A\u51C6\uFF08\u6CA1\u8BF4\u6570\u91CF\u5C31\u4E24\u4E2A\uFF09\uFF0C\u4E0D\u8981\u81EA\u4F5C\u4E3B\u5F20\u51D1\u6210\u4E09\u4E2A\u3002\u7528\u6237\u770B\u5B8C\u5355\u4E2A\u65B9\u6848\u540E\u60F3\u770B\u522B\u7684\u65B9\u5411\uFF0C\u518D\u6309\u9700\u8FFD\u52A0\u3002\n\n## \u786C\u89C4\u5219\uFF1A\u770B\u677F\u4F1A\u81EA\u52A8\u6821\u9A8C\uFF0C\u4E0D\u5408\u683C\u7684\u65B9\u6848\u4E0D\u663E\u793A\n\n\u6BCF\u4E2A html \u4E00\u5199\u51FA\u6765\uFF0C\u770B\u677F\u5C31\u68C0\u67E5\u4E0B\u9762\u56DB\u6761\u3002**\u4E0D\u901A\u8FC7\u7684\u65B9\u6848\u4E0D\u4F1A\u51FA\u73B0\u5728\u770B\u677F\u4E0A**\uFF0C\u540C\u65F6\u4F60\u4F1A\u5728\u4E0B\u4E00\u6B65\u81EA\u52A8\u6536\u5230 `<design-check>`\uFF0C\u5217\u51FA\u662F\u54EA\u4E2A\u6587\u4EF6\u3001\u54EA\u6761\u6CA1\u8FC7\u3002\u6536\u5230\u540E\u539F\u5730\u6539\u90A3\u4E2A\u6587\u4EF6\uFF0C\u4E0D\u8981\u65B0\u5EFA\u3001\u4E0D\u8981\u6539 id\uFF1B\u6539\u8FC7\u5C31\u81EA\u52A8\u91CD\u65B0\u6821\u9A8C\u3002\n\n1. **\u5FC5\u987B\u6709\u771F\u4EA4\u4E92**\uFF1A\u9875\u9762\u91CC\u8981\u6709 `addEventListener` \u6216 `onclick` \u4E4B\u7C7B\u7684\u5904\u7406\uFF0C\u505A\u51FA\u80FD\u7528\u7684\u63A7\u4EF6\uFF08\u89C1\u4E0B\u9762\u300C\u6700\u5C11\u4EA4\u4E92\u300D\uFF09\u3002\u9759\u6001\u7A3F\u5728 Play \u91CC\u70B9\u4E0D\u52A8\uFF0C\u6240\u4EE5\u4E0D\u653E\u884C\u3002\n2. **\u5FC5\u987B\u6709\u6DF1\u6D45\u4E24\u5957\u4E3B\u9898**\uFF1A\u989C\u8272\u5168\u90E8\u8D70 CSS \u53D8\u91CF\uFF0C\u6D45\u8272\u653E `:root`\uFF0C\u6DF1\u8272\u653E `:root[data-theme="dark"]`\uFF08\u6216 `.dark` \u7C7B\u3001`light-dark()`\uFF09\u3002\n3. **\u81EA\u5305\u542B**\uFF1A\u6837\u5F0F\u3001\u811A\u672C\u3001\u56FE\u7247\u5168\u90E8\u5185\u8054\uFF08\u56FE\u7247\u7528 `data:` \u6216 https \u5730\u5740\uFF09\u3002\u4E0D\u8981\u5199\u76F8\u5BF9\u8DEF\u5F84\u7684 `<img src="a.png">`\u3001`<link href="a.css">`\u3001`<script src="a.js">`\uFF0C\u770B\u677F\u91CC\u52A0\u8F7D\u4E0D\u5230\u3002\n4. **\u52A0\u8F7D\u65F6\u4E0D\u80FD\u62A5\u9519**\uFF1A\u6C99\u7BB1\u91CC\u8BBF\u95EE `localStorage`/`sessionStorage`/`document.cookie` \u4F1A\u629B\u9519\uFF0C\u8981\u7528\u5C31\u5305 try/catch\uFF0C\u72B6\u6001\u653E\u5185\u5B58\u53D8\u91CF\u3002\n\n## \u89C6\u89C9\u514B\u5236\u4E0E\u6587\u6848\u7981\u5FCC\uFF08\u5FC5\u987B\u4E25\u683C\u9075\u5B88\uFF09\n\n\u6240\u6709\u4EA7\u51FA\u7684\u754C\u9762\u7A3F\u65E0\u8BBA\u4F7F\u7528\u4F55\u79CD\u8BBE\u8BA1\u4F53\u7CFB\uFF0C\u90FD\u5FC5\u987B\u9075\u5B88\u4EE5\u4E0B\u514B\u5236\u5E95\u7EBF\uFF1A\n\n- **\u7981\u6B62\u7239\u5473\u7070\u5B57\u63D0\u793A**\uFF1A\u4E0D\u8981\u5728\u6807\u9898\u4E0B\u65B9\u3001\u8868\u5355\u65C1\u3001\u5361\u7247\u5E95\u90E8\u6216\u7A7A\u767D\u5904\u5806\u53E0\u8BF4\u6559\u5F0F\u7684\u89E3\u91CA\u6587\u6848\u4E0E\u5197\u4F59\u5F15\u5BFC\u7070\u5B57\uFF08\u5982\u300C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u5207\u6362\u89C6\u56FE\u300D\u300C\u63D0\u793A\uFF1A\u53EF\u5728\u6B64\u5904\u7B5B\u9009\u300D\u300C\u652F\u6301\u5B9E\u65F6\u9884\u89C8\u4E0E\u4EA4\u4E92\u300D\u7B49\uFF09\u3002\u63A7\u4EF6\u672C\u8EAB\u8981\u505A\u5230\u81EA\u89E3\u91CA\uFF0C\u6CA1\u5FC5\u8981\u5199\u7684\u8BF4\u660E\u4E00\u5F8B\u5220\u6389\u3002\n- **\u7981\u6B62\u51FA\u73B0\u62EC\u53F7**\uFF1A\u754C\u9762\u4E2D\u7684\u6807\u9898\u3001\u5BFC\u822A\u3001\u6309\u94AE\u3001\u6807\u7B7E\u3001\u8868\u5934\u3001\u72B6\u6001\u8BCD\u4E0E\u5361\u7247\u6587\u6848**\u4E00\u5F8B\u7981\u6B62\u4F7F\u7528\u4E2D\u82F1\u6587\u62EC\u53F7 `()` / `\uFF08\uFF09`**\u6765\u505A\u8865\u5145\u89E3\u91CA\u3001\u4E2D\u82F1\u5939\u6742\u6CE8\u91CA\u6216\u51D1\u5B57\u6570\uFF08\u4E0D\u8981\u5199\u300C\u8BBE\u8BA1\u7CFB\u7EDF\uFF08Design System\uFF09\u300D\u300C\u5907\u6CE8\uFF08\u9009\u586B\uFF09\u300D\u300C\u5BFC\u51FA\uFF08PNG\uFF09\u300D\uFF09\uFF0C\u76F4\u63A5\u5199\u6700\u5E72\u8106\u7684\u4E3B\u8BCD\u3002\n- **\u7981\u6B62 AI slop \u8FC7\u5EA6\u8BBE\u8BA1**\uFF1A\n  - \u4E25\u7981\u4F7F\u7528\u5361\u7247\u5DE6\u4FA7\u7AD6\u5411\u5F69\u8272\u7C97\u8FB9\u6846\u88C5\u9970\u6761\uFF08\u5982 `border-left: 3px/4px solid <accent>`\uFF09\uFF0C\u7EDF\u4E00\u7528\u56DB\u8FB9\u7EC6\u8FB9\u6846\u3001\u514B\u5236\u7559\u767D\u6216\u7B80\u6D01\u6807\u7B7E\u5EFA\u7ACB\u5C42\u6B21\uFF1B\n  - \u4E25\u7981\u5728\u754C\u9762\u6587\u6848\u3001\u6309\u94AE\u6216\u56FE\u6807\u4F4D\u4F7F\u7528 emoji\uFF0C\u7EDF\u4E00\u4F7F\u7528\u7B80\u6D01\u7EBF\u6027 SVG \u56FE\u6807\u6216\u7EAF\u6587\u5B57\uFF1B\n  - \u4E25\u7981\u6EE5\u7528\u9713\u8679\u7D2B\u84DD\u6E10\u53D8\u3001\u5F25\u6563\u53D1\u5149\u5149\u6591\u80CC\u666F\u3001\u60AC\u6D6E\u88C5\u9970\u80F6\u56CA\u3001\u65E0\u610F\u4E49\u73BB\u7483\u62DF\u6001\u5806\u53E0\u548C\u5047\u5927\u7A7A\u8425\u9500\u89D2\u6807\uFF0C\u4FDD\u6301\u7ED3\u6784\u514B\u5236\u3001\u4FE1\u606F\u771F\u5B9E\u3001\u6BD4\u4F8B\u7CBE\u51C6\u3002\n- **\u7981\u6B62\u7AD6\u5411\u6392\u7248\u6587\u5B57**\uFF1A\u7981\u6B62\u4F7F\u7528 `writing-mode: vertical-*`\u3001\u5355\u5B57\u5F3A\u5236\u6298\u884C\u7AD6\u6392\u6216\u65CB\u8F6C 90\xB0 \u7684\u88C5\u9970\u6027\u7AD6\u6392\u4FA7\u8FB9\u6587\u5B57\uFF0C\u6240\u6709\u6587\u672C\u4FDD\u6301\u81EA\u7136\u6C34\u5E73\u9605\u8BFB\u6D41\u3002\n\n## \u5148\u5224\u65AD\u7C7B\u578B\uFF0C\u518D\u52A8\u624B\n\n\u5148\u60F3\u6E05\u8FD9\u662F\u54EA\u4E00\u7C7B\uFF0C\u4E0D\u540C\u7C7B\u578B\u7684\u505A\u6CD5\u4E0D\u4E00\u6837\uFF1A\n\n- **\u5DE5\u5177/\u770B\u677F/\u540E\u53F0/\u8868\u5355**\uFF08OKR \u770B\u677F\u3001\u7BA1\u7406\u540E\u53F0\u3001\u6570\u636E\u9762\u677F\uFF09\uFF1A\u5F53\u7CFB\u7EDF\u8BBE\u8BA1\u5E08\u3002\u4FE1\u606F\u5BC6\u5EA6\u662F\u91CD\u70B9\uFF0C\u6570\u5B57\u7528\u7B49\u5BBD\u6216 `font-variant-numeric: tabular-nums`\uFF0C\u6BCF\u4E2A\u6570\u636E\u90FD\u8981\u80FD\u70B9\u5F00\u3001\u80FD\u7B5B\u9009\u3001\u80FD\u6539\u3002**\u7528\u6237\u9009\u4E86\u8BBE\u8BA1\u4F53\u7CFB\uFF0C\u5C31\u4EE5\u4F53\u7CFB\u7684\u7AE0\u8282\u8282\u594F\u4E3A\u51C6**\uFF1AApple \u7684\u9ED1\u8272\u9996\u5C4F\u63A5\u6D45\u8272\u5185\u5BB9\u533A\u3001\u6D45\u7070\u5E95\u4E0A\u653E\u9ED1\u8272\u5927\u5361\u7247\uFF0C\u5C31\u662F\u5B83\u7684\u7B7E\u540D\uFF0C\u8981\u7167\u505A\uFF0C\u4E0D\u8981\u4E3A\u4E86\u300C\u7EDF\u4E00\u300D\u628A\u5B83\u62B9\u5E73\u6210\u4E00\u7247\u7070\u767D\u3002\u6CA1\u9009\u4F53\u7CFB\u65F6\uFF0C\u5DE5\u5177\u7C7B\u9ED8\u8BA4\u5355\u4E00\u5E95\u8272\uFF0C\u767D\u5361\u7247\u6216\u7EC6\u7EBF\u5206\u533A\u3002\n- **\u5C55\u793A\u9875/\u5B98\u7F51/\u843D\u5730\u9875/\u6D77\u62A5**\uFF1A\u5F53\u54C1\u724C\u8BBE\u8BA1\u5E08\u3002\u4E00\u4E2A\u9996\u5C4F\u30013\u20136 \u4E2A\u7AE0\u8282\u3001\u771F\u5B9E\u6587\u6848\u3001\u4E00\u4E2A\u51B3\u5B9A\u6027\u7684\u4EAE\u70B9\uFF0C\u7AE0\u8282\u8282\u594F\u6309\u8BBE\u8BA1\u4F53\u7CFB\u6765\u3002\n\n\u4E0D\u7BA1\u54EA\u79CD\u8282\u594F\uFF0C\u660E\u6697\u5757\u8981\u6210\u300C\u6574\u5757\u300D\uFF1A\u6574\u5C4F\u6216\u6574\u5F20\u5361\u7247\u662F\u6DF1\u8272\uFF0C\u91CC\u9762\u7684\u5B57\u3001\u56FE\u6807\u3001\u63A7\u4EF6\u5168\u90E8\u6362\u6DF1\u8272\u5757\u81EA\u5DF1\u7684\u524D\u666F\u8272\uFF0C\u4E0D\u8981\u5728\u540C\u4E00\u4E2A\u63A7\u4EF6\u7EC4\u91CC\u4E00\u534A\u9ED1\u4E00\u534A\u767D\uFF0C\u4E5F\u4E0D\u8981\u6DF1\u8272\u5757\u91CC\u51FA\u73B0\u770B\u4E0D\u6E05\u7684\u6DF1\u8272\u5B57\u3002\n- **\u624B\u673A/\u5E94\u7528\u539F\u578B**\uFF1A\u53EA\u6709\u7528\u6237\u660E\u786E\u8981\u6C42\u624B\u673A\u7AEF\u3001\u79FB\u52A8\u7AEF\u6216\u624B\u673A\u539F\u578B\u65F6\u624D\u5236\u4F5C\uFF1B\u5426\u5219\u53EA\u505A\u7528\u6237\u8981\u6C42\u7684\u5E73\u53F0\uFF0C\u4E0D\u989D\u5916\u751F\u6210\u624B\u673A\u65B9\u6848\u3002\u660E\u786E\u8981\u6C42\u540E\uFF0C\u5F53\u4EA4\u4E92\u8BBE\u8BA1\u5E08\u5904\u7406\u771F\u5B9E\u5C4F\u5E55\u548C\u72B6\u6001\uFF0C\u70B9\u51FB\u533A\u81F3\u5C11 44px\u3002\n\n### \u6700\u5C11\u4EA4\u4E92\uFF08\u6309\u7C7B\u578B\uFF0C\u90FD\u8981\u771F\u80FD\u7528\uFF09\n\n- \u5DE5\u5177/\u770B\u677F\uFF1A\u81F3\u5C11\u4E09\u9879\u2014\u2014\u6807\u7B7E\u6216\u89C6\u56FE\u5207\u6362\u3001\u7B5B\u9009\u6216\u6392\u5E8F\u3001\u5C55\u5F00\u6536\u8D77\u6216\u8BE6\u60C5\u62BD\u5C49\uFF1B\u6570\u503C\u60AC\u505C\u6709\u63D0\u793A\u66F4\u597D\u3002\u6570\u636E\u6765\u81EA\u9875\u9762\u91CC\u7684 JS \u6570\u7EC4\uFF0C\u4EA4\u4E92\u6539\u6570\u636E\uFF0C\u89C6\u56FE\u8DDF\u7740\u53D8\u3002\n- \u5C55\u793A\u9875\uFF1A\u5BFC\u822A\u9AD8\u4EAE\u6216\u5E73\u6ED1\u6EDA\u52A8\u3001\u53EF\u5C55\u5F00\u7684 FAQ/\u5361\u7247\u3001\u4E00\u4E2A\u80FD\u63D0\u4EA4\u5E76\u7ED9\u51FA\u53CD\u9988\u7684\u8868\u5355\u6216\u6309\u94AE\u3002\n- \u624B\u673A\u539F\u578B\uFF1A\u5E95\u90E8\u5BFC\u822A\u5207\u5C4F\u3001\u5217\u8868\u8FDB\u8BE6\u60C5\u518D\u8FD4\u56DE\u3001\u4E00\u4E2A\u8F93\u5165\u52A0\u6821\u9A8C\u63D0\u793A\u3002\n- \u6240\u6709\u53EF\u70B9\u5143\u7D20\u90FD\u8981\u6709 `:hover`\u3001`:active`\u3001`:focus-visible` \u6837\u5F0F\u548C `cursor:pointer`\uFF0C\u72B6\u6001\u5207\u6362\u7528 CSS transition\uFF1B\u4E0D\u8981\u7559\u6B7B\u6309\u94AE\uFF1B\u94FE\u63A5\u7528 `href="#"` \u52A0 `preventDefault`\uFF0C\u4E0D\u8981\u771F\u8DF3\u8F6C\u3002\n\n### \u6700\u5C0F\u9AA8\u67B6\uFF08\u7167\u7740\u8FD9\u4E2A\u5F62\u72B6\u5199\uFF0C\u522B\u4ECE\u96F6\u53D1\u660E\uFF09\n\n```html\n<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><title>\u65B9\u6848\u6807\u9898</title>\n<meta name="viewport" content="width=1280,height=800">\n<style>\n:root{--bg:#fff;--fg:#1d1d1f;--card:#f5f5f7;--line:#d2d2d7;--accent:#0071e3}\n:root[data-theme="dark"]{--bg:#111113;--fg:#f5f5f7;--card:#1c1c1e;--line:#3a3a3c;--accent:#2997ff}\nbody{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,system-ui,"PingFang SC","Microsoft YaHei",sans-serif}\n.tab{cursor:pointer;transition:background .15s}.tab[aria-selected=true]{background:var(--accent);color:#fff}\n</style></head><body>\n<nav id="tabs"></nav><main id="view"></main>\n<script>\nconst data = [/* \u9875\u9762\u91CC\u7684\u793A\u4F8B\u6570\u636E */]\nconst state = { tab: \'all\' }\nfunction render() { /* \u6309 state \u548C data \u751F\u6210 #tabs \u4E0E #view \u7684\u5185\u5BB9 */ }\ndocument.addEventListener(\'click\', e => {\n  const t = e.target.closest(\'[data-tab]\')\n  if (!t) return\n  state.tab = t.dataset.tab\n  render()\n})\nrender()\n</script></body></html>\n```\n\n## \u4EA4\u4ED8\u6B65\u9AA4\n\n1. **\u4E25\u683C\u6309\u4F1A\u8BDD\u9694\u79BB\u76EE\u5F55**\uFF1A\u6240\u6709 `board.json` \u4E0E HTML \u5E27\u5FC5\u987B\u5199\u5165\u9690\u85CF\u4E0A\u4E0B\u6587 `<design-board dir="design/..."/>` \u7ED9\u51FA\u7684**\u5F53\u524D\u4F1A\u8BDD\u4E13\u5C5E\u76EE\u5F55**\uFF1B**\u4E25\u7981\u626B\u63CF\u3001\u8BFB\u53D6\u3001\u590D\u7528\u6216\u4FEE\u6539 `design/` \u4E0B\u7684\u5176\u4ED6\u76EE\u5F55**\uFF08\u5176\u4ED6\u76EE\u5F55\u5C5E\u4E8E\u4E0D\u540C\u4F1A\u8BDD\uFF0C\u8DE8\u4F1A\u8BDD\u8BFB\u53D6\u4F1A\u5BFC\u81F4\u4E32\u53F0\uFF09\u3002\u540C\u4E00\u4F1A\u8BDD\u540E\u7EED\u65B0\u589E\u65B9\u6848\u3001\u91CD\u505A\u6216\u4FEE\u6539\u4E00\u5F8B\u5728\u8BE5\u4E13\u5C5E\u76EE\u5F55\u5185\u5B8C\u6210\u3002\n2. **\u5148\u5199\u8BE5\u76EE\u5F55\u4E0B\u7684 `board.json`** \u5217\u51FA\u6240\u6709\u65B9\u6848\uFF08\u63A8\u8350\uFF1A\u80FD\u63D0\u524D\u5360\u4F4D\u3001\u6307\u5B9A\u5C3A\u5BF8\uFF1B\u4E0D\u5199\u4E5F\u884C\uFF0C\u76EE\u5F55\u91CC\u7684 `.html` \u5199\u51FA\u6765\u4F1A\u81EA\u52A8\u51FA\u73B0\uFF0C\u6807\u9898\u53D6 `<title>`\uFF0C\u5C3A\u5BF8\u53D6\u4E0A\u9762\u7684 viewport meta\uFF0C\u90FD\u6CA1\u6709\u5C31\u7528\u6587\u4EF6\u540D\u548C 480\xD7360\uFF09\uFF1A\n\n```json\n{\n  "title": "\u4EA7\u54C1\u5B98\u7F51\u9996\u9875",\n  "frames": [\n    { "id": "home", "title": "\u5B98\u7F51\u9996\u9875", "file": "home.html", "width": 1280, "height": 800 }\n  ]\n}\n```\n\n   \u6807\u9898\u5199\u6210\u4E00\u53E5\u77ED\u8BDD\uFF08\u770B\u677F\u6807\u9898\u3001\u65B9\u6848\u6807\u9898\u3001\u9875\u9762\u540D\u548C\u4FBF\u7B7E\u6807\u9898\u90FD\u4E00\u6837\uFF09\uFF0C\u4E0D\u8981\u7528\u300C\xB7\u300D\u300C|\u300D\u300C\u2014\u300D\u628A\u51E0\u6BB5\u62FC\u5728\u4E00\u8D77\uFF0C\u4E5F\u4E0D\u8981\u7528\u526F\u6807\u9898\u91CD\u590D\u62FC\u63A5\u72B6\u6001\u3001\u7248\u672C\u3001\u76EE\u5F55\u540D\u7B49\u5143\u4FE1\u606F\u3002\n\n   `id` \u7A33\u5B9A\u552F\u4E00\uFF1B`file` \u76F8\u5BF9 board.json\uFF1B\u5C3A\u5BF8\u6309\u7528\u6237\u660E\u786E\u8981\u6C42\u7684\u5E73\u53F0\u7ED9\uFF08\u7F51\u9875 1280\xD7800\uFF1B\u7528\u6237\u8981\u6C42\u624B\u673A\u7AEF\u65F6 390\xD7844\uFF1B\u5F39\u7A97 480\xD7360\uFF09\u3002\n\n   \u65B9\u6848\u591A\u65F6\u53EF\u4EE5\u5206\u9875\u3001\u6392\u5E8F\u3002\u4E0D\u8981\u4E3B\u52A8\u751F\u6210\u4FBF\u7B7E\u6216\u753B\u5E03\u6807\u9898\u4FBF\u7B7E\uFF1B\u53EA\u6709\u7528\u6237\u660E\u786E\u8981\u6C42\u4FBF\u7B7E/\u753B\u5E03\u6807\u9898\u65F6\u624D\u4F7F\u7528 `notes`\u3002\n\n   ```json\n   {\n     "title": "\u5B98\u7F51\u6539\u7248",\n     "pages": [{ "id": "web", "name": "\u7F51\u9875" }, { "id": "mobile", "name": "\u624B\u673A" }],\n     "frames": [\n       { "id": "a", "title": "\u7F51\u9875\u9996\u9875", "file": "a.html", "width": 1280, "height": 800, "page": "web" },\n       { "id": "b", "title": "\u624B\u673A\u9996\u9875", "file": "b.html", "width": 390, "height": 844, "page": "mobile" }\n     ],\n     "order": ["a", "b"],\n     "notes": [\n       { "text": "\u7F51\u9875\u65B9\u5411", "kind": "title", "page": "web", "x": 0, "y": -140 },\n       { "text": "\u8FD9\u91CC\u8FD8\u8981\u8865\u7A7A\u72B6\u6001", "page": "web", "x": 1320, "y": 0 }\n     ]\n   }\n   ```\n\n   - `pages` \u5F62\u6210\u770B\u677F\u9876\u90E8\u7684\u9875\u7B7E\uFF1B`frames[].page` \u4E0D\u5199\u5C31\u5F52\u7B2C\u4E00\u9875\uFF0C\u5199\u9519\u4E5F\u5F52\u7B2C\u4E00\u9875\u3002\n   - `order` \u6309\u5E27 id \u91CD\u6392\uFF1B\u6CA1\u5217\u51FA\u7684\u5E27\u6392\u5728\u540E\u9762\u3002\n   - `notes` \u662F\u753B\u5E03\u4E0A\u7684\u53EA\u8BFB\u4FBF\u7B7E\uFF1A`kind: "title"` \u662F\u5927\u6807\u9898\uFF0C\u4E0D\u5199\u5C31\u662F\u9EC4\u8272\u4FBF\u7B7E\uFF0C`x`/`y` \u662F\u753B\u5E03\u5750\u6807\u3002\u7528\u6237\u4E0D\u80FD\u5728\u770B\u677F\u91CC\u6539\u4FBF\u7B7E\uFF0C\u8981\u6539\u5C31\u6539 board.json\u3002\n\n3. **board.json \u4E00\u5199\u597D\u5C31\u7528 `present` \u4EA4\u4ED8\u5B83**\uFF08\u53EA\u4EA4\u4ED8\u8FD9\u4E00\u6B21\uFF09\uFF1A\u53F3\u4FA7\u770B\u677F\u7ACB\u523B\u6253\u5F00\uFF0C\u6CA1\u5199\u51FA\u6765\u7684\u65B9\u6848\u663E\u793A\u300C\u6B63\u5728\u751F\u6210\u300D\u3002\n4. \u7136\u540E**\u4E00\u4E2A\u65B9\u6848\u4E00\u4E2A\u6587\u4EF6**\u9010\u4E2A\u5199\uFF0C\u5199\u5B8C\u4E00\u4E2A\u5C31\u51FA\u73B0\u4E00\u4E2A\uFF1B\u4E0D\u8981\u6512\u5230\u6700\u540E\u4E00\u8D77\u5199\uFF0C\u4E5F\u4E0D\u8981\u542F\u52A8\u4EFB\u4F55\u6D4F\u89C8\u5668\u6216\u622A\u56FE\u811A\u672C\u505A\u9884\u89C8\u3002\n5. \u4E4B\u540E\u6539\u65B9\u6848\uFF1A**\u539F\u5730\u6539\u5BF9\u5E94\u7684 html**\uFF0C\u4E0D\u8981\u65B0\u5EFA\u3001\u4E0D\u8981\u6539 id\u3002\u770B\u677F\u53EA\u91CD\u8F7D\u6539\u52A8\u7684\u5E27\uFF0C\u7528\u6237\u7684\u7F29\u653E\u4F4D\u7F6E\u548C\u6807\u6CE8\u90FD\u7559\u7740\uFF08\u6539\u8FC7\u7684\u5E27\u4E0A\u7684\u6807\u6CE8\u6807\u6210\u300C\u8FC7\u671F\u300D\uFF09\u3002\n\n## \u505A\u5E27\u7684\u6CE8\u610F\u4E8B\u9879\n\n- \u753B\u5E03\u9ED8\u8BA4\u628A\u5E27\u5F53\u7F29\u7565\u56FE\uFF08\u4E0D\u53EF\u70B9\uFF09\uFF0C\u7528\u6237\u70B9\u5DE5\u5177\u680F\u300C\u4EA4\u4E92\u300D\uFF08Play\uFF09\u540E\u624D\u80FD\u76F4\u63A5\u70B9\u3001\u6EDA\uFF1B\u300C\u5355\u72EC\u67E5\u770B\u300D\u4E5F\u53EF\u64CD\u4F5C\u3002\u6240\u4EE5\u9996\u5C4F\u8981\u4E00\u773C\u5B8C\u6574\uFF0C**\u4E0D\u8981**\u7528\u6EDA\u52A8\u89E6\u53D1\u7684\u51FA\u73B0\u52A8\u753B\uFF0C\u5426\u5219\u9ED8\u8BA4\u72B6\u6001\u4E0B\u662F\u4E00\u7247\u7A7A\u767D\u3002\n- \u89C6\u53E3\u5C31\u662F `width\xD7height`\uFF1A`100vh` \u7B49\u4E8E `height`\u3002\u957F\u9875\u9762\u7ED9\u8DB3 `height`\u3002\n- \u53EA\u6709\u7528\u6237\u8981\u6C42\u591A\u4E2A\u65B9\u6848\u65F6\uFF0C\u8FD9\u4E9B\u65B9\u6848\u8981**\u65B9\u5411\u4E0D\u540C**\uFF08\u7248\u5F0F\u3001\u5B57\u4F53\u3001\u4FE1\u606F\u5C42\u6B21\u3001\u7EC4\u4EF6\u5F62\u6001\uFF09\uFF0C\u4E0D\u662F\u540C\u4E00\u7A3F\u6362\u4E2A\u989C\u8272\u3002\u4E0D\u8981\u9760\u300C\u4E00\u4E2A\u6D45\u4E00\u4E2A\u6DF1\u300D\u6765\u51D1\u65B9\u5411\uFF1A\u6DF1\u6D45\u8272\u4E0D\u662F\u300C\u65B9\u5411\u300D\uFF0C\u4E24\u5957\u4E3B\u9898\u6BCF\u4E2A\u65B9\u6848\u81EA\u5DF1\u90FD\u8981\u6709\u3002\n- \u6DF1\u8272\u4E0B\u56FE\u7247\u3001\u9634\u5F71\u3001\u8FB9\u6846\u3001\u534A\u900F\u660E\u5C42\u4E5F\u8981\u91CD\u65B0\u770B\u4E00\u904D\uFF0C\u522B\u53EA\u6362\u80CC\u666F\u548C\u6587\u5B57\u3002\n\n## \u4EA4\u4ED8\u524D\u81EA\u68C0\uFF08\u9010\u6761\u8FC7\uFF0C\u4E0D\u5408\u683C\u5148\u6539\u5B8C\u518D\u4EA4\uFF09\n\n**\u4E25\u7981\u542F\u52A8 Chrome / Chromium / Chrome for Testing / Playwright / Puppeteer \u6216\u4EFB\u4F55\u6D4F\u89C8\u5668\u811A\u672C\u6765\u622A\u56FE\u6216\u6253\u5F00\u9884\u89C8\uFF01** \u53F3\u4FA7\u300C\u8BBE\u8BA1\u753B\u5E03\u300D\u672C\u8EAB\u5C31\u662F\u5B9E\u65F6\u6E32\u67D3\u9884\u89C8\u5668\uFF0C\u5E76\u4F1A\u5728\u6E32\u67D3\u540E\u81EA\u52A8\u56DE\u4F20 `<design-check>` \u8FD0\u884C\u65F6\u6821\u9A8C\u7ED3\u679C\uFF1B\u8D77\u6D4F\u89C8\u5668\u65E2\u6162\u53C8\u4F1A\u5728 macOS \u89E6\u53D1\u94A5\u5319\u4E32\u5BC6\u7801\u5F39\u7A97\u6253\u65AD\u7528\u6237\u3002\n\n\u5199\u5B8C\u6BCF\u4E2A\u6587\u4EF6\uFF0C\u53EA\u5728\u7EC8\u7AEF\u8DD1\u4E00\u904D\u8F7B\u91CF\u6587\u672C\u68C0\u67E5\uFF0C\u522B\u51ED\u611F\u89C9\uFF0C\u4E5F\u522B\u5199 Python/Node \u811A\u672C\u53CD\u590D\u6298\u817E\uFF1A\n\n```bash\ncd design/<\u4EFB\u52A1\u540D>\ngrep -c "addEventListener\\|onclick" *.html      # \u6BCF\u4E2A \u2265 1\uFF0C\u5426\u5219\u6CA1\u4EA4\u4E92\ngrep -c \'data-theme\\|\\.dark\\|light-dark\' *.html # \u6BCF\u4E2A \u2265 1\uFF0C\u5426\u5219\u6CA1\u505A\u4E3B\u9898\ngrep -n \'src="[^hd/#]\\|href="[^h#]\' *.html      # \u4E0D\u5E94\u6709\u76F8\u5BF9\u8DEF\u5F84\u7684\u8D44\u6E90\n```\n\n\u518D\u5BF9\u4E00\u904D\uFF1A\u7AE0\u8282\u8282\u594F\u662F\u4E0D\u662F\u7167\u8BBE\u8BA1\u4F53\u7CFB\u7684\u53C2\u8003\u9875\u6765\u7684\uFF08\u522B\u81EA\u4F5C\u4E3B\u5F20\u62B9\u5E73\uFF0C\u4E5F\u522B\u628A\u9ED1\u767D\u62FC\u5728\u540C\u4E00\u7EC4\u63A7\u4EF6\u91CC\uFF09\uFF1F\u6570\u636E\u662F\u4E0D\u662F\u5177\u4F53\u53EF\u4FE1\uFF08\u522B\u5199\u300C\u6307\u6807 A / \u6307\u6807 B\u300D\uFF0C\u522B\u7F16\u6CA1\u6765\u6E90\u7684\u300C\u63D0\u901F 10 \u500D\u300D\uFF09\uFF1F\u8BBE\u8BA1\u4F53\u7CFB\u7684 token \u6709\u6CA1\u6709\u8D34\u8FDB\u7B2C\u4E00\u4E2A `<style>`\uFF1F\u754C\u9762\u91CC\u6709\u6CA1\u6709\u6B8B\u7559\u7239\u5473\u7070\u5B57\u63D0\u793A\u3001\u4E2D\u82F1\u6587\u62EC\u53F7\u3001emoji\u3001\u5361\u7247\u5DE6\u4FA7\u7C97\u5F69\u6761/AI slop \u8FC7\u5EA6\u88C5\u9970\u6216\u7AD6\u6392\u6587\u5B57\uFF08\u6709\u5C31\u7ACB\u523B\u5220\u5E72\u51C0\uFF09\uFF1F\n\n## \u7528\u6237\u53CD\u9988\n\n\u7528\u6237\u5728\u770B\u677F\u91CC\u9009\u4E2D\u5143\u7D20\u6216\u5708\u6807\u6CE8\u540E\uFF0C\u4F1A\u81EA\u52A8\u4F5C\u4E3A\u4E0A\u4E0B\u6587\u9644\u5728\u7528\u6237\u7684\u4E0B\u4E00\u6761\u6D88\u606F\u524D\uFF08\u7528\u6237\u6CA1\u6709\u8F93\u5165\u8FD9\u6BB5\u6587\u5B57\uFF0C\u4E5F\u522B\u5728\u56DE\u590D\u91CC\u590D\u8FF0\u8FD9\u6BB5\u6807\u8BB0\uFF09\uFF1A\n\n```xml\n<design-feedback board="\u2026">\n  <note>\u2026</note>                       <!-- \u7528\u6237\u7684\u8865\u5145\u8BF4\u660E\uFF08\u53EF\u80FD\u6CA1\u6709\uFF09-->\n  <frame id="b" title="\u2026" file="b.html">\n    <selected selector="section.hero > h1" tag="h1" text="\u2026"/>          <!-- \u7528\u6237\u9009\u4E2D\u7684\u5143\u7D20\uFF1Bvia="click" \u662F\u70B9\u9009\uFF0Cvia="box" \u662F\u62D6\u62FD\u6846\u9009\uFF08\u6846\u4E00\u6B21\u4F1A\u5E26\u51FA\u533A\u57DF\u5185\u4E00\u6279\u5143\u7D20\uFF0C\u6570\u91CF\u591A\u662F\u6B63\u5E38\u7684\uFF0C\u4E0D\u4EE3\u8868\u9010\u4E2A\u70B9\u4E86\uFF09 -->\n    <annotation type="rect" covers="a.btn\uFF08\u7ACB\u5373\u66F4\u65B0\uFF09; \u2026">\u95F4\u8DDD\u592A\u5C0F</annotation>   <!-- \u77E9\u5F62/\u753B\u7B14\u5708\u4E2D\u7684\u5143\u7D20 + \u5907\u6CE8 -->\n    <annotation type="text">\u53BB\u6389\u5173\u95ED\u56FE\u6807</annotation>\n    <annotation type="rect" stale="true">\u2026</annotation>                  <!-- \u8BE5\u5E27\u6B64\u540E\u6539\u8FC7\uFF0C\u4F4D\u7F6E\u53EF\u80FD\u5DF2\u53D8 -->\n  </frame>\n  <canvas><annotation type="text">\u6574\u4F53\u504F\u6697</annotation></canvas>        <!-- \u4E0D\u5C5E\u4E8E\u4EFB\u4F55\u65B9\u6848 -->\n</design-feedback>\n```\n\n- `selector` \u662F\u5E27\u5185\u7684 CSS \u9009\u62E9\u5668\uFF0C\u76F4\u63A5\u53BB\u5BF9\u5E94\u6587\u4EF6\u91CC\u5B9A\u4F4D\uFF1B\u627E\u4E0D\u5230\u65F6\u7528 `text` \u8F85\u52A9\u3002\n- `covers` \u662F\u5708\u4E2D\u7684\u5143\u7D20\uFF08\u5DF2\u6309\u91CD\u53E0\u9762\u79EF\u7B5B\u8FC7\uFF0C\u5185\u5C42\u4F18\u5148\uFF09\uFF1B\u5907\u6CE8\u5C31\u662F\u7528\u6237\u60F3\u600E\u4E48\u6539\u3002\n- `locate="failed"` \u8868\u793A\u6CA1\u5B9A\u4F4D\u5230\u5143\u7D20\uFF0C\u53EA\u80FD\u6309\u5907\u6CE8\u7406\u89E3\u3002\n- \u9010\u6761\u56DE\u5E94\u53CD\u9988\uFF0C\u6539\u5B8C\u5728\u5BF9\u5E94\u6587\u4EF6\u91CC\u539F\u5730\u6539\uFF1B`stale` \u7684\u6807\u6CE8\u5148\u786E\u8BA4\u662F\u5426\u8FD8\u9002\u7528\u3002\n- \u540C\u4E00\u6BB5\u4E0A\u4E0B\u6587\u91CC\u8FD8\u53EF\u80FD\u6709 `<design-check>`\uFF1A\u8FD9\u662F\u770B\u677F\u7684\u81EA\u52A8\u6821\u9A8C\u7ED3\u679C\uFF08\u4E0D\u662F\u7528\u6237\u5199\u7684\uFF09\uFF0C\u5217\u51FA\u88AB\u62E6\u4E0B\u7684\u65B9\u6848\u548C\u539F\u56E0\uFF0C**\u5148\u4FEE\u597D\u8FD9\u4E9B\u518D\u5904\u7406\u522B\u7684**\u3002\n\n## \u9ED8\u8BA4\u98CE\u683C\n\n\u7528\u6237\u6D88\u606F\u91CC\u5E26 `<design-preset id="\u2026" name="\u2026"/>`\uFF08\u770B\u677F\u91CC\u9009\u4E86\u8BBE\u8BA1\u4F53\u7CFB\uFF09\u65F6\uFF0C\u5FC5\u987B\u6309\u5B83\u505A\uFF1A\u8C03\u5DE5\u5177 `design_preset`\uFF08`action:"read"`, `id`\uFF09\u4F9D\u6B21\u8BFB `design`\uFF08DESIGN.md\uFF0C\u89C6\u89C9\u610F\u56FE\u548C\u7981\u5FCC\uFF09\u3001`tokens`\uFF08tokens.css\uFF0C\u628A `:root` \u5757\u539F\u6837\u8D34\u8FDB\u6BCF\u4E2A\u5E27\u7684\u7B2C\u4E00\u4E2A `<style>`\uFF0C\u4E4B\u540E\u4E00\u5F8B\u7528 `var(--*)`\uFF09\uFF0C\u518D\u8BFB `components`\uFF08components.html\uFF0C\u8BE5\u4F53\u7CFB\u81EA\u5DF1\u7684\u53C2\u8003\u9875\uFF1A\u6309\u94AE\u3001\u5361\u7247\u3001\u5BFC\u822A\u3001\u7AE0\u8282\u8282\u594F\u90FD\u7167\u5B83\u7684\u7ED3\u6784\u548C\u7C7B\u540D\u5199\uFF0C\u4E0D\u8981\u51ED\u5370\u8C61\u81EA\u521B\uFF09\u3002\u8BFB\u5B8C\u518D\u52A8\u624B\uFF0C\u5F00\u5DE5\u524D\u7528\u4E00\u4E24\u53E5\u8BDD\u8BF4\u6E05\u8FD9\u5957\u7684\u51E0\u6761\u5173\u952E\u89C4\u5219\uFF08\u4E3B\u8272\u7528\u5728\u54EA\u3001\u5B57\u91CD\u5B57\u8DDD\u3001\u5706\u89D2\u3001\u7981\u5FCC\uFF09\u3002\u5B57\u4F53\u6808\u91CC\u7684\u4E13\u6709\u5B57\u4F53\uFF08\u5982 SF Pro\uFF09\u7F51\u9875\u4E0A\u4E0D\u4E00\u5B9A\u88C5\u4E86\uFF1A\u4FDD\u7559\u539F\u6808\uFF0C\u524D\u9762\u8865 `-apple-system, system-ui`\uFF0C\u672B\u5C3E\u8865 `"PingFang SC", "Microsoft YaHei"` \u4EE5\u514D\u4E2D\u6587\u6389\u6210\u5B8B\u4F53\u3002\u7528\u6237\u60F3\u770B\u5185\u7F6E\u7684 165 \u5957\u8BBE\u8BA1\u4F53\u7CFB\uFF0C\u8C03 `action:"list"`\uFF08\u53EF\u5E26 `query` \u6309\u540D\u79F0/\u7C7B\u522B\u7B5B\uFF09\u3002\n\n\u7528\u6237\u6CA1\u6307\u5B9A\u98CE\u683C\u65F6\uFF0C\u9ED8\u8BA4\u6309 Apple \u7684\u89C6\u89C9\u8BED\u8A00\u8BBE\u8BA1\uFF1A**\u52A0\u8F7D\u6280\u80FD `design-board-apple-style`**\uFF0C\u5E76\u8C03 `design_preset`\uFF08`id: "apple"`\uFF09\u8BFB\u53D6 `tokens` \u4E0E `components`\uFF08\u514B\u5236\u7559\u767D\u3001\u7EAF\u9ED1\u4E0E `#f5f5f7` \u6D45\u7070\u4EA4\u66FF\u7AE0\u8282\u8282\u594F\u3001SF Pro \u7D27\u51D1\u6392\u7248\u5C42\u7EA7\u3001`#0071e3` \u5355\u4E00\u82F9\u679C\u84DD\u5F3A\u8C03\u8272\u3001\u80F6\u56CA\u6309\u94AE\u4E0E\u9AD8\u5BF9\u6BD4\u5EA6\u5361\u7247\u89C4\u8303\uFF09\u3002\n\n\u7528\u6237\u7ED9\u4E86\u54C1\u724C/\u53C2\u8003\u65F6\u4EE5\u7528\u6237\u4E3A\u51C6\uFF1B\u505A\u591A\u65B9\u6848\u5BF9\u6BD4\u65F6\uFF0C\u53EA\u6709\u5176\u4E2D\u4E00\u4E2A\u65B9\u6848\u9700\u8981\u8D34\u8FD9\u5957\u98CE\u683C\uFF0C\u5176\u4F59\u5E94\u8D70\u4E0D\u540C\u65B9\u5411\u3002\n';

// presets/apple/DESIGN.md
var DESIGN_default = '# Design System Inspired by Apple\n\n> Category: Media & Consumer\n> Consumer electronics. Premium white space, SF Pro, cinematic imagery.\n\n## 1. Visual Theme & Atmosphere\n\nApple\'s web language is a precision editorial system that alternates between gallery-like calm and retail-density information blocks. The visual tone stays restrained: broad neutral canvases, quiet chrome, and product imagery given almost all of the expressive weight. The interface is engineered to disappear so hardware, materials, and finish options become the narrative foreground.\n\nAcross the five analyzed pages, the rhythm is consistent but not monolithic. Marketing surfaces (homepage and Environment) use cinematic black-and-light chaptering, while commerce surfaces (Store and Shop flows) introduce tighter spacing, more utility controls, and denser card stacks without breaking the core brand grammar. The result is one system with two gears: showcase mode and transaction mode.\n\nTypography is the stabilizer. SF Pro Display carries hero and merchandising hierarchy with compact line heights and controlled tracking, while SF Pro Text handles product metadata, navigation, filters, and dense selection UI. The typography stays understated, but the scale range is wide enough to support both billboard hero messaging and micro utility labels.\n\n**Key Characteristics:**\n- Binary section rhythm: deep black scenes (`#000000`) alternating with pale neutral fields (`#f5f5f7`)\n- Single blue accent family for action and link semantics (`#0071e3`, `#0066cc`, `#2997ff`)\n- Dual operating modes in one system: cinematic showcase modules and dense commerce configurators\n- Heavy reliance on imagery and material finishes; UI chrome remains visually thin\n- Tight headline metrics (SF Pro Display, semibold) paired with compact body/link typography (SF Pro Text)\n- Pill and capsule geometry as signature action language (`18px` to `980px` and circular controls)\n- Depth used sparingly; contrast and surface separation do most of the layering work\n- Multi-page color-block rhythm: black hero chapters -> pale neutral merchandising fields -> utility white retail surfaces -> dark micro-surfaces for controls\n\n## 2. Color Palette & Roles\n\n> **Source Pages:** `https://www.apple.com/`, `https://www.apple.com/environment/`, `https://www.apple.com/store`, `https://www.apple.com/shop/buy-iphone/iphone-17-pro`, `https://www.apple.com/shop/accessories/all`\n\n### Primary\n- **Absolute Black** (`#000000`): Immersive hero canvases, high-drama product chapters, deep UI anchors.\n- **Pale Apple Gray** (`#f5f5f7`): Main light surface for feature bands, comparison blocks, and editorial transitions.\n- **Near-Black Ink** (`#1d1d1f`): Primary text and dark-fill control color on light canvases.\n\n### Secondary & Accent\n- **Apple Action Blue** (`#0071e3`): Primary action fill and focus-signaling brand accent.\n- **Body Link Blue** (`#0066cc`): Inline link color optimized for long-form readability.\n- **High-Luminance Link Blue** (`#2997ff`): Bright link treatment on darker scenes where stronger contrast is required.\n\n### Surface & Background\n- **Pure White Canvas** (`#ffffff`): Retail/product-list backgrounds and dense transactional sections.\n- **Graphite Surface A** (`#272729`): Dark card and media-control context layer.\n- **Graphite Surface B** (`#262629`): Slightly deeper dark utility layer for control groupings.\n- **Graphite Surface C** (`#28282b`): Elevated dark supporting surfaces.\n- **Graphite Surface D** (`#2a2a2c`): Darkest elevated step used for separation in richer dark scenes.\n\n### Neutrals & Text\n- **Secondary Neutral Gray** (`#6e6e73`): Body secondary copy, helper descriptions, tertiary metadata.\n- **Soft Border Gray** (`#d2d2d7`): Dividers, subtle outlines, and muted utility containment.\n- **Mid Border Gray** (`#86868b`): Stronger field outlines in product-configuration and filter contexts.\n- **Utility Dark Gray** (`#424245`): Dark-neutral text/surface crossover in store contexts.\n\n### Semantic & Accent\n- **Selection/Focus Signal** (`#0071e3`): Shared focus and selected-state signal across marketing and commerce contexts.\n- **Error/Warning/Success**: No distinct semantic palette was consistently visible in the extracted surface set.\n\n### Gradient System\n- The extracted pages are overwhelmingly solid-surface driven. Visual richness comes from photography and finish rendering rather than persistent UI gradients.\n\n## 3. Typography Rules\n\n### Font Family\n- **Display Family:** `SF Pro Display`, fallbacks `SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif`\n- **Text Family:** `SF Pro Text`, fallbacks `SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif`\n- **Usage Split:** Display family handles hero/product headlines and merchandising headings; Text family handles navigation, controls, labels, and dense commerce copy.\n\n### Hierarchy\n| Role | Size | Weight | Line Height | Letter Spacing | Notes |\n|------|------|--------|-------------|----------------|-------|\n| Hero Display XL | 80px | 600 | 1.00-1.05 | -1.2px | Environment/store hero scale |\n| Hero Display L | 56px | 600 | 1.07 | -0.28px | Homepage hero moments |\n| Section Display | 48px | 500-600 | 1.08 | -0.144px | Major chapter headings |\n| Product Heading | 40px | 600 | 1.10 | normal | Product and campaign section titles |\n| Feature Display | 38px | 600 | 1.21 | 0.152px | Device and merchandising callouts |\n| Promo Display | 32px | 300-600 | 1.09-1.13 | 0.128px to 0.352px | Module-level sub-heroes |\n| Card/Product Title | 28px | 600 | 1.14 | 0.196px | Tile-level naming and key copy |\n| Utility Heading | 24px | 600 | 1.17 | 0.216px / -0.2px | Configurator and grouped content headers |\n| Link/Action Heading | 21px | 600 | 1.14-1.38 | 0.231px | Larger promotional links |\n| Subhead | 19px | 600 | 1.21 | 0.228px | Compact section intros |\n| Body Primary | 17px | 400 | 1.47 | -0.374px | Standard body and retail descriptions |\n| Body Emphasis | 17px | 600 | 1.24 | -0.374px | Emphasized labels and key values |\n| Control Label | 14px | 400-600 | 1.29-1.47 | -0.224px | Buttons, helper labels, compact nav text |\n| Micro UI | 12px | 400-600 | 1.00-1.33 | -0.12px | Fine print, micro labels |\n| Legal/Meta | 10px | 400 | 1.30-1.47 | -0.08px | Dense metadata and legal support text |\n\n### Principles\n- **Continuity across page types:** The same typographic DNA spans cinematic launches and product-purchase flows, preventing a brand split between marketing and commerce.\n- **Compression at scale:** Display tiers use tight leading and controlled tracking to feel machined and product-first.\n- **Readable density at retail depth:** SF Pro Text balances compactness with enough vertical rhythm for long product lists and option matrices.\n- **Measured weight ladder:** 600 is the dominant emphasis weight; 700 appears selectively; 300 is used sparingly for contrast in larger lines.\n\n### Note on Font Substitutes\n- Closest freely available substitutes: `Inter` for text-heavy implementation and `SF Pro Display-like` metrics approximated with `Inter Tight` for headings.\n- When substituting, increase line-height slightly (+0.02 to +0.06) on body sizes and reduce negative tracking intensity to preserve readability.\n\n## 4. Component Stylings\n\n### Buttons\n- **Primary Fill Action:** `#0071e3` background, `#ffffff` text, 8px radius, compact horizontal padding (commonly 8px 15px). Used for decisive purchase/progression actions.\n- **Dark Fill Action:** `#1d1d1f` background, `#ffffff` text, 8px radius. Used when light surfaces need a restrained high-contrast primary.\n- **Pill/Capsule Action Family:** large capsule actions at `18px`-`56px` radii and extreme pill links at `980px`. Establishes Apple\u2019s soft but precise call-to-action silhouette.\n- **Utility Filter/Button Shells:** light shells (`#fafafc` or translucent white) with subtle gray borders (`#d2d2d7` / `#86868b`) for dense configuration contexts.\n- **Pressed Behavior:** active controls commonly reduce scale or shift fill slightly to indicate physical press confirmation.\n\n### Cards & Containers\n- **Editorial/Product Cards:** light cards on `#f5f5f7` or white fields with minimal framing and image-first composition.\n- **Dark Utility Cards:** graphite steps (`#272729` to `#2a2a2c`) used for overlays, media controls, and dark-context modules.\n- **Configurator Panels:** rounded containers (often 12px-18px) with clear but restrained border definition.\n- **Carousel/Spotlight Modules:** larger rounded shells (`28px`-`36px`) for featured content lanes.\n\n### Inputs & Forms\n- **Retail Input Fields:** translucent or white backgrounds, dark text (`#1d1d1f`), border-led containment (`#86868b`).\n- **Selection Controls:** circular/toggle-like control geometry appears frequently in product selection interfaces.\n- **Density Strategy:** form fields remain visually quiet to keep device imagery and pricing hierarchy dominant.\n\n### Navigation\n- **Global Marketing Nav:** compact dark translucent bar with small-type links and restrained iconography.\n- **Store/Sub-shop Nav Layers:** additional utility bars, chips, and segmented controls for category and product narrowing.\n- **Link Hierarchy:** link blues remain the primary interactive signal while neutral text supports dense navigation sets.\n\n### Image Treatment\n- **Object-First Photography:** hardware and accessories are foregrounded on controlled solid surfaces.\n- **High-fidelity finish rendering:** reflective/material details are central to visual persuasion.\n- **Mixed framing:** full-bleed hero scenes coexist with rounded retail cards and tightly cropped merchandising thumbnails.\n\n### Other Distinctive Components\n- **Product Configurator Matrix:** option stacks and selectors combining chips, radio-style controls, and contextual pricing/summary blocks.\n- **Carousel Control Dots/Arrows:** circular control vocabulary in muted overlays for gallery progression.\n- **Environment Story Panels:** narrative chapters that blend editorial typography with cinematic product/environment visuals.\n\n## 5. Layout Principles\n\n### Spacing System\n- Base unit is effectively `8px`, but the system supports dense micro-steps for precision alignment.\n- Frequently reused spacing values across pages: `2`, `4`, `6`, `7`, `8`, `9`, `10`, `12`, `14`, `17`, `20` px.\n- Universal rhythm constants visible across both marketing and retail flows: `8px` unit scaffolding with `14-20px` utility intervals for component padding and list spacing.\n\n### Grid & Container\n- **Showcase pages:** large central columns with broad horizontal breathing room and full-width color chapters.\n- **Commerce pages:** tighter multi-column product and control grids with frequent modular stacking.\n- **Container behavior:** constrained readable core with generous outer margins at desktop widths.\n\n### Whitespace Philosophy\n- **Scene pacing:** major visual chapters use broad top/bottom breathing room.\n- **Information compaction where needed:** retail pages deliberately compress spacing to expose more actionable information per viewport.\n- **Contrast-led separation:** section transitions rely more on surface changes than decorative separators.\n\n### Border Radius Scale\n- **5px:** tiny utility links/tags and minor small shells.\n- **8px-12px:** standard controls and compact fields.\n- **16px-18px:** cards, module frames, and commerce panels.\n- **28px-36px:** larger module and spotlight containers.\n- **56px / 100px / 980px:** capsules, large pills, and signature elongated CTA forms.\n- **50%:** circular media and selection controls.\n\n## 6. Depth & Elevation\n\n| Level | Treatment | Use |\n|------|-----------|-----|\n| Level 0 | Flat neutral surfaces (`#ffffff`, `#f5f5f7`, `#000000`) | Main narrative and product stages |\n| Level 1 | Subtle border containment (`#d2d2d7`, `#86868b`) | Filters, input fields, utility cards |\n| Level 2 | Soft shadow (`rgba(0,0,0,0.08)` to `rgba(0,0,0,0.22)` where present) | Highlighted cards and elevated merchandise modules |\n| Level 3 | Dark-surface stepping (`#272729` -> `#2a2a2c`) | Overlays, media controls, dark utility clusters |\n| Accessibility | Blue focus signal (`#0071e3`) | Keyboard and selection emphasis |\n\nDepth is intentionally restrained. Apple favors tonal contrast, surface stepping, and compositional hierarchy over heavy shadow stacks.\n\n### Decorative Depth\n- Decorative depth is primarily created by photographic realism and material rendering, not synthetic UI effects.\n- Translucent overlays and glass-like utility bars provide mild atmospheric layering in navigation and controls.\n\n## 7. Do\'s and Don\'ts\n\n### Do\n- Use the neutral triad (`#000000`, `#f5f5f7`, `#ffffff`) as the structural foundation.\n- Reserve blue accents for genuine action and navigation semantics.\n- Keep typography tight and deliberate, especially at display scales.\n- Maintain the capsule/circle geometry language for controls and key actions.\n- Let product imagery carry visual drama; keep chrome understated.\n- Use border-led containment in dense retail contexts instead of heavy card ornamentation.\n- Preserve clear separation between showcase modules and transactional modules while keeping core tokens shared.\n\n### Don\'t\n- Don\u2019t introduce broad secondary accent palettes that compete with Apple blue.\n- Don\u2019t overuse shadows, glow effects, or decorative gradients in core UI chrome.\n- Don\u2019t mix unrelated font families or loosen tracking indiscriminately.\n- Don\u2019t flatten all corners to a single radius; Apple uses purposeful radius tiers.\n- Don\u2019t overload commerce modules with thick borders or loud visual effects.\n- Don\u2019t remove neutral contrast cadence between dark and light chapters.\n- Don\u2019t treat marketing and purchase flows as separate design systems.\n\n## 8. Responsive Behavior\n\n### Breakpoints\n| Name | Width | Key Changes |\n|------|-------|-------------|\n| Small Mobile | 374px and below | Tightened retail controls, single-column product stacks |\n| Mobile | 375px-640px | One-column modules, compact action rows, condensed selectors |\n| Tablet | 641px-833px | Expanded cards and mixed 1-2 column transitions |\n| Tablet Wide | 834px-1023px | More stable multi-column merchandising, larger text blocks |\n| Desktop | 1024px-1240px | Full retail layouts and product comparison structures |\n| Desktop Wide | 1241px-1440px | Marketing hero expansion and broader section spacing |\n| Large Desktop | 1441px+ | Maximum chapter breathing room and wide editorial composition |\n\n### Touch Targets\n- Primary and secondary actions are generally presented in tap-friendly pill/button geometries.\n- Circular media and selection controls align with minimum touchable intent in mobile contexts.\n- Dense commerce UI uses compact labels but maintains clear hit regions via surrounding shape padding.\n\n### Collapsing Strategy\n- Marketing hero typography scales down in discrete tiers while preserving hierarchy contrast.\n- Product and commerce grids collapse from multi-column to stacked cards with persistent selector visibility.\n- Utility navigation compresses into simpler link/control groupings while preserving key actions.\n- Option/configuration clusters become vertically sequenced to keep purchase flow linear on small screens.\n\n### Image Behavior\n- Product imagery preserves aspect and centrality through breakpoints.\n- Hero visuals remain dominant on mobile, with text repositioned around media priority.\n- Retail thumbnails stay legible via tighter crop logic and denser card stacking.\n- Image-led modules continue to anchor the rhythm as layout density increases.\n\n## 9. Agent Prompt Guide\n\n### Quick Color Reference\n- Primary action blue: **Apple Action Blue** (`#0071e3`)\n- Inline link blue: **Body Link Blue** (`#0066cc`)\n- Dark chapter canvas: **Absolute Black** (`#000000`)\n- Light chapter canvas: **Pale Apple Gray** (`#f5f5f7`)\n- Primary text on light: **Near-Black Ink** (`#1d1d1f`)\n- Secondary text: **Secondary Neutral Gray** (`#6e6e73`)\n- Retail border soft: **Soft Border Gray** (`#d2d2d7`)\n- Retail border strong: **Mid Border Gray** (`#86868b`)\n\n### Example Component Prompts\n- "Design an Apple-style product hero on a black canvas (`#000000`) with SF Pro Display semibold headline (48-56px), concise supporting copy, and two capsule CTAs using `#0071e3` and `#1d1d1f`."\n- "Create a commerce configuration panel on white (`#ffffff`) with 18px rounded cards, `#86868b` border fields, SF Pro Text 17px body copy, and compact option selectors."\n- "Build a merchandising card grid alternating `#f5f5f7` and white surfaces, with image-first cards, restrained shadows, and 14-17px SF Pro Text metadata."\n- "Generate a carousel control cluster using circular buttons (50% radius), muted gray overlays, and clear active feedback for gallery navigation."\n- "Compose a mixed marketing + retail page rhythm: dark showcase chapter -> light feature chapter -> dense product list module while keeping blue accents only for actions and links."\n\n### Iteration Guide\n1. Lock the neutral foundation first (`#000000`, `#f5f5f7`, `#ffffff`) before tuning accents.\n2. Keep blue accents scarce and purposeful; if everything is blue, hierarchy collapses.\n3. Tune typography in this order: display scale, body readability, then micro labels.\n4. Match radius by component class (field, card, capsule, circle) rather than one-size-fits-all rounding.\n5. Increase density gradually when moving from showcase sections to commerce sections.\n6. Validate that product imagery remains the strongest visual layer after each revision.\n\n### Known Gaps\n- Distinct semantic status colors (error/warning/success) were not consistently visible in the extracted page set.\n- Some interaction micro-states vary by module and are not represented as universal system tokens.\n- A few retail modules expose context-specific typography overrides that do not appear across all five pages.\n';

// src/host.js
var name = "design-board";
var inject = ["skills", "tools", "webServer"];
var SOURCE_KIND = "design-board";
var hiddenMessage = (text2) => Object.freeze({
  id: globalThis.crypto.randomUUID(),
  role: "user",
  content: Object.freeze([Object.freeze({ type: "text", text: text2 })]),
  source: Object.freeze({ kind: SOURCE_KIND })
});
var text = (_args, value) => [{ type: "text", text: value }];
function apply(ctx) {
  const runPreset = createPresetRunner(new URL("./presets/", import.meta.url));
  const store = createContextStore();
  const bindings = createSessionDesignBindings(null);
  const onBind = (sessionId, boardPath) => store.ensure(sessionId, buildBoardBinding(boardPath));
  const isBlankSession = async (sessionId) => {
    const sessions = ctx.get("sessions");
    if (!sessions) return false;
    const live = sessions.get?.(sessionId);
    if (live) {
      const meta2 = ctx.get("sessionProjections")?.cachedSnapshot?.(live)?.values?.sessionListMetadata;
      if (typeof meta2?.blank === "boolean") return meta2.blank;
      if (typeof live.snapshotEvents === "function") {
        return !live.snapshotEvents().some((e) => e?.type === "turn/start" || e?.type === "user/message");
      }
      return live.seq === 0;
    }
    const persistence = ctx.get("sessionPersistence");
    if (!persistence) return false;
    const stored = await persistence.stat?.(sessionId);
    if (!stored?.header) return true;
    const meta = ctx.get("sessionProjectionCache")?.cachedSnapshot?.(stored.header)?.values?.sessionListMetadata;
    return meta?.blank === true;
  };
  const claimDesign = (sessionId, boardPath) => {
    if (!sessionId || !boardPath) return;
    const before = bindings.get(sessionId);
    if (bindings.bind(sessionId, boardPath) && !before) onBind(sessionId, bindings.get(sessionId));
  };
  const claimPresentedFiles = (session, files) => {
    if (!session?.id || session.header?.origin === "subagent" || bindings.get(session.id) || !Array.isArray(files)) return;
    for (const file of files) {
      const boardPath = boardPathOfDesignFile(file?.path, session.header?.cwd);
      if (boardPath) {
        claimDesign(session.id, boardPath);
        return;
      }
    }
  };
  const restoreFromSession = (session) => {
    if (!session?.id || session.header?.origin === "subagent" || bindings.get(session.id) || typeof session.snapshotEvents !== "function") return;
    for (const event of session.snapshotEvents()) {
      if (event?.type === "deliverables/presented") claimPresentedFiles(session, event.data?.files);
      if (bindings.get(session.id)) return;
    }
  };
  const withAdmission = (handler) => (req, res) => {
    const connection = ctx.get("connection");
    if (connection) {
      if (typeof connection.admit === "function") {
        const admission = connection.admit(req);
        if (admission && "rejection" in admission) {
          res.writeHead(admission.rejection);
          res.end(admission.rejection === 401 ? "unauthorized" : "forbidden");
          return;
        }
      } else if (typeof connection.requestRejection === "function") {
        const status = connection.requestRejection(req);
        if (status) {
          res.writeHead(status);
          res.end(status === 401 ? "unauthorized" : "forbidden");
          return;
        }
      }
    }
    return handler(req, res);
  };
  ctx.effect(() => ctx.get("webServer").register({
    kind: "exact",
    path: "/dsh-design-board/context",
    handler: withAdmission(createContextHandler(store))
  }), "dsh-design-board: hidden context route");
  ctx.effect(() => ctx.get("webServer").register({
    kind: "exact",
    path: "/dsh-design-board/binding",
    handler: withAdmission(createBindingHandler(bindings, onBind, isBlankSession))
  }), "dsh-design-board: session binding route");
  ctx.on("session/event", (session, event) => {
    if (event?.type === "deliverables/presented") claimPresentedFiles(session, event.data?.files);
  });
  const boardFromContext = (sessionId) => {
    const text2 = store.peek?.(sessionId);
    if (typeof text2 !== "string") return void 0;
    const m = /<design-board\b[^>]*\bboard="([^"]+)"/.exec(text2);
    return m ? boardPathOfDesignFile(m[1]) : void 0;
  };
  ctx.on("tools/result", (exec, result) => {
    if (result?.isError || !exec?.agent?.session || exec.agent.session.header?.origin === "subagent") return;
    const sid = exec.agent.session.id;
    if (isDesignBoardSkillRead(exec)) {
      if (bindings.get(sid)) return;
      const chosen = boardFromContext(sid);
      const target = chosen || sessionBoardPath(sid);
      if (target) claimDesign(sid, target);
      return;
    }
    const boardPath = extractToolDesignPath(exec);
    if (boardPath) claimDesign(sid, boardPath);
  });
  ctx.on("agent/pre-step", async ({ agent, step, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject" || signal.aborted || agent.session.header.origin === "subagent") return decision;
    restoreFromSession(agent.session);
    if (step === 1 && decision.messages.length === 0) return decision;
    const pending = store.take(agent.session.id);
    return pending === void 0 ? decision : { ...decision, messages: [...decision.messages, hiddenMessage(pending)] };
  });
  ctx.effect(() => ctx.skills.register({
    name: "design-board",
    description: "\u505A\u754C\u9762/\u9875\u9762/\u5B98\u7F51/\u6D77\u62A5\u7B49\u89C6\u89C9\u8BBE\u8BA1\uFF0C\u6216\u7528\u6237\u60F3\u5BF9\u6BD4\u591A\u4E2A\u8BBE\u8BA1\u65B9\u6848\u65F6\u5148\u8BFB\uFF08\u9ED8\u8BA4\u53EA\u51FA\u4E00\u4E2A\u65B9\u6848\uFF0C\u7528\u6237\u660E\u786E\u8981\u5BF9\u6BD4\u624D\u51FA\u591A\u4E2A\uFF09\uFF1A\u5148\u5199 board.json \u5217\u51FA\u65B9\u6848\u5E76\u7ACB\u523B present\uFF0C\u518D\u9010\u4E2A\u5199\u81EA\u5305\u542B HTML \u5E27\uFF0C\u5728\u53F3\u4FA7\u300C\u8BBE\u8BA1\u753B\u5E03\u300D\u5E76\u6392\u5C55\u793A\uFF1B\u7528\u6237\u9009\u5143\u7D20\u3001\u5708\u6807\u6CE8\u7684\u53CD\u9988\u4F1A\u81EA\u52A8\u9644\u5E26\u7ED9\u4F60\u3002",
    content: design_board_default,
    source: "runtime"
  }), "dsh-design-board: design-board");
  ctx.effect(() => ctx.skills.register({
    name: "design-board-apple-style",
    description: 'Apple \u98CE\u683C\u7684\u8BBE\u8BA1\u89C4\u8303\uFF08\u514B\u5236\u7559\u767D\u3001\u9ED1\u767D\u4EA4\u66FF\u7AE0\u8282\u8282\u594F\u3001SF Pro \u5B57\u4F53\u5C42\u7EA7\u3001#0071e3 \u5F3A\u8C03\u8272\u4E0E\u7EC4\u4EF6\u89C4\u5219\uFF09\u3002\u505A\u8BBE\u8BA1\u4E14\u7528\u6237\u6CA1\u6307\u5B9A\u98CE\u683C\u65F6\u9ED8\u8BA4\u6309\u9700\u52A0\u8F7D\uFF0C\u5E76\u53EF\u914D\u5408 design_preset \u8BFB\u53D6 id:"apple" \u7684 tokens \u4E0E components\u3002',
    content: DESIGN_default,
    source: "runtime"
  }), "dsh-design-board: design-board-apple-style");
  ctx.effect(() => ctx.tools.register({
    name: "design_preset",
    description: "Design Board \u5185\u7F6E\u8BBE\u8BA1\u4F53\u7CFB\u5E93\uFF08165 \u5957\u9884\u8BBE\uFF0C\u5982 Airbnb\u3001Linear\u3001Apple \u98CE\u683C\uFF09\u3002list \u5217\u51FA\uFF08\u53EF\u6309\u540D\u79F0/\u7C7B\u522B\u7B5B\u9009\uFF09\uFF0Cread \u8BFB\u53D6\u67D0\u5957\u7684 DESIGN.md / tokens.css / components.html / components.manifest.json\u3002\u7528\u6237\u5728\u770B\u677F\u91CC\u9009\u4E86\u8BBE\u8BA1\u4F53\u7CFB\u6216\u8981\u6309\u67D0\u54C1\u724C\u98CE\u683C\u505A\u8BBE\u8BA1\u65F6\u7528\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["list", "read"], description: "list \u5217\u51FA\u5185\u7F6E\u8BBE\u8BA1\u4F53\u7CFB\uFF0Cread \u8BFB\u53D6\u67D0\u5957\u8BBE\u8BA1\u4F53\u7CFB\u5185\u5BB9\u3002" },
        id: { type: "string", description: "read \u65F6\u5FC5\u586B\uFF1A\u8BBE\u8BA1\u4F53\u7CFB id\uFF08\u5982 apple\u3001airbnb\u3001linear\uFF09\u3002" },
        part: { type: "string", enum: Object.keys(PARTS), description: "read \u65F6\u8BFB\u54EA\u4E00\u4EFD\uFF0C\u9ED8\u8BA4 design\u3002tokens \u662F\u8981\u8D34\u8FDB <style> \u7684\u53D8\u91CF\u8868\u3002" },
        query: { type: "string", description: "list \u65F6\u7684\u7B5B\u9009\u8BCD\u3002" }
      }
    },
    output: { schema: { type: "string" }, render: text },
    execute: (args) => runPreset(args)
  }), "dsh-design-board: design_preset");
}
export {
  apply,
  inject,
  name
};
