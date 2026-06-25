# Tree Context Menu & Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working right-click context menu (locate, copy path, delete) and drag-and-drop moving to the Vault Viewer tree.

**Architecture:** Two independent features in `VaultViewerView.ts`. Context menu uses `showTreeContextMenu` with multiple items and `app.vault.trash()`. Drag-and-drop uses HTML5 Drag & Drop API on tree rows with visual feedback via CSS class.

**Tech Stack:** Obsidian API (`app.vault.trash`, `app.vault.rename`), HTML5 DnD API, Lucide icons

---

### Task 1: Rewrite tree context menu with locate/copy/delete

**Files:**
- Modify: `src/views/VaultViewerView.ts`

- [ ] **Step 1: Replace `showTreeContextMenu` with multi-item menu**

Current `showTreeContextMenu` only has a delete button. Replace it with a full context menu matching the file list pattern. The method needs to handle two item types:

```typescript
private showTreeContextMenu(e: MouseEvent, item: any, isFolder: boolean): void {
  e.preventDefault();
  e.stopPropagation();
  this.closeTreeContextMenu();

  const menu = this.contentEl.createDiv({ cls: "vault-viewer-tree-context-menu" });
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  // 打开所在文件夹 — files: locateInTree parent; folders: open folder
  const locateBtn = menu.createEl("button", { text: "打开所在文件夹" });
  locateBtn.addEventListener("click", () => {
    this.closeTreeContextMenu();
    if (isFolder) {
      this.onFolderClick(item);
    } else {
      this.locateInTree(item.parent || this.app.vault.getRoot());
    }
  });

  // 复制路径
  const copyBtn = menu.createEl("button", { text: "复制路径" });
  copyBtn.addEventListener("click", () => {
    this.closeTreeContextMenu();
    navigator.clipboard.writeText(item.path);
    new Notice("路径已复制");
  });

  // separator
  const sep = menu.createDiv({ cls: "vault-viewer-context-separator" });

  // 删除 — danger style
  const deleteBtn = menu.createEl("button", { cls: "danger", text: "删除" });
  deleteBtn.addEventListener("click", () => {
    this.closeTreeContextMenu();
    this.onTreeItemDelete(item, isFolder);
  });

  // viewport clamping: ensure menu doesn't overflow right/bottom edge
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const overflowX = rect.right - window.innerWidth;
    const overflowY = rect.bottom - window.innerHeight;
    if (overflowX > 0) menu.style.left = `${e.clientX - rect.width}px`;
    if (overflowY > 0) menu.style.top = `${e.clientY - rect.height}px`;
  });

  const clickHandler = (ev: MouseEvent) => {
    if (!menu.contains(ev.target as Node)) {
      this.closeTreeContextMenu();
      document.removeEventListener("click", clickHandler);
    }
  };
  setTimeout(() => document.addEventListener("click", clickHandler), 0);
}
```

- [ ] **Step 2: Replace `onTreeItemDelete` with actual deletion**

Remove the old stub that showed a Notice. Implement real deletion with `app.vault.trash()`. Remove the backlink check (user chose no confirmation). Keep non-empty folder check.

```typescript
private onTreeItemDelete(item: any, isFolder: boolean): void {
  const name = isFolder ? `文件夹 "${item.name}"` : `文件 "${item.name}"`;
  if (isFolder && item.children) {
    const nonEmpty = (item.children as any[]).filter((c: any) => c.children !== undefined || c.extension);
    if (nonEmpty.length > 0) {
      new Notice(`无法删除：${name} 非空`, 5000);
      return;
    }
  }
  try {
    this.app.vault.trash(item, true);
    new Notice(`已删除 ${name}`);
    const savedExpanded = this.saveExpandedState();
    this.renderTree();
    this.restoreExpandedState(savedExpanded);
    this.refreshFileList();
  } catch (e) {
    new Notice(`删除失败: ${e.message}`);
  }
}
```

**Note:** `app.vault.trash(file, true)` moves to system trash; `app.vault.trash(file, false)` moves to Obsidian `.trash` folder. Using `true` for system trash as per user preference.

---

### Task 2: Add drag-and-drop to tree rows

**Files:**
- Modify: `src/views/VaultViewerView.ts`

