# Theme, i18n, and UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add theme system (3 themes+icon sets), multi-language (zh-CN/zh-TW/en), tree hide toggle, and fix tree context menu alignment.

**Architecture:** Centralized icon registry maps (theme→iconName→SVG path). i18n strings loaded from locale files with `t()` helper. CSS-driven themes via custom properties.

**Tech Stack:** Obsidian plugin, TypeScript, Jest, Lucide/Feather/Phosphor icon SVGs

---

### Task 0: Install icon packages

- [ ] **Install feather-icons and @phosphor-icons/core**

```bash
npm install feather-icons @phosphor-icons/core
```

These provide the SVG paths for the 2 new theme icon sets.

---

### Task 1: CSS fixes — context menu + eye toggle + theme variables

**Files:**
- Modify: `styles.css`

- [ ] **1a: Fix tree context menu button alignment**

Add `justify-content: flex-start` and consistent `padding: 6px 12px`:

```css
.vault-viewer-tree-context-menu button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85em;
  color: var(--text-normal);
}
```

- [ ] **1b: Add eye toggle collapsed state CSS**

```css
.vault-viewer-container.vault-viewer-tree-collapsed .vault-viewer-tree-toolbar,
.vault-viewer-container.vault-viewer-tree-collapsed .vault-viewer-tree,
.vault-viewer-container.vault-viewer-tree-collapsed .vault-viewer-resizer {
  display: none;
}
.vault-viewer-container.vault-viewer-tree-collapsed .vault-viewer-list-area {
  flex: 1;
}
```

- [ ] **1c: Add theme CSS variable blocks**

```css
/* Default theme — uses Obsidian CSS variables (no override needed) */

/* Fresh theme */
.vault-viewer-container.theme-fresh {
  --vv-bg: #ffffff;
  --vv-tree-bg: #f8fafc;
  --vv-accent: #0ea5e9;
  --vv-border: #e2e8f0;
  --vv-text: #1e293b;
  --vv-text-muted: #94a3b8;
  --vv-row-hover: #f1f5f9;
}

/* Dark theme */
.vault-viewer-container.theme-dark {
  --vv-bg: #0f172a;
  --vv-tree-bg: #0f172a;
  --vv-accent: #38bdf8;
  --vv-border: #1e293b;
  --vv-text: #e2e8f0;
  --vv-text-muted: #64748b;
  --vv-row-hover: #1e293b;
}
```

- [ ] **1d: Update existing selectors to use `var(--vv-*)`**

Affected selectors (replace hardcoded colors with variables):
- `.vault-viewer-tree` — `var(--vv-border)`
- `.vault-viewer-tree-toolbar` — `var(--vv-tree-bg)`, `var(--vv-border)`
- `.vault-viewer-toolbar-row` — `var(--vv-tree-bg)`, `var(--vv-border)`
- `.vault-viewer-toolbar-row-2` — `var(--vv-tree-bg)`, `var(--vv-border)`
- `.vault-viewer-context-menu` — `var(--vv-bg)`, `var(--vv-border)`
- `.vault-viewer-tree-context-menu` — `var(--vv-bg)`, `var(--vv-border)`
- `.vault-viewer-list-row:hover` — `var(--vv-row-hover)`
- `.vault-viewer-tree-row:hover` — `var(--vv-row-hover)`
- `.vault-viewer-list` — `var(--vv-bg)`
- `.vault-viewer-filter-tag` — `var(--vv-accent)`

Replace `var(--background-primary)`, `var(--background-secondary)`, `var(--background-modifier-hover)`, `var(--interactive-accent)`, `var(--background-modifier-border)`, `var(--text-normal)` with their `var(--vv-*)` equivalents in all vault-viewer specific selectors. Keep Obsidian internal classes unchanged.

---

### Task 2: Icon registry

**Files:**
- Create: `src/utils/icon-registry.ts`
- Modify: `src/utils/lucide-icons.ts` (re-export from registry)

- [ ] **2a: Create icon-registry.ts**

