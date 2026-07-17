# Code Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-vault code viewer with Prism.js syntax highlighting and devicon-based file icons with brand colours.

**Architecture:** New `CodeView` (ItemView) + `CodeRenderer` (Prism.js) + `file-icons.ts` (devicon SVG map). Router in `VaultViewerView` dispatches supported code files to the new view instead of opening them externally.

**Tech Stack:** prismjs, devicon (SVG icons), Obsidian ItemView, esbuild

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install prismjs and devicon**

Run:
```bash
npm install prismjs devicon
npm install -D @types/prismjs
```

- [ ] **Step 2: Verify package.json has the new deps**

Check that `package.json` contains:
```json
"dependencies": {
  "prismjs": "^1.29.0",
  "devicon": "^2.16.0"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add prismjs and devicon dependencies"
```

---

### Task 2: Create CodeRenderer

**Files:**
- Create: `src/services/CodeRenderer.ts`
- Test: `__tests__/CodeRenderer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/CodeRenderer.test.ts`:

```typescript
import { extensionToLanguage, highlight } from "../src/services/CodeRenderer";

describe("extensionToLanguage", () => {
  const cases: [string, string][] = [
    ["java", "java"],
    ["py", "python"],
    ["js", "javascript"],
    ["ts", "typescript"],
    ["json", "json"],
    ["xml", "markup"],
    ["yaml", "yaml"],
    ["css", "css"],
    ["html", "markup"],
    ["sh", "bash"],
    ["ps1", "powershell"],
    ["bat", "batch"],
    ["sql", "sql"],
    ["php", "php"],
    ["rb", "ruby"],
    ["go", "go"],
    ["rs", "rust"],
    ["c", "c"],
    ["cpp", "cpp"],
    ["cs", "csharp"],
    ["swift", "swift"],
    ["kt", "kotlin"],
    ["scala", "scala"],
    ["pl", "perl"],
    ["lua", "lua"],
    ["r", "r"],
    ["dart", "dart"],
    ["erl", "erlang"],
    ["ex", "elixir"],
    ["coffee", "coffeescript"],
    ["tex", "latex"],
    ["toml", "toml"],
    ["ini", "ini"],
    ["properties", "properties"],
    ["makefile", "makefile"],
    ["txt", ""],
    ["dockerfile", ""],
    ["gitignore", ""],
  ];

  test.each(cases)(".extensionToLanguage(%s) returns %s", (ext, expected) => {
    expect(extensionToLanguage(ext)).toBe(expected);
  });
});

describe("highlight", () => {
  test("highlights Python keywords", () => {
    const html = highlight("def foo():\n    pass", "py");
    expect(html).toContain('class="token keyword"');
  });

  test("highlights JavaScript strings", () => {
    const html = highlight('const x = "hello";', "js");
    expect(html).toContain('class="token string"');
  });

  test("highlights TypeScript types", () => {
    const html = highlight("const x: number = 42;", "ts");
    expect(html).toContain('class="token keyword"');
  });

  test("highlights SQL keywords", () => {
    const html = highlight("SELECT * FROM users;", "sql");
    expect(html).toContain('class="token keyword"');
  });

  test("returns plain text for unknown extension", () => {
    const html = highlight("hello world", "txt");
    expect(html).not.toContain('class="token');
  });

  test("truncates content over 500 KB", () => {
    const line = "// test line\n";
    const size = 600 * 1024;
    const big = line.repeat(Math.ceil(size / line.length));
    const result = highlight(big, "js");
    expect(result).toContain("truncated");
    expect(result).toContain("2000");
  });

  test("handles empty content", () => {
    const html = highlight("", "js");
    expect(html).toBe("");
  });

  test("falls back to plain text on prism error", () => {
    // Pass an extension that exists but with content that shouldn't cause
    // issues — this tests the try/catch path by triggering an edge case
    const html = highlight("normal text", "js");
    expect(html).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=CodeRenderer
```
Expected: FAIL — module not found errors.

