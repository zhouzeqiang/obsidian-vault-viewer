# Tree Toolbar + Auto-locate Design

## Overview

Add a toolbar to the file tree area in Vault Viewer sidebar, and change the active-editor sync behavior to auto-locate md files in the tree instead of auto-switching to reference mode.

## Changes

### 1. Tree Toolbar

A fixed horizontal bar at the top of `.vault-viewer-tree`, not scrolling with tree content.

**Layout:**

```
┌──────────────────────────────────┐
│ [📁] [↕] [▼] [▲]               │  ← icon buttons row
│ 📁 <root-folder-name>            │  ← root display name
├──────────────────────────────────┤
│ (tree content below)             │
└──────────────────────────────────┘
```

**Buttons:**

| Icon | Action | Detail |
|------|--------|--------|
| 📁 | New file | Creates `.md` in currently selected folder (`currentFolder`). Uses Obsidian's `app.vault.create()` with a prompt for filename (via `navigator.prompt` or Obsidian's modal). Falls back to vault root if no folder selected. |
| ↕ | Toggle sort | Toggles folder A-Z sorting on/off. Default: on. Off = use raw vault order. Re-renders tree. |
| ▼ | Expand all | Recursively sets `display: block` on all `.vault-viewer-children` elements, sets all toggle icons to `▼`. |
| ▲ | Collapse all | Sets all `.vault-viewer-children` to `display: none` (except root level), sets all toggle icons to `▶`. |

**Root name:** Displayed as `📁 <vault-name>` below buttons, read-only.

### 2. Search Toggle

The search input in `.vault-viewer-toolbar` (file list area) is hidden by default. A 🔍 icon button in the toolbar shows/hides it. When hidden, `.vault-viewer-search` is `display: none`. Clicking 🔍 toggles visibility.

**Layout (file list toolbar):**

```
┌──────────────────────────────────┐
│ 🔍   [sort-select] [order-btn]  │  ← filter bar row
│ 📁 /some/folder                  │  ← mode indicator
│ [___________] ⬅ shown when 🔍 toggled │
└──────────────────────────────────┘
```

### 3. Auto-locate on Editor Switch

Modify `syncWithActiveEditor()`:

- When an md file becomes active: call `locateInTree(file)`, then switch to **directory mode** showing the file's parent folder contents (`renderFileListModeA(parentPath)`)
- Remove the old behavior that auto-switched to reference mode
- Reference mode is still reachable by clicking a tree md file (existing `onFileClick` stays unchanged)

**New `syncWithActiveEditor` flow:**

```
active-leaf-change
  → get active file
  → if not .md: return
  → if already on this file in current mode: return (no-op)
  → locateInTree(file)          // expand + highlight
  → currentMode = "directory"
  → currentFolder = parent folder
  → renderFileListModeA(folder.path)
  → updateDynamicToolbar()
```

### 4. Tree Sort Toggle

- Add `treeSortEnabled: boolean` to plugin Settings (default: `true`)
- `renderFolder()` already sorts subfolders with `localeCompare` — wrap in `if (this.plugin.settings.treeSortEnabled)`
- The ↕ button toggles this setting, calls `saveSettings()` + `renderTree()`

### 5. Expand/Collapse All

- **ExpandAll:** querySelectorAll `.vault-viewer-children` → set `display: block` on each; update sibling toggle icons to `▼`
- **CollapseAll:** querySelectorAll `.vault-viewer-children` → set `display: none` (skip root children if needed); update toggle icons to `▶`

## Files Changed

| File | Changes |
|------|---------|
| `src/views/VaultViewerView.ts` | Add tree toolbar rendering, button handlers. Modify `syncWithActiveEditor`. Add `onOpen` changes to build toolbar. |
| `src/settings.ts` | Add `treeSortEnabled: boolean` to settings + UI toggle. |
| `styles.css` | Add tree toolbar styles, search toggle styles. |
| `src/utils/extensions.ts` | (no changes needed) |
| `src/services/FileService.ts` | (no changes needed) |

## Not In Scope

- Rename files from tree
- Delete files from tree
- Drag-and-drop file organization
- File type icons in tree rows (already exist)

## Testing

- Unit tests for sort toggle setting (settings.ts)
- Verify tree renders sorted/unsorted based on setting
- Manual: auto-locate on editor switch, expand/collapse all, search toggle
