# Apple-Style Folder Name Typography

Date: 2026-07-03
Author: AI brainstorming session

## Summary

Apply macOS Finder-inspired typography to folder names in the directory tree, making them visually distinct from file names through increased font weight, subtle letter-spacing, antialiased rendering, and deeper color — creating a clear visual hierarchy that mirrors Apple's design language.

## Motivation

Currently, folder names and file names in the directory tree share the same `.vault-viewer-tree-name` class with no font-weight or color differentiation. This makes it hard to visually distinguish folders from files at a glance. Applying Apple-style typography (semi-bold weight, refined spacing, antialiased smoothing) to folder names creates a natural visual hierarchy where folders stand out as structural elements and files recede as content items.

## Files Changed

| File | Change |
|------|--------|
| `styles.css` | Add folder-specific typography rules for `.vault-viewer-folder .vault-viewer-tree-name` and file-specific rules for `.vault-viewer-tree-row:not(.vault-viewer-folder) .vault-viewer-tree-name` |

No TypeScript changes required. The existing `.vault-viewer-folder` class on tree rows already provides the CSS hook needed to differentiate folders from files.

## Detailed Design

### 1. Folder name typography

Target selector: `.vault-viewer-folder .vault-viewer-tree-name`

| Property | Value | Rationale |
|----------|-------|-----------|
| `font-weight` | `600` | Semi-bold, matching macOS Finder sidebar folder labels |
| `letter-spacing` | `0.01em` | Subtle spacing increase for a rounder, more open feel |
| `-webkit-font-smoothing` | `antialiased` | macOS-style font smoothing for crisper, thinner strokes |
| `color` | `var(--vv-text, var(--text-normal))` | Use theme's primary text color instead of muted, making folders more prominent |

### 2. File name typography (contrast)

Target selector: `.vault-viewer-tree-row:not(.vault-viewer-folder) .vault-viewer-tree-name`

| Property | Value | Rationale |
|----------|-------|-----------|
| `font-weight` | `400` | Regular weight, contrasting with folder's 600 |
| `color` | `var(--vv-text-muted, var(--text-muted))` | Muted color, visually receding behind folders |

### 3. Theme adaptation

Both Default and Fresh themes apply the same typography rules. Since the rules use CSS variables (`--vv-text`, `--vv-text-muted`), each theme's existing color palette automatically adapts:

- **Default theme**: `--vv-text` is not defined, so falls back to Obsidian's `--text-normal`; `--vv-text-muted` falls back to `--text-muted`
- **Fresh theme**: `--vv-text` is defined as `#14532d` (deep green); `--vv-text-muted` is defined as `#65a30d` (lighter green)

No theme-specific overrides needed.

### 4. CSS rules to add

```css
/* Apple-style folder name typography */
.vault-viewer-folder .vault-viewer-tree-name {
  font-weight: 600;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
  color: var(--vv-text, var(--text-normal));
}

/* File name: lighter weight for visual contrast */
.vault-viewer-tree-row:not(.vault-viewer-folder) .vault-viewer-tree-name {
  font-weight: 400;
  color: var(--vv-text-muted, var(--text-muted));
}
```

These rules should be placed near the existing `.vault-viewer-tree-row .vault-viewer-tree-name` rule (around line 843 in `styles.css`) for logical grouping.

## Scope

- **In scope**: Directory tree folder/file name typography only
- **Out of scope**: File list area, Office preview, settings UI, context menus, drag-and-drop behavior, hover effects

## Visual Effect

Before (no differentiation):
```
📁 项目文档          md 3 / other 5     ← same weight as files
📄 readme.md                            ← same weight as folders
```

After (Apple-style hierarchy):
```
📁 项目文档          md 3 / other 5     ← semi-bold, deeper color, refined spacing
📄 readme.md                            ← regular weight, muted color (recedes)
```

## Testing

- Verify folder names appear semi-bold in both Default and Fresh themes
- Verify file names appear regular weight and muted in both themes
- Verify hover highlight still works correctly on both folders and files
- Verify drag-and-drop visual feedback is unaffected
- Verify right-click context menus are unaffected
- Verify the tree toggle (expand/collapse) still functions correctly
- Test in both Obsidian light and dark modes
