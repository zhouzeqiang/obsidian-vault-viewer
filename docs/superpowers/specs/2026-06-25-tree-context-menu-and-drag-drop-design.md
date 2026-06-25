# Tree Context Menu & Drag-and-Drop Design

## Overview

Enhance the Vault Viewer tree with two features:
1. **Tree right-click context menu** with actual operations (locate, copy path, delete)
2. **Tree drag-and-drop** to move files and folders between directories

Both features operate only within the tree component (not the file list).

## Feature 1: Tree Right-Click Context Menu

### Current State
- Tree items (root, subfolders, files) already have `contextmenu` listeners
- `showTreeContextMenu()` creates a `position: fixed` div with only a "删除" button
- `onTreeItemDelete()` only shows a Notice — no actual deletion

### Requirements
- Files: "打开所在文件夹" (locate parent in tree), "复制路径" (copy path), "删除" (delete to trash)
- Folders: "打开所在文件夹" (open folder in tree + file list), "复制路径" (copy path), "删除" (delete to trash, non-empty blocked)
- Context menu positioned at mouse cursor (`clientX/clientY`) with viewport boundary clamping
- No confirmation dialog — direct delete to Obsidian `.trash`

### Implementation Design

**Menu structure (per item type):**

| Item | File | Folder |
|------|------|--------|
| 打开所在文件夹 | `locateInTree(file.parent)` | `onFolderClick(folder)` + expand |
| 复制路径 | `clipboard.writeText(file.path)` | `clipboard.writeText(folder.path)` |
| — separator | ✓ | ✓ |
| 删除 | `app.vault.trash(file, true)` | check empty, then `app.vault.trash(folder, true)` |

**Delete flow:**
- Files: call `app.vault.trash(file, true)` directly
- Folders: check `folder.children` for any children (subfolders or files); if non-empty, show Notice and abort; if empty, call `app.vault.trash(folder, true)`
- After delete: save expanded state → call `renderTree()` → restore expanded state → call `refreshFileList()` if the deleted item was in the current view
- Error handling: wrap in try/catch, show Notice on failure

**Viewport clamping:**
- After setting `left = e.clientX`, check if menu would overflow right edge; if so, set `left = e.clientX - menu.offsetWidth`
- Same for bottom edge vs `top`

### Files Changed
- `src/views/VaultViewerView.ts`: rewrite `showTreeContextMenu()`, replace `onTreeItemDelete()` with actual implementation, add viewport clamping helper
- `styles.css`: no changes needed (existing `.vault-viewer-tree-context-menu` styles apply)

## Feature 2: Tree Drag-and-Drop

### Current State
- No drag-and-drop functionality exists

### Requirements
- Drag tree items (files and folders) to another folder node in the tree
- Visual feedback: highlight target folder on `dragover`
- Prevent invalid moves (folder into itself, folder into its own descendant)
- After move: save expanded state → `renderTree()` → restore expanded state → if moved item was in current file list, refresh

### Implementation Design

**Chosen approach: HTML5 Drag & Drop API**

**Per-file changes in `VaultViewerView.ts`:**

**Setting up draggable rows:**
- In `renderFolder()` and root row creation, set `row.draggable = true` on all tree rows (folders and files)
- Store drag data in `dragstart` event: `e.dataTransfer.setData("text/plain", item.path)` + `e.dataTransfer.effectAllowed = "move"`

**Target folder highlighting:**
- On root row and all folder rows in `renderFolder()`, add `dragover` listener
- `dragover`: `e.preventDefault()` (to allow drop), add a CSS class for highlight
- `dragleave`: remove highlight class
- `drop`: execute the move

**Drop validation:**
- Cannot drop a folder onto itself (same path)
- Cannot drop a folder into its own descendant (check if drop target path starts with dragged path)
- Invalid drops → show brief visual feedback (flash red) and abort

**Move execution:**
- For files: `app.vault.rename(file, newPath)` where newPath is `targetFolder.path + "/" + file.name`
- For folders: `app.vault.rename(folder, newPath)` — Obsidian handles recursive moves internally
- Same-file/folder name conflicts: Obsidian vault API handles this (throws error if path exists)
- After move: save expanded → `renderTree()` → restore → refresh if needed

**Visual feedback CSS:**
- `.vault-viewer-folder.drag-over { background: var(--interactive-accent-hover); }` — applied on `dragover`, removed on `dragleave`/`drop`

### Error Handling
- try/catch around all `app.vault.trash()` and `app.vault.rename()` calls
- Show `new Notice()` with error message on failure
- Non-empty folder delete: show Notice "文件夹非空，无法删除"

### Files Changed
- `src/views/VaultViewerView.ts`: add drag event handlers in `renderTree()` and `renderFolder()`, add `moveItem()` helper, add path validation
- `styles.css`: add `.vault-viewer-folder.drag-over` style

## Testing
- Unit tests for drag validation logic (can be extracted as pure functions)
- No visual/interaction tests needed (Obsidian plugin environment)
- Manual testing: drag tree files/folders between folders, verify tree re-renders correctly, verify file list updates