- [ ] **Step 1: Add `dragstart` handler to all tree rows**

In `renderTree()` (root row) and `renderFolder()` (folder rows + file rows), add:
```typescript
row.draggable = true;
row.addEventListener("dragstart", (ev: DragEvent) => {
  ev.dataTransfer?.setData("text/plain", item.path);
  ev.dataTransfer!.effectAllowed = "move";
});
```

For root row (at `renderTree()`):
- Add `rootRow.draggable = true` after creating `rootRow`
- Add `dragstart` listener with `item = rootFolder`

For folder rows (in `renderFolder()`):
- After `row.dataset.path = subfolder.path;`, add `draggable = true` + `dragstart` with `item = subfolder`

For file rows (in `renderFolder()`):
- After `row.dataset.path = file.path;`, add `draggable = true` + `dragstart` with `item = file`

- [ ] **Step 2: Add `dragover`, `dragleave`, `drop` to folder rows**

Add these to root row and all folder rows (but NOT file rows — you can't drop onto a file).

For root row (in `renderTree()`) and folder rows (in `renderFolder()`), add after the click handler:

```typescript
row.addEventListener("dragover", (ev: DragEvent) => {
  ev.preventDefault();
  ev.dataTransfer!.dropEffect = "move";
  row.addClass("drag-over");
});

row.addEventListener("dragleave", () => {
  row.removeClass("drag-over");
});

row.addEventListener("drop", (ev: DragEvent) => {
  ev.preventDefault();
  row.removeClass("drag-over");
  const srcPath = ev.dataTransfer?.getData("text/plain");
  if (!srcPath) return;
  if (srcPath === item.path) return; // cannot drop onto itself
  // cannot drop folder into its own descendant
  if (item.path.startsWith(srcPath + "/")) return;
  this.moveTreeItem(srcPath, item);
});
```

**Important:** For root row, `item` is `rootFolder`. For folder rows, `item` is `subfolder`. Make sure the scope captures `item` correctly in each case — use `let subfolder = subfolderItem` in the for loop if needed, or use an IIFE, or use `forEach` with a callback.

Actually, the current code uses `for (const subfolder of sortedSubfolders)` which already creates a per-iteration binding. The `item` in the listener closure will correctly reference each iteration's `subfolder`. Same for file rows.

- [ ] **Step 3: Add `moveTreeItem` helper method**

Add a new method after `onTreeItemDelete`:

```typescript
private moveTreeItem(srcPath: string, targetFolder: any): void {
  const file = this.app.vault.getAbstractFileByPath(srcPath);
  if (!file) {
    new Notice(`未找到文件: ${srcPath}`);
    return;
  }
  const newPath = targetFolder.path === "/"
    ? file.name
    : `${targetFolder.path}/${file.name}`;
  if (newPath === srcPath) return;
  try {
    this.app.vault.rename(file, newPath);
    new Notice(`已移动到 ${targetFolder.name || "根目录"}`);
    const savedExpanded = this.saveExpandedState();
    this.renderTree();
    this.restoreExpandedState(savedExpanded);
    this.refreshFileList();
  } catch (e) {
    new Notice(`移动失败: ${e.message}`);
  }
}
```

---

### Task 3: Add drag-over CSS style

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add drag-over style**

Add at the end of `styles.css`:

```css
.vault-viewer-folder.drag-over {
  background: var(--interactive-accent-hover);
  border-radius: 3px;
}
```

---

### Task 4: Build, test, deploy

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: No TypeScript errors, zero output

- [ ] **Step 2: Run unit tests**

Run: `npx jest --passWithNoTests`
Expected: 25 tests passing

- [ ] **Step 3: Deploy to vault**

Run:
```powershell
Copy-Item -LiteralPath "D:\app\AI\projects\obsibian-document-management\main.js" -Destination "D:\app\obsidian\我的知识库\.obsidian\plugins\vault-viewer\main.js" -Force
Copy-Item -LiteralPath "D:\app\AI\projects\obsibian-document-management\styles.css" -Destination "D:\app\obsidian\我的知识库\.obsidian\plugins\vault-viewer\styles.css" -Force
```

Verify files were updated (check sizes).
