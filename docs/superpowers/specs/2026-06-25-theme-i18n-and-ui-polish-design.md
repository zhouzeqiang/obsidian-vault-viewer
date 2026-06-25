# Theme, i18n, and UI Polish Design

## Overview

Four improvements to the Obsidian Vault Viewer plugin:

1. **Tree context menu alignment** — fix left-alignment of menu position and button contents
2. **Tree hide/show toggle** — add an Eye button to collapse/restore the tree panel
3. **Theme system** — 3 themes with custom icon sets and CSS variables
4. **Multi-language (i18n)** — Simplified Chinese, Traditional Chinese, English

---

## 1. Tree Context Menu Alignment

### Problem
- Button text not truly left-aligned: `display:flex` overrides `text-align:left`
- Menu position may overflow on right edge

### Fixes
- CSS: add `justify-content: flex-start` to `.vault-viewer-tree-context-menu button`
- Consistent padding: `6px 12px` (matching file list context menu)
- Menu overflow: keep `left: e.clientX` with overflow correction; verify the menu bounds correctly

### Files Changed
- `styles.css`: update `.vault-viewer-tree-context-menu button` block

---

## 2. Tree Hide/Show Toggle

### Behavior
- `Eye` icon button placed next to Search button in the right toolbar
- Click: toggles `display: none` on the entire tree panel (`.vault-viewer-tree-toolbar` + `.vault-viewer-tree`)
- File list area fills the freed vertical space
- State is **not persisted** (session-only)

### Implementation
- Add `eyeToggleEl` button in `buildRightToolbar()`
- Toggle CSS class `vault-viewer-tree-collapsed` on container
- CSS: when collapsed, tree and its toolbar get `display: none`; list area gets `flex: 1`

### Files Changed
- `src/views/VaultViewerView.ts`: add button + toggle logic
- `styles.css`: add collapsed state rules

---

## 3. Theme System

### Themes

| ID | Name | Icon Set | Visual Style |
|----|------|----------|-------------|
| `default` | 默认 (Default) | Lucide | Current Obsidian-native look |
| `fresh` | 清新简约 (Fresh) | Feather | White bg, sky-blue accent, rounded, spacious |
| `dark` | 暗色极简 (Dark) | Phosphor | Deep blue bg, cyan accent, sharp/bold, compact |

### Architecture

#### Icon Registry (`src/utils/icon-registry.ts`)
- Maps `(theme, iconName)` → SVG path string
- Three icon set records: Lucide paths (existing), Feather paths, Phosphor paths
- `createIcon(name, size)` — reads current theme from settings, picks correct path
- Replaces `createLucideIcon` / `setLucideIcon` throughout the codebase

#### Theme CSS (`styles.css`)
Default theme uses existing Obsidian CSS variables.
Fresh and Dark themes override via class on `.vault-viewer-container`:

```css
.vault-viewer-container.theme-fresh {
  --vv-bg: #ffffff;
  --vv-tree-bg: #f8fafc;
  --vv-accent: #0ea5e9;
  --vv-border: #e2e8f0;
  --vv-text: #1e293b;
  --vv-text-muted: #94a3b8;
  --vv-row-hover: #f1f5f9;
  --vv-tree-indent: 20px;
  --vv-row-height: 28px;
}

.vault-viewer-container.theme-dark {
  --vv-bg: #0f172a;
  --vv-tree-bg: #0f172a;
  --vv-accent: #38bdf8;
  --vv-border: #1e293b;
  --vv-text: #e2e8f0;
  --vv-text-muted: #64748b;
  --vv-row-hover: #1e293b;
  --vv-tree-indent: 16px;
  --vv-row-height: 24px;
}
```

All existing CSS selectors are updated to use `var(--vv-*)` variables so theme switching is purely CSS-driven.

### Settings
- Dropdown in settings tab: "主题" with options 默认/清新简约/暗色极简
- Saved to `settings.theme`
- Change takes effect immediately (re-renders view)

### Files Changed/Added
- `src/utils/icon-registry.ts` — NEW: icon path tables per theme
- `src/utils/lucide-icons.ts` — refactored into icon-registry.ts (or kept as re-export)
- `src/settings.ts` — add `theme` field
- `src/views/VaultViewerView.ts` — use `createIcon` instead of `createLucideIcon`; apply theme class
- `styles.css` — add theme CSS variable blocks

---

## 4. Multi-Language (i18n)

### Locale Files

```
src/i18n/
  index.ts     — exports current locale, `t()` helper
  zh-CN.ts     — 简体中文 strings
  zh-TW.ts     — 繁體中文 strings
  en.ts        — English strings
```

### String Coverage

All user-facing text in the plugin must use `t()`:

| Area | Examples |
|------|----------|
| Settings panel | titles, descriptions, dropdown labels, buttons |
| File list toolbar | sort options, search placeholder, mode indicator |
| Right-click menus | 打开所在文件夹, 复制路径, 删除, 在外部打开 |
| Tree toolbar | tooltips (new file, new folder, sort, expand, collapse, shows X of Y) |
| Modals | InputModal title/placeholder, ConfirmModal title/body |
| Notices | 已创建, 已删除, 创建失败, 删除失败, 路径已复制, etc. |
| OfficeView | 返回, 在外部打开, 正在解析文档, etc. |

### Architecture

```typescript
// src/i18n/index.ts
type StrOrFunc = string | ((...args: any[]) => string);
type LocaleMap = Record<string, StrOrFunc>;

function t(key: string, ...args: any[]): string {
  const map = localeMaps[currentLang];
  const val = map[key];
  return typeof val === "function" ? val(...args) : val ?? key;
}
```

### Settings
- Dropdown in settings tab: "语言 / Language" with 简体中文 / 繁體中文 / English
- Saved to `settings.lang`
- Change takes effect immediately (re-renders the view and settings tab)

### Files Changed/Added
- `src/i18n/index.ts` — NEW: `t()` helper, current locale
- `src/i18n/zh-CN.ts` — NEW: Simplified Chinese strings
- `src/i18n/zh-TW.ts` — NEW: Traditional Chinese strings
- `src/i18n/en.ts` — NEW: English strings
- `src/settings.ts` — add `lang` field; make all setting text use `t()`
- `src/views/VaultViewerView.ts` — replace all hardcoded Chinese strings with `t()`
- `src/views/OfficeView.ts` — replace hardcoded strings with `t()`
- `src/ui/InputModal.ts` — support localized text
- `src/ui/ConfirmModal.ts` — support localized text

---

## Data Model Changes

```typescript
// settings.ts
export interface VaultViewerSettings {
  // existing
  sortBy: "name" | "mtime" | "ctime" | "size";
  sortOrder: "asc" | "desc";
  hiddenExtensions: string[];
  treeExtensions: string[];
  treeSortEnabled: boolean;
  // new
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

## Implementation Order

1. CSS fix: tree context menu left-alignment (smallest, independent)
2. Icon registry: refactor lucide-icons.ts into multi-theme icon system
3. Theme CSS: define 3 theme variable blocks and apply
4. Eye toggle button: tree hide/show
5. i18n: create locale files and `t()` helper
6. String replacement: migrate all hardcoded strings to `t()` across all files

---

## Verification

- All 32 existing Jest tests must still pass
- Manual: switch themes in settings, verify all icons update immediately
- Manual: switch languages, verify all UI text changes immediately
- Manual: toggle tree show/hide, verify tree collapses/restores