```typescript
import { createLucideIcon, setLucideIcon } from "./lucide-icons";
import type VaultViewerPlugin from "../main";

let plugin: VaultViewerPlugin | null = null;

export function initIconRegistry(p: VaultViewerPlugin): void {
  plugin = p;
}

function getTheme(): string {
  return plugin?.settings?.theme || "default";
}

// Re-export with theme awareness
export { createLucideIcon, setLucideIcon };

// Aliases that use current theme
export function createIcon(name: string, size: number = 16): string {
  return createLucideIcon(name, size);
}

export function setIcon(el: HTMLElement, name: string, size: number = 16): void {
  setLucideIcon(el, name, size);
}
```

The idea: `lucide-icons.ts` will hold ALL 3 icon sets. `createLucideIcon` will check `getTheme()` and pick the right path. This way existing imports continue working.

- [ ] **2b: Expand lucide-icons.ts with 3 icon sets**

The current `paths` record becomes a `Record<string, Record<string, string>>` keyed by theme:

```typescript
type ThemeIconSet = Record<string, string>;

const iconSets: Record<string, ThemeIconSet> = {
  default: {
    FolderPlus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    // ... all existing Lucide paths (keep as-is)
  },
  fresh: {
    // Feather icon paths - to be extracted from feather-icons package
    FolderPlus: '<path d="..."/>',  // actual paths from npm package
    // ...
  },
  dark: {
    // Phosphor icon paths - to be extracted from @phosphor-icons/core
    FolderPlus: '<path d="..."/>',  // actual paths from npm package
    // ...
  },
};
```

Step 2b-1: Extract Feather SVG paths for each icon from `node_modules/feather-icons/dist/icons/`

```bash
# For each icon name, read the SVG file and extract inner content
Get-ChildItem node_modules/feather-icons/dist/icons/*.svg | ForEach-Object {
  $name = $_.BaseName
  $content = Get-Content $_.FullName -Raw
  $inner = $content -replace '<svg[^>]*>', '' -replace '</svg>', ''
  Write-Output "${name}: '${inner}',"
}
```

Step 2b-2: Extract Phosphor SVG paths for each icon from `node_modules/@phosphor-icons/core/assets/`

```bash
# Same approach for Phosphor
Get-ChildItem node_modules/@phosphor-icons/core/assets/*.svg | ForEach-Object {
  # Phosphor uses PascalCase names with "Phosphor" suffix
  ...
}
```

Step 2b-3: Add `getTheme()` helper that reads `window.__vaultViewerTheme` or plugin settings:

```typescript
let currentTheme: string = "default";

export function setIconTheme(theme: string): void {
  currentTheme = theme;
}

export function getIconTheme(): string {
  return currentTheme;
}
```

Step 2b-4: Update `createLucideIcon` to use `currentTheme`:

```typescript
export function createLucideIcon(name: string, size: number = 16): string {
  const themePaths = iconSets[currentTheme] || iconSets.default;
  const iconPath = themePaths[name];
  if (!iconPath) return "";
  return `<svg ...>${iconPath}</svg>`;
}
```

- [ ] **2c: Update imports in VaultViewerView.ts**

Replace:
```typescript
import { createLucideIcon, setLucideIcon } from "../utils/lucide-icons";
```
With:
```typescript
import { createLucideIcon, setLucideIcon } from "../utils/lucide-icons";
import { setIconTheme } from "../utils/lucide-icons";
```