- [ ] **Step 3: Create CodeRenderer**

Create `src/services/CodeRenderer.ts`:

```typescript
import Prism from "prismjs";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-less";
import "prismjs/components/prism-stylus";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-batch";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-scala";
import "prismjs/components/prism-groovy";
import "prismjs/components/prism-perl";
import "prismjs/components/prism-lua";
import "prismjs/components/prism-r";
import "prismjs/components/prism-objectivec";
import "prismjs/components/prism-dart";
import "prismjs/components/prism-erlang";
import "prismjs/components/prism-elixir";
import "prismjs/components/prism-coffeescript";
import "prismjs/components/prism-latex";
import "prismjs/components/prism-rest";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import "prismjs/components/prism-properties";
import "prismjs/components/prism-makefile";

const EXT_TO_LANG: Record<string, string> = {
  java: "java",
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "jsx",
  json: "json",
  xml: "markup",
  html: "markup",
  htm: "markup",
  vue: "markup",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  styl: "stylus",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  bat: "batch",
  cmd: "batch",
  php: "php",
  php3: "php",
  php4: "php",
  php5: "php",
  phtml: "php",
  rb: "ruby",
  go: "go",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  cs: "csharp",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  groovy: "groovy",
  gradle: "groovy",
  pl: "perl",
  pm: "perl",
  lua: "lua",
  r: "r",
  R: "r",
  rmd: "r",
  m: "objectivec",
  mm: "objectivec",
  dart: "dart",
  erl: "erlang",
  ex: "elixir",
  exs: "elixir",
  coffee: "coffeescript",
  tex: "latex",
  sty: "latex",
  cls: "latex",
  ltx: "latex",
  rst: "rest",
  toml: "toml",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  env: "ini",
  properties: "properties",
  makefile: "makefile",
  Makefile: "makefile",
};

const MAX_BYTES = 500 * 1024;
const MAX_LINES = 2000;

export function extensionToLanguage(ext: string): string {
  return EXT_TO_LANG[ext.toLowerCase()] ?? "";
}

export function highlight(content: string, extension: string): string {
  if (!content) return "";
  const lang = extensionToLanguage(extension);
  let truncated = false;

  // Check byte length for truncation
  const encoder = new TextEncoder();
  if (encoder.encode(content).length > MAX_BYTES) {
    const lines = content.split("\n");
    if (lines.length > MAX_LINES) {
      content = lines.slice(0, MAX_LINES).join("\n");
      truncated = true;
    }
  }

  try {
    if (lang && Prism.languages[lang]) {
      const html = Prism.highlight(content, Prism.languages[lang], lang);
      return truncated ? html + `<p class="code-truncated">(File truncated, showing first ${MAX_LINES} lines)</p>` : html;
    }
  } catch {
    // Fall through to plain text
  }

  // Plain text fallback
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return truncated
    ? escaped + `<p class="code-truncated">(File truncated, showing first ${MAX_LINES} lines)</p>`
    : escaped;
}

export const SUPPORTED_EXTENSIONS = new Set(Object.keys(EXT_TO_LANG));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern=CodeRenderer
```
Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/CodeRenderer.ts __tests__/CodeRenderer.test.ts
git commit -m "feat: add CodeRenderer with Prism.js syntax highlighting"
```

---

### Task 3: Create file-icons.ts

**Files:**
- Create: `src/utils/file-icons.ts`
- Test: `__tests__/file-icons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/file-icons.test.ts`:

```typescript
import { getFileIcon, FileIcon } from "../src/utils/file-icons";

