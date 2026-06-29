# Tree Context Menu: New File & Folder

Date: 2026-06-29
Author: AI brainstorming session

## Summary

Add "New Markdown file" and "New folder" options to the existing right-click context menu on folder rows in the tree view of Vault Viewer.

## Motivation

Users currently must use toolbar buttons at the top of the tree area to create new files/folders, which always create under `currentFolder`. There is no way to create items directly under a specific subfolder without first navigating there. Right-clicking a folder should offer these creation actions in place.

## Files Changed

| File | Change |
|------|--------|
| `src/views/VaultViewerView.ts` | Extract shared creation methods; add context menu items |
| `src/i18n/en.ts` | Add `treeContext.newFile`, `treeContext.newFolder` |
| `src/i18n/zh-CN.ts` | Add `treeContext.newFile`, `treeContext.newFolder` |
| `src/i18n/zh-TW.ts` | Add `treeContext.newFile`, `treeContext.newFolder` |

## Detailed Design

### 1. Extract shared creation methods

Two new private methods, called by both the existing toolbar buttons and the new context menu items:

```
private async createFileInFolder(folder: TFolder): Promise<void>
private async createFolderInFolder(folder: TFolder): Promise<void>
```

These contain the creation logic currently in `onNewFile()` / `onNewFolder()`, with `folder` as a parameter instead of hardcoding `this.currentFolder`.

- `createFileInFolder`: opens `InputModal` for filename, calls `this.app.vault.create(folder.path + "/" + name + ".md", "")`, refreshes tree, calls `locateInTree` on the new file.
- `createFolderInFolder`: opens `InputModal` for folder name, calls `this.app.vault.createFolder(folder.path + "/" + name)`, refreshes tree, calls `locateParentInTree` on the new folder.

### 2. Refactor existing toolbar methods

- `onNewFile()` → `this.createFileInFolder(this.currentFolder || this.app.vault.getRoot())`
- `onNewFolder()` → `this.createFolderInFolder(this.currentFolder || this.app.vault.getRoot())`

### 3. Add context menu items

In `showTreeContextMenu(e, item, isFolder)`, when `isFolder === true`, add two buttons before the separator (before the Delete button):

- "New Markdown file" — icon `FilePlusCorner` — calls `createFileInFolder(item as TFolder)` then closes menu
- "New folder" — icon `FolderPlus` — calls `createFolderInFolder(item as TFolder)` then closes menu

These items are NOT shown when right-clicking a file (only folders).

### 4. Auto-locate after creation

- For file creation: `locateInTree(newFile)` expands ancestor folders and highlights the new file row.
- For folder creation: `locateParentInTree(newFolder)` expands ancestors and highlights the new folder row.

### Edge Cases

- **Root folder**: Right-clicking the vault root includes the new items (root is a folder).
- **Name conflict**: `vault.create` / `createFolder` throws; caught and displayed via `Notice`.
- **File context menu**: Unchanged — no new items appear.
- **Tree collapse state**: `locateInTree` only expands paths to the target; other branches unaffected.
- **Concurrent vault changes**: Tree re-renders after create, reflecting any concurrent changes.

## i18n Keys

```
treeContext.newFile  = "New Markdown file" / "新建 Markdown 文件"
treeContext.newFolder = "New folder" / "新建文件夹"
```

## Testing

1. Right-click a subfolder → "New Markdown file" and "New folder" visible
2. Right-click a file → these items absent
3. Create file via context menu → tree auto-locates and highlights it
4. Create folder via context menu → tree auto-locates and highlights it
5. Toolbar buttons unchanged after refactoring
6. Duplicate name → error notice shown