(No import change needed since we're extending the existing module)

---

### Task 3: Settings update

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/main.ts`

- [ ] **3a: Add theme and lang to settings interface**

```typescript
export interface VaultViewerSettings {
  sortBy: "name" | "mtime" | "ctime" | "size";
  sortOrder: "asc" | "desc";
  hiddenExtensions: string[];
  treeExtensions: string[];
  treeSortEnabled: boolean;
  theme: "default" | "fresh" | "dark";
  lang: "zh-CN" | "zh-TW" | "en";
}

export const DEFAULT_SETTINGS: VaultViewerSettings = {
  sortBy: "name",
  sortOrder: "asc",
  hiddenExtensions: [],
  treeExtensions: [".md", ".canvas", ".excalidraw.md"],
  treeSortEnabled: true,
  theme: "default",
  lang: "zh-CN",
};
```

- [ ] **3b: Add theme dropdown to settings tab**

```typescript
containerEl.createEl("h2", { text: "Vault Viewer 设置" });

new Setting(containerEl)
  .setName("主题 / Theme")
  .setDesc("切换界面主题")
  .addDropdown((dd) =>
    dd
      .addOption("default", "默认 Default")
      .addOption("fresh", "清新简约 Fresh")
      .addOption("dark", "暗色极简 Dark")
      .setValue(this.plugin.settings.theme)
      .onChange(async (val: "default" | "fresh" | "dark") => {
        this.plugin.settings.theme = val;
        await this.plugin.saveSettings();
        // Re-render view with new theme
        this.plugin.activateView();
      })
  );
```

- [ ] **3c: Add language dropdown to settings tab**

```typescript
new Setting(containerEl)
  .setName("语言 / Language")
  .setDesc("切换界面语言")
  .addDropdown((dd) =>
    dd
      .addOption("zh-CN", "简体中文")
      .addOption("zh-TW", "繁體中文")
      .addOption("en", "English")
      .setValue(this.plugin.settings.lang)
      .onChange(async (val: "zh-CN" | "zh-TW" | "en") => {
        this.plugin.settings.lang = val;
        await this.plugin.saveSettings();
        this.display(); // Re-render settings tab
      })
  );
```

- [ ] **3d: Initialize theme in main.ts onload and on settings change**

In `main.ts`, after loading settings:
```typescript
import { setIconTheme } from "./utils/lucide-icons";

async onload() {
  await this.loadSettings();
  setIconTheme(this.settings.theme);
  // ...
}

async saveSettings() {
  await this.saveData(this.settings);
  setIconTheme(this.settings.theme);
}
```

---

### Task 4: i18n system

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/zh-CN.ts`
- Create: `src/i18n/zh-TW.ts`
- Create: `src/i18n/en.ts`

- [ ] **4a: Create locale data files**

`src/i18n/zh-CN.ts`:
```typescript
const zhCN: Record<string, string | ((...args: any[]) => string)> = {
  // Settings
  "settings.title": "Vault Viewer 设置",
  "settings.theme": "主题",
  "settings.themeDesc": "切换界面主题",
  "settings.lang": "语言",
  "settings.langDesc": "切换界面语言",
  "settings.defaultSort": "默认排序字段",
  "settings.defaultSortDesc": "文件列表排序方式",
  "settings.sortOrder": "排序顺序",
  "settings.hideTypes": "隐藏文件类型",
  "settings.hideTypesDesc": "默认隐藏的文件扩展名（每行一个）",
  "settings.treeExtensions": "树形文件类型",
  "settings.treeExtensionsDesc": "显示在目录树中的扩展名（每行一个）",
  "settings.sortFolders": "文件夹排序",
  "settings.sortFoldersDesc": "按字母顺序排序文件夹",
  "settings.themeDefault": "默认 Default",
  "settings.themeFresh": "清新简约 Fresh",
  "settings.themeDark": "暗色极简 Dark",

  // Tree toolbar tooltips
  "tree.newFile": "新建 Markdown 文件",
  "tree.newFolder": "新建文件夹",
  "tree.sortFolders": "文件夹排序",
  "tree.expandAll": "展开全部",
  "tree.collapseAll": "收缩全部",

  // Right toolbar tooltips
  "toolbar.search": "搜索文件",
  "toolbar.sortOptions": "排序选项",
  "toolbar.toggleTree": "显示/隐藏文件树",

  // Search placeholder
  "search.placeholder": "搜索文件...",

  // Sort options
  "sort.name": "名称",
  "sort.mtime": "修改时间",
  "sort.ctime": "创建时间",
  "sort.size": "文件大小",
  "sort.asc": "升序",
  "sort.desc": "降序",
  "sort.reset": "重置为默认",

  // Context menu - file list
  "context.openFolder": "打开所在文件夹",
  "context.copyPath": "复制文件路径",
  "context.copyName": "复制文件名",
  "context.openExternal": "在外部打开",

  // Context menu - tree
  "treeContext.openFolder": "打开所在文件夹",
  "treeContext.copyPath": "复制路径",
  "treeContext.delete": "删除",

  // Notices
  "notice.fileCreated": (name: string) => `已创建 ${name}`,
  "notice.folderCreated": (name: string) => `已创建文件夹 ${name}`,
  "notice.fileDeleted": (name: string) => `已删除 ${name}`,
  "notice.folderDeleted": (name: string) => `已删除文件夹 ${name}`,
  "notice.createFailed": (msg: string) => `创建失败: ${msg}`,
  "notice.deleteFailed": (msg: string) => `删除失败: ${msg}`,
  "notice.pathCopied": "路径已复制",
  "notice.nameCopied": "文件名已复制",
  "notice.cantDeleteNonEmpty": (name: string) => `无法删除：${name} 非空`,

  // Modals
  "modal.newFile": "新建 Markdown 文件",
  "modal.fileName": "文件名",
  "modal.newFolder": "新建文件夹",
  "modal.folderName": "文件夹名称",
  "modal.confirmDelete": "确认删除",
  "modal.confirmDeleteBody": (name: string) => `确认删除 ${name}？`,

  // Mode indicator
  "mode.references": (name: string) => `${name} 的引用`,

  // OfficeView
  "office.back": "返回",
  "office.openExternal": "在外部打开",
  "office.parsing": "正在解析文档...",
  "office.parseError": "无法解析此文档，可能格式不兼容",
  "office.openInEditor": "在外部编辑器中打开",

  // Empty states
  "empty.noFiles": "此目录下无其他类型文件",

  // File list
  "list.locateInTree": "在目录树中定位",

  // Badges
  "badge.embed": "嵌入",
};

export default zhCN;
```

`src/i18n/zh-TW.ts`:
Same structure but Traditional Chinese translations.

`src/i18n/en.ts`:
Same structure but English translations.

- [ ] **4b: Create i18n index.ts**

```typescript
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import en from "./en";

const locales: Record<string, Record<string, string | ((...args: any[]) => string)>> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en": en,
};

let currentLang = "zh-CN";

export function setLang(lang: string): void {
  currentLang = lang;
}

export function getLang(): string {
  return currentLang;
}

export function t(key: string, ...args: any[]): string {
  const map = locales[currentLang];
  if (!map) return key;
  const val = map[key];
  if (val === undefined) return key;
  return typeof val === "function" ? val(...args) : val;
}
```

- [ ] **4c: Initialize i18n in main.ts**

```typescript
import { setLang } from "./i18n";

async onload() {
  await this.loadSettings();
  setLang(this.settings.lang);
  // ...
}

async saveSettings() {
  await this.saveData(this.settings);
  setLang(this.settings.lang);
}
```

---

### Task 5: VaultViewerView — all changes

**Files:**
- Modify: `src/views/VaultViewerView.ts`

This is the largest task. All string replacements, icon references, theme application, and the eye toggle button.

- [ ] **5a: Import i18n and add theme class on init**

Add import:
```typescript
import { t, setLang } from "../i18n";
```

In `onOpen()`, after loading settings:
```typescript
setLang(this.plugin.settings.lang);
container.addClass(`theme-${this.plugin.settings.theme}`);
```

Background: The class `theme-default`, `theme-fresh`, or `theme-dark` is applied to the container.

Also update the `onOpen` method to set theme class on container:
```typescript
const themeClass = `theme-${this.plugin.settings.theme}`;
container.addClass(themeClass);
```

And when theme changes, update the class (add a public method):
```typescript
public applyTheme(): void {
  const container = this.contentEl;
  container.removeClass("theme-default", "theme-fresh", "theme-dark");
  container.addClass(`theme-${this.plugin.settings.theme}`);
}
```

- [ ] **5b: Add eye toggle button in buildRightToolbar()**

In `buildRightToolbar()`, after search toggle and before sort button:

```typescript
const eyeToggleEl = this.toolbarEl.createEl("button", {
  cls: "vault-viewer-toolbar-icon-btn",
  attr: { title: t("toolbar.toggleTree") },
});
setLucideIcon(eyeToggleEl, "Eye");
eyeToggleEl.addEventListener("click", () => {
  const container = this.contentEl;
  container.toggleClass("vault-viewer-tree-collapsed");
  const isCollapsed = container.hasClass("vault-viewer-tree-collapsed");
  eyeToggleEl.empty();
  setLucideIcon(eyeToggleEl, isCollapsed ? "EyeOff" : "Eye");
});
```

- [ ] **5c: Add EyeOff icon to lucide-icons.ts**

```typescript
// In all 3 icon sets (default/fresh/dark)
Eye: '<path d="..."/>',  // existing icon for visible
EyeOff: '<path d="..."/>',  // crossed-out eye
```

Eye SVG path (Lucide):
```
<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
```
EyeOff SVG path (Lucide):
```
<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
```

- [ ] **5d: Replace ALL hardcoded Chinese strings with t() calls**

Find every occurrence of Chinese text in VaultViewerView.ts and replace:

Tree toolbar button tooltips:
```
"新建 Markdown 文件" → t("tree.newFile")
"新建文件夹" → t("tree.newFolder")
"文件夹排序" → t("tree.sortFolders")
"展开全部" → t("tree.expandAll")
"收缩全部" → t("tree.collapseAll")
```

Right toolbar:
```
"搜索文件" → t("toolbar.search")
"排序选项" → t("toolbar.sortOptions")
```

Search:
```
"搜索文件..." → t("search.placeholder")
```

New file/folder modals:
```
new InputModal(this.app, "新建 Markdown 文件", "文件名", ...)
→ new InputModal(this.app, t("modal.newFile"), t("modal.fileName"), ...)

new InputModal(this.app, "新建文件夹", "文件夹名称", ...)
→ new InputModal(this.app, t("modal.newFolder"), t("modal.folderName"), ...)
```

Notices:
```
Notice(`已创建 ${name}.md`) → Notice(t("notice.fileCreated", `${name}.md`))
Notice(`已创建文件夹 ${name}`) → Notice(t("notice.folderCreated", name))
Notice(`创建失败: ${e.message}`) → Notice(t("notice.createFailed", e.message))
Notice(`已删除 ${name}`) → Notice(t("notice.fileDeleted", name))
Notice(`已删除文件夹 ${name}`) → Notice(t("notice.folderDeleted", name))
Notice(`删除失败: ${e.message}`) → Notice(t("notice.deleteFailed", e.message))
Notice("路径已复制") → Notice(t("notice.pathCopied"))
Notice("文件名已复制") → Notice(t("notice.nameCopied"))
Notice(`无法删除：${name} 非空`) → Notice(t("notice.cantDeleteNonEmpty", name))
```

Context menu items text:
```
"打开所在文件夹" → t("context.openFolder")
"复制文件路径" → t("context.copyPath")
"复制文件名" → t("context.copyName")
"在外部打开" → t("context.openExternal")
```

Tree context menu:
```
"打开所在文件夹" → t("treeContext.openFolder")
"复制路径" → t("treeContext.copyPath")
"删除" → t("treeContext.delete")
```

Mode indicator:
```
`${this.currentFile.name} 的引用` → t("mode.references", this.currentFile.name)
```

Confirm modal:
```
new ConfirmModal(this.app, "确认删除", `确认删除 ${name}？`, ...)
→ new ConfirmModal(this.app, t("modal.confirmDelete"), t("modal.confirmDeleteBody", name), ...)
```

Sort dropdown options:
```
"名称" → t("sort.name")
"修改时间" → t("sort.mtime")
"创建时间" → t("sort.ctime")
"文件大小" → t("sort.size")
"升序" → t("sort.asc")
"降序" → t("sort.desc")
```

Empty state:
```
"此目录下无其他类型文件" → t("empty.noFiles")
```

Locate button title:
```
"在目录树中定位" → t("list.locateInTree")
```

Badge:
```
"嵌入" → t("badge.embed")
```

---

### Task 6: Other files i18n

**Files:**
- Modify: `src/views/OfficeView.ts`
- Modify: `src/ui/InputModal.ts`
- Modify: `src/ui/ConfirmModal.ts`
- Modify: `src/settings.ts` (settings tab display text)

- [ ] **6a: OfficeView.ts**

Add import and replace strings:
```typescript
import { t } from "../i18n";

// Replace:
"← 返回" → `← ${t("office.back")}`
"📎 在外部打开" → `${createLucideIcon("Paperclip", 14)} ${t("office.openExternal")}`
"正在解析文档..." → t("office.parsing")
"无法解析此文档，可能格式不兼容" → t("office.parseError")
"📎 在外部编辑器中打开" → `${createLucideIcon("Paperclip", 14)} ${t("office.openInEditor")}`
```

Note: `createLucideIcon` is already imported in OfficeView.ts.

- [ ] **6b: InputModal.ts**

Read current file and add i18n support:

```typescript
// Current InputModal constructor:
// constructor(app: App, title: string, label: string, defaultVal: string, onSubmit: (val: string) => void)

// The callers pass localized strings now (from task 5d), so InputModal itself doesn't need changes.
// But add a default placeholder:
// this.inputEl.placeholder = "..."  (unchanged)
```

- [ ] **6c: ConfirmModal.ts**

Same as InputModal — callers pass localized strings, no change needed.

- [ ] **6d: Settings tab text**

In `src/settings.ts`:
```typescript
import { t, setLang } from "../i18n";

// Replace all hardcoded setting names/descriptions with t() calls

// "Vault Viewer Settings" → t("settings.title")
// "Default sort field" → t("settings.defaultSort")
// "How files are sorted in the list" → t("settings.defaultSortDesc")
// "Sort order" → t("settings.sortOrder")
// "Ascending" → t("sort.asc")
// "Descending" → t("sort.desc")
// "File type visibility" → t("settings.hideTypes") (section header)
// "Hide file types" → t("settings.hideTypes")
// "File extensions to hide by default..." → t("settings.hideTypesDesc")
// "Tree display" → t("settings.sortFolders") (section header)
// "Show in tree" → t("settings.treeExtensions")
// "File extensions to show in tree..." → t("settings.treeExtensionsDesc")
// "Sort folders A-Z" → t("settings.sortFolders")
// "Sort folders alphabetically in the tree" → t("settings.sortFoldersDesc")
```

Also import `setLang` and call it when language is changed:
```typescript
.onChange(async (val: "zh-CN" | "zh-TW" | "en") => {
  this.plugin.settings.lang = val;
  await this.plugin.saveSettings();
  setLang(val);
  this.display();
})
```

---

### Task 7: Build, test, deploy

- [ ] **7a: Build**

```bash
Set-Location -LiteralPath "D:\app\AI\projects\obsibian-document-management"
npx esbuild src/main.ts --bundle --external:obsidian --format=cjs --outfile=main.js --log-level=warning
```

- [ ] **7b: Run tests**

```bash
npx jest --verbose
```

Expected: All 32 tests pass.

- [ ] **7c: Deploy to vault**

```bash
Copy-Item -LiteralPath "D:\app\AI\projects\obsibian-document-management\main.js" -Destination "D:\app\obsidian\我的知识库\.obsidian\plugins\vault-viewer\main.js" -Force
Copy-Item -LiteralPath "D:\app\AI\projects\obsibian-document-management\styles.css" -Destination "D:\app\obsidian\我的知识库\.obsidian\plugins\vault-viewer\styles.css" -Force
```