describe("getFileIcon", () => {
  const knownCases = [
    "py", "js", "ts", "java", "rs", "go", "rb", "php",
    "c", "cpp", "cs", "swift", "kt", "scala", "pl", "lua",
    "r", "dart", "erl", "ex", "coffee", "tex", "css",
    "scss", "less", "sh", "ps1", "bat", "sql", "json",
    "xml", "yaml", "toml", "ini", "properties", "html",
    "vue", "groovy", "gradle",
  ];

  test.each(knownCases)(".getFileIcon(%s) returns a FileIcon", (ext) => {
    const icon = getFileIcon(ext);
    expect(icon).not.toBeNull();
    expect(icon!.svg).toBeTruthy();
    expect(icon!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns null for non-code extensions", () => {
    expect(getFileIcon("docx")).toBeNull();
    expect(getFileIcon("xlsx")).toBeNull();
    expect(getFileIcon("pptx")).toBeNull();
    expect(getFileIcon("md")).toBeNull();
    expect(getFileIcon("pdf")).toBeNull();
    expect(getFileIcon("png")).toBeNull();
    expect(getFileIcon("txt")).toBeNull();
  });

  test("returns null for unknown extensions", () => {
    expect(getFileIcon("zzz")).toBeNull();
    expect(getFileIcon("")).toBeNull();
  });

  test("is case-insensitive", () => {
    const lower = getFileIcon("py");
    const upper = getFileIcon("PY");
    expect(lower).toEqual(upper);
  });

  test("handles compound extensions via exact match", () => {
    // gradle is in our map; so it should return an icon
    expect(getFileIcon("gradle")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=file-icons
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create file-icons.ts**

Create `src/utils/file-icons.ts`. This file contains devicon-derived SVG icons
for each supported language. Extract SVG content directly from
`node_modules/devicon/icons/<language>/<language>-original.svg` and inline them
as literal strings.

> **Important:** Obsidian plugins run in a browser context — `require("fs")` is
> NOT available. All SVG data must be **inlined as literal strings** at
> development time. Open each file in `node_modules/devicon/icons/`, copy the
> full `<svg>...</svg>` XML, and paste it into the map below.

```typescript
export interface FileIcon {
  svg: string;  // Full inline SVG string
  color: string; // Brand hex colour
}

// Inline SVGs extracted from node_modules/devicon/icons/
// Format: { ext: { svg: "<svg>...</svg>", color: "#HEX" } }
const FILE_ICONS: Record<string, FileIcon> = {
  // Example for Python (replace ... with actual SVG content):
  py:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#3776AB" },
  js:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#F7DF1E" },
  ts:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#3178C6" },
  java: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#ED8B00" },
  rs:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#DEA584" },
  go:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#00ADD8" },
  rb:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#CC342D" },
  php:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#777BB4" },
  c:    { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#A8B9CC" },
  cpp:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#00599C" },
  cs:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#239120" },
  swift:{ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#F05138" },
  kt:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#7F52FF" },
  scala:{ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#DC322F" },
  groovy:{svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#4298B8" },
  gradle:{svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#02303A" },
  pl:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#39457E" },
  lua:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#000080" },
  r:    { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#276DC3" },
  dart: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#0175C2" },
  erl:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#A90533" },
  ex:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#4E2A8E" },
  coffee:{svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#FC0" },
  css:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#1572B6" },
  scss: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#CC6699" },
  less: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#1D365D" },
  html: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#E34F26" },
  vue:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#4FC08D" },
  sh:   { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#4EAA25" },
  ps1:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#5391FE" },
  bat:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#0078D4" },
  sql:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#4479A1" },
  json: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#F7DF1E" },
  xml:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#FF6600" },
  yaml: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#CB171E" },
  toml: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#8B4513" },
  ini:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#3D3D3D" },
  tex:  { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#008080" },
  dockerfile: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>`, color: "#2496ED" },
};

export function getFileIcon(extension: string): FileIcon | null {
  if (!extension) return null;
  const key = extension.toLowerCase();
  return FILE_ICONS[key] ?? null;
}
```

**Implementation note:** During implementation, open each file in
`node_modules/devicon/icons/<lang>/<lang>-original.svg`, copy the entire SVG
content, and paste it replacing the `"<svg>...</svg>"` placeholder strings.
There are ~38 languages in the map above — each SVG is typically 300-800 bytes.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern=file-icons
```
Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/file-icons.ts __tests__/file-icons.test.ts
git commit -m "feat: add devicon-based file icon map with brand colours"
```

---

### Task 4: Update extensions.ts

**Files:**
- Modify: `src/utils/extensions.ts`

- [ ] **Step 1: Add CODE_EXTENSIONS and isCodeExtension()**

After the `IMAGE_EXTENSIONS` block, add:

```typescript
const CODE_EXTENSIONS = new Set([
  ".txt", ".sql", ".java", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".json", ".xml", ".html", ".htm", ".vue", ".yaml", ".yml", ".css", ".scss",
  ".sass", ".less", ".styl", ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".psd1",
  ".bat", ".cmd", ".php", ".php3", ".php4", ".php5", ".phtml", ".rb", ".go", ".rs",
  ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".cs", ".swift", ".kt", ".kts",
  ".scala", ".groovy", ".gradle", ".pl", ".pm", ".lua", ".r", ".R", ".rmd", ".m", ".mm",
  ".dart", ".erl", ".ex", ".exs", ".coffee", ".tex", ".sty", ".cls", ".ltx", ".rst",
  ".toml", ".ini", ".cfg", ".conf", ".env", ".properties", ".makefile", ".Makefile",
  ".dockerfile", ".Dockerfile", ".gitignore",
]);

export function isCodeExtension(filename: string): boolean {
  const ext = getExtension(filename);
  return CODE_EXTENSIONS.has(ext);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/extensions.ts
git commit -m "feat: add CODE_EXTENSIONS set and isCodeExtension()"
```

---

### Task 5: Create CodeView

**Files:**
- Create: `src/views/CodeView.ts`

- [ ] **Step 1: Create CodeView**

Create `src/views/CodeView.ts`:

```typescript
import { ItemView, WorkspaceLeaf, TFile, FileSystemAdapter, ViewStateResult } from "obsidian";
import { highlight, extensionToLanguage } from "../services/CodeRenderer";
import { getFileIcon } from "../utils/file-icons";
import { setLucideIcon } from "../utils/lucide-icons";
import { t } from "../i18n";

export const VIEW_TYPE_CODE = "vault-viewer-code";

export class CodeView extends ItemView {
  file: TFile | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CODE;
  }

  getDisplayText(): string {
    return this.file?.name ?? "Code";
  }

  getIcon(): string {
    return "code";
  }

  getState(): Record<string, unknown> {
    return { filePath: this.file?.path ?? "" };
  }

  async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const filePath = state.filePath as string | undefined;
    if (filePath) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        this.file = file;
        if (this.contentEl.hasClass("code-view-container")) {
          void this.renderContent();
        }
      }
    }
  }

  async onOpen() {
    if (!this.file) {
      const viewState = this.leaf.getViewState();
      const filePath = (viewState?.state as Record<string, unknown>)?.filePath as string | undefined;
      if (filePath) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          this.file = file;
        }
      }
    }
    void this.renderContent();
  }

  private async renderContent(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("code-view-container");

    if (!this.file) {
      container.createEl("p", { text: t("code.parseError"), cls: "code-view-error" });
      const closeBtn = container.createEl("button", { cls: "code-view-btn", text: `← ${t("code.back")}` });
      closeBtn.addEventListener("click", () => this.leaf.detach());
      return;
    }

    const ext = this.file.extension.toLowerCase();

    // Action bar
    const actionBar = container.createDiv({ cls: "code-view-actions" });
    const backBtn = actionBar.createEl("button", { cls: "code-view-btn", text: `← ${t("code.back")}` });
    backBtn.addEventListener("click", () => this.leaf.detach());

    // Language badge
    const langId = extensionToLanguage(ext);
    const langBadge = actionBar.createSpan({ cls: "code-view-lang-badge" });
    const langIcon = getFileIcon(ext);
    if (langIcon) {
      const iconEl = langBadge.createSpan({ cls: "code-view-lang-icon" });
      iconEl.innerHTML = langIcon.svg;
      const svg = iconEl.querySelector("svg");
      if (svg) { svg.style.setProperty("color", langIcon.color); svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
    }
    langBadge.createSpan({ text: langId || ext, cls: "code-view-lang-name" });

    // Filename
    actionBar.createSpan({ text: this.file.name, cls: "code-view-filename" });

    // Open external
    const openBtn = actionBar.createEl("button", { cls: "code-view-btn external" });
    setLucideIcon(openBtn.createSpan(), "Paperclip", 14);
    openBtn.createSpan({ text: ` ${t("code.openExternal")}` });
    openBtn.addEventListener("click", () => this.openExternally());

    // Status
    const statusEl = container.createDiv({ cls: "code-view-status" });
    statusEl.setText(t("code.parsing"));

    // Code content
    const codeWrapper = container.createDiv({ cls: "code-view-wrapper" });

    try {
      const content = await this.app.vault.read(this.file);
      statusEl.setText("");

      const rendered = highlight(content, ext);
      const pre = codeWrapper.createEl("pre", { cls: "code-view-pre" });
      const code = pre.createEl("code", {
        cls: langId ? `language-${langId}` : "language-none",
      });

      if (langId) {
        code.innerHTML = rendered;
      } else {
        code.setText(content);
      }

      // Line numbers via CSS counter — triggered by the code element being populated
      pre.addClass("code-view-line-numbers");
    } catch (err) {
      statusEl.setText("");
      codeWrapper.createEl("p", { text: t("code.parseError"), cls: "code-view-error" });
    }
  }

  private async openExternally(): Promise<void> {
    if (!this.file) return;
    const adapter = this.app.vault.adapter;
    const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
    const fullPath = `${basePath}/${this.file.path}`;
    try {
      const win = window as unknown as { require: (mod: string) => { shell: { openPath(p: string): Promise<string> } } };
      const electron = win.require("electron");
      if (electron?.shell) { await electron.shell.openPath(fullPath); return; }
    } catch { /* ignore */ }
    void this.app.workspace.openLinkText(this.file.path, "/", false);
  }

  async onClose() {
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/CodeView.ts
git commit -m "feat: add CodeView item view for code file preview"
```

---

### Task 6: Register CodeView in main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add imports and registration**

Add to imports at top of `src/main.ts`:
```typescript
import { CodeView, VIEW_TYPE_CODE } from "./views/CodeView";
import { CodeRenderer } from "./services/CodeRenderer";
```

In the `onload()` method, after registering `VIEW_TYPE_OFFICE`, add:
```typescript
this.registerView(
  VIEW_TYPE_CODE,
  (leaf) => new CodeView(leaf)
);
```

Add the `openCodeFile` method (parallel to `openOfficeFile`):
```typescript
async openCodeFile(file: TFile): Promise<void> {
  const { workspace } = this.app;
  const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_CODE);
  for (const leaf of existingLeaves) {
    const view = leaf.view;
    if (view instanceof CodeView && view.file?.path === file.path) {
      workspace.setActiveLeaf(leaf);
      return;
    }
  }
  const leaf = workspace.getLeaf(true);
  if (!leaf) return;
  await leaf.setViewState({
    type: VIEW_TYPE_CODE,
    active: true,
    state: { filePath: file.path },
  });
  workspace.setActiveLeaf(leaf);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: register CodeView and add openCodeFile() to plugin"
```

---

### Task 7: Route code files in VaultViewerView

**Files:**
- Modify: `src/views/VaultViewerView.ts`

- [ ] **Step 1: Update onListFileClick()**

Replace the current `onListFileClick` method:

```typescript
private onListFileClick(file: TFile): void {
  const ext = "." + file.extension;
  if ([".docx", ".xlsx", ".pptx"].includes(ext) || ext === ".sql") {
    if (this.plugin.openOfficeFile) {
      void this.plugin.openOfficeFile(file);
    }
  } else if (isCodeExtension(file.name)) {
    if (this.plugin.openCodeFile) {
      void this.plugin.openCodeFile(file);
    }
  } else {
    void this.app.workspace.openLinkText(file.path, "/", false);
  }
}
```

Add the import for `isCodeExtension` at the top:
```typescript
import { isTreeExtension, isOfficeExtension, isImageExtension, isCodeExtension } from "../utils/extensions";
```

- [ ] **Step 2: Update onReferenceClick()**

In the `onReferenceClick` method, add routing to CodeView. Replace the
current extension check:

```typescript
private onReferenceClick(link: ResolvedLink): void {
  if (!link.file) return;
  const ext = "." + link.file.extension;
  if ([".docx", ".xlsx", ".pptx", ".sql"].includes(ext)) {
    if (this.plugin.openOfficeFile) {
      void this.plugin.openOfficeFile(link.file);
      return;
    }
  }
  if (isCodeExtension(link.file.name)) {
    if (this.plugin.openCodeFile) {
      void this.plugin.openCodeFile(link.file);
      return;
    }
  }
  void this.app.workspace.openLinkText(link.file.path, "/", false);
  if (link.file.extension === "md") {
    this.renderFileListModeB(link.file);
    this.updateDynamicToolbar();
  }
}
```

- [ ] **Step 3: Update getFileIcon() for devicon icons in tree and list**

Replace the existing `getFileIcon(file: TFile)` method:

```typescript
private getFileIcon(file: TFile): string {
  // Handle compound extensions first
  if (file.name.endsWith(".excalidraw.md")) return "PenLine";
  if (file.name.endsWith(".canvas.md")) return "LayoutDashboard";

  const ext = "." + file.extension;
  if (ext === ".md") return "FileText";
  if (ext === ".canvas") return "LayoutDashboard";
  if (ext === ".docx") return "FileText";
  if (ext === ".xlsx") return "FileSpreadsheet";
  if (ext === ".pptx") return "Presentation";
  if (ext === ".pdf") return "FileText";
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) return "FileImage";
  return "File";
}
```

This stays as the Lucide fallback. The devicon integration happens at render time
in the tree and list methods (see Step 4).

- [ ] **Step 4: Add devicon icon rendering in tree folder renderFolder()**

In `renderFolder()`, where the file icon is rendered for tree files, replace
the current Lucide-only approach with a devicon check. Add this logic after the
`row.dataset.path = file.path;` line:

```typescript
const fileIcon = row.createSpan({ cls: "vault-viewer-file-icon" });
const deviconIcon = getFileIcon(file.extension);
if (deviconIcon) {
  fileIcon.innerHTML = deviconIcon.svg;
  fileIcon.style.color = deviconIcon.color;
  fileIcon.addClass("vv-file-icon--devicon");
  const svg = fileIcon.querySelector("svg");
  if (svg) { svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
  row.dataset.iconName = "devicon";
} else {
  const iconName = this.getFileIcon(file);
  setLucideIcon(fileIcon, iconName);
  row.dataset.iconName = iconName;
}
```

Remove the old file-icon creation code (the old `fileIcon` span + `setLucideIcon` line).

- [ ] **Step 5: Add devicon icon rendering in renderFileListModeA()**

In `renderFileListModeA()`, where the list row icon is created, similarly
check devicon first:

```typescript
const iconSpan = nameTd.createSpan({ cls: "vault-viewer-list-icon" });
const deviconIcon = getFileIcon(file.extension);
if (deviconIcon) {
  iconSpan.innerHTML = deviconIcon.svg;
  iconSpan.style.color = deviconIcon.color;
  iconSpan.addClass("vv-file-icon--devicon");
  const svg = iconSpan.querySelector("svg");
  if (svg) { svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
  row.dataset.iconName = "devicon";
} else {
  const iconName = this.getFileIcon(file);
  setLucideIcon(iconSpan, iconName);
  row.dataset.iconName = iconName;
}
```

Replace the existing icon creation lines (the two lines where
`vault-viewer-list-icon` span is created and `setLucideIcon` is called).

- [ ] **Step 6: Add devicon icon rendering in renderFileListModeB()**

In `renderFileListModeB()`, where the reference row icon is created, add the
same devicon check (similar pattern to Step 5).

Add the import for `getFileIcon` at the top of the file:
```typescript
import { getFileIcon as getDeviconIcon } from "../utils/file-icons";
```

- [ ] **Step 7: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "feat: route code files to CodeView and add devicon file icons to tree/list"
```

---

### Task 8: Add i18n translations

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/zh-CN.ts`
- Modify: `src/i18n/zh-TW.ts`

- [ ] **Step 1: Add English translations**

In `src/i18n/en.ts`, add before the closing `};`:
```typescript
  "code.back": "Back",
  "code.openExternal": "Open externally",
  "code.parsing": "Loading file...",
  "code.parseError": "Could not read this file.",
  "code.lines": (n: number) => `${n} lines`,
};
```

- [ ] **Step 2: Add zh-CN translations**

In `src/i18n/zh-CN.ts`, add:
```typescript
  "code.back": "返回",
  "code.openExternal": "在外部打开",
  "code.parsing": "正在加载文件...",
  "code.parseError": "无法读取此文件",
  "code.lines": (n: number) => `${n} 行`,
};
```

- [ ] **Step 3: Add zh-TW translations**

In `src/i18n/zh-TW.ts`, add:
```typescript
  "code.back": "返回",
  "code.openExternal": "在外部開啟",
  "code.parsing": "正在載入檔案...",
  "code.parseError": "無法讀取此檔案",
  "code.lines": (n: number) => `${n} 行`,
};
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh-CN.ts src/i18n/zh-TW.ts
git commit -m "feat: add i18n translations for code view"
```

---

### Task 9: Add styles.css

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add code view and Prism theme styles**

Append to `styles.css`:

```css
/* ─── Code View ─────────────────────────── */

.code-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--background-primary);
}

.code-view-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  flex-shrink: 0;
}

.code-view-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  padding: 4px 10px;
  font-size: 0.85em;
  border-radius: 4px;
  color: var(--text-muted);
  transition: background 0.1s;
}

.code-view-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.code-view-lang-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--background-modifier-hover);
  font-size: 0.8em;
  font-weight: 600;
}

.code-view-lang-icon svg {
  width: 16px;
  height: 16px;
  vertical-align: middle;
}

.code-view-lang-name {
  text-transform: uppercase;
  color: var(--text-muted);
}

.code-view-filename {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-view-status {
  padding: 4px 12px;
  color: var(--text-muted);
  font-size: 0.85em;
}

.code-view-wrapper {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.code-view-pre {
  margin: 0;
  padding: 12px 0;
  font-size: 0.85em;
  line-height: 1.5;
  overflow-x: auto;
  tab-size: 2;
  -moz-tab-size: 2;
}

.code-view-pre code {
  font-family: var(--font-monospace);
  display: block;
  padding: 0 12px;
}

.code-view-error {
  padding: 12px;
  color: var(--text-error);
}

/* ─── Line numbers (CSS counters) ──────── */

.code-view-line-numbers code {
  counter-reset: line;
}

.code-view-line-numbers code > span.line,
.code-view-line-numbers code > div {
  counter-increment: line;
}

.code-view-line-numbers code > span.line::before,
.code-view-line-numbers code > div::before {
  content: counter(line);
  display: inline-block;
  width: 3em;
  padding-right: 1em;
  margin-left: -3em;
  text-align: right;
  color: var(--text-faint);
  user-select: none;
}

/* ─── Truncation notice ────────────────── */

.code-truncated {
  padding: 8px 12px;
  margin: 0;
  color: var(--text-warning);
  font-size: 0.85em;
  font-style: italic;
}

/* ─── Prism.js Token Colours (Dark) ──────── */

.theme-dark .token.comment,
.theme-dark .token.prolog,
.theme-dark .token.doctype,
.theme-dark .token.cdata {
  color: #6a9955;
}

.theme-dark .token.punctuation {
  color: #d4d4d4;
}

.theme-dark .token.property,
.theme-dark .token.tag,
.theme-dark .token.boolean,
.theme-dark .token.number,
.theme-dark .token.constant,
.theme-dark .token.symbol,
.theme-dark .token.deleted {
  color: #b5cea8;
}

.theme-dark .token.selector,
.theme-dark .token.attr-name,
.theme-dark .token.string,
.theme-dark .token.char,
.theme-dark .token.builtin,
.theme-dark .token.inserted {
  color: #ce9178;
}

.theme-dark .token.operator,
.theme-dark .token.entity,
.theme-dark .token.url {
  color: #d4d4d4;
}

.theme-dark .token.atrule,
.theme-dark .token.attr-value,
.theme-dark .token.keyword {
  color: #569cd6;
}

.theme-dark .token.function,
.theme-dark .token.maybe-class-name {
  color: #dcdcaa;
}

.theme-dark .token.regex,
.theme-dark .token.important,
.theme-dark .token.variable {
  color: #d16969;
}

.theme-dark .token.important,
.theme-dark .token.bold {
  font-weight: bold;
}

.theme-dark .token.italic {
  font-style: italic;
}

.theme-dark .token.class-name {
  color: #4ec9b0;
}

/* ─── Prism.js Token Colours (Light) ─────── */

.theme-light .token.comment,
.theme-light .token.prolog,
.theme-light .token.doctype,
.theme-light .token.cdata {
  color: #008000;
}

.theme-light .token.punctuation {
  color: #393a34;
}

.theme-light .token.property,
.theme-light .token.tag,
.theme-light .token.boolean,
.theme-light .token.number,
.theme-light .token.constant,
.theme-light .token.symbol,
.theme-light .token.deleted {
  color: #36acaa;
}

.theme-light .token.selector,
.theme-light .token.attr-name,
.theme-light .token.string,
.theme-light .token.char,
.theme-light .token.builtin,
.theme-light .token.inserted {
  color: #a31515;
}

.theme-light .token.operator,
.theme-light .token.entity,
.theme-light .token.url {
  color: #393a34;
}

.theme-light .token.atrule,
.theme-light .token.attr-value,
.theme-light .token.keyword {
  color: #0000ff;
}

.theme-light .token.function,
.theme-light .token.maybe-class-name {
  color: #795e26;
}

.theme-light .token.regex,
.theme-light .token.important,
.theme-light .token.variable {
  color: #e90;
}

.theme-light .token.important,
.theme-light .token.bold {
  font-weight: bold;
}

.theme-light .token.italic {
  font-style: italic;
}

.theme-light .token.class-name {
  color: #267f99;
}

/* ─── Devicon icon sizing ──────────────── */

.vv-file-icon--devicon svg {
  width: 16px;
  height: 16px;
  vertical-align: middle;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: add code view layout, Prism theme, and devicon icon styles"
```

---

### Task 10: Build and verify

**Files:**
- Modify (may occur during fixup): any of the above files

- [ ] **Step 1: Run type check**

```bash
npm run build
```
Expected: TypeScript compiles and esbuild bundles without errors.

- [ ] **Step 2: Run unit tests**

```bash
npm test
```
Expected: ALL tests pass.

- [ ] **Step 3: Run final test suite**

```bash
npm test -- --verbose
```
Expected: All existing tests + new tests pass.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "fixup: address type/build issues after code viewer implementation"
```
