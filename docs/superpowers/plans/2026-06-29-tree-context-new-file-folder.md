# Tree Context Menu: New File & Folder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "New Markdown file" and "New folder" to the right-click context menu on folder rows in the tree view.

**Architecture:** Extract shared creation methods from existing toolbar handlers so both toolbar buttons and new context menu items share the same creation logic. The context menu already exists (`showTreeContextMenu`) and follows a pattern of building button elements with icons.

**Tech Stack:** Obsidian plugin (TypeScript), Jest

---

### Task 1: Add i18n keys for new context menu items

**Files:**
- Modify: `src/i18n/en.ts:41`
- Modify: `src/i18n/zh-CN.ts:41`
- Modify: `src/i18n/zh-TW.ts:41`

- [ ] **Step 1: Add to `en.ts`**

After `"treeContext.delete": "Delete",` add:

```typescript
  "treeContext.newFile": "New Markdown file",
  "treeContext.newFolder": "New folder",
```

- [ ] **Step 2: Add to `zh-CN.ts`**

After `"treeContext.delete": "删除",` add:

```typescript
  "treeContext.newFile": "新建 Markdown 文件",
  "treeContext.newFolder": "新建文件夹",
```

- [ ] **Step 3: Add to `zh-TW.ts`**

After `"treeContext.delete": "刪除",` add:

```typescript
  "treeContext.newFile": "新增 Markdown 檔案",
  "treeContext.newFolder": "新增資料夾",
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh-CN.ts src/i18n/zh-TW.ts
git commit -m "i18n: add tree context menu new file/folder keys"
```

---

### Task 2: Extract shared creation methods in VaultViewerView

**Files:**
- Modify: `src/views/VaultViewerView.ts` (around line 229-258)

- [ ] **Step 1: Add `createFileInFolder` method** (insert before `onNewFile` around line 229)

```typescript
  private async createFileInFolder(folder: TFolder): Promise<void> {
    new InputModal(this.app, t("modal.newFile"), t("modal.fileName"), "未命名", async (name) => {
      const filePath = `${folder.path}/${name}.md`;
      try {
        await this.app.vault.create(filePath, "");
        const savedExpanded = this.saveExpandedState();
        this.renderTree();
        this.restoreExpandedState(savedExpanded);
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) this.locateInTree(file);
        new Notice(t("notice.fileCreated", `${name}.md`));
      } catch (e) {
        new Notice(t("notice.createFailed", (e as Error).message));
        console.error("Vault Viewer: 新建文件失败", e);
      }
    }).open();
  }
```

- [ ] **Step 2: Add `createFolderInFolder` method** (after `createFileInFolder`)

```typescript
  private async createFolderInFolder(folder: TFolder): Promise<void> {
    new InputModal(this.app, t("modal.newFolder"), t("modal.folderName"), "新建文件夹", async (name) => {
      const folderPath = `${folder.path}/${name}`;
      try {
        await this.app.vault.createFolder(folderPath);
        const savedExpanded = this.saveExpandedState();
        this.renderTree();
        this.restoreExpandedState(savedExpanded);
        const newFolder = this.app.vault.getAbstractFileByPath(folderPath);
        if (newFolder instanceof TFolder) this.highlightParentAndFolder(newFolder);
        new Notice(t("notice.folderCreated", name));
      } catch (e) {
        new Notice(t("notice.createFailed", (e as Error).message));
        console.error("Vault Viewer: 新建文件夹失败", e);
      }
    }).open();
  }
```

- [ ] **Step 3: Add `highlightParentAndFolder` helper** (after `createFolderInFolder`)

This helper expands ancestors and highlights the folder row. A `TFolder` is not a `TFile`, so we can't use `locateInTree` directly. Instead:

```typescript
  private highlightParentAndFolder(folder: TFolder): void {
    const path = folder.path;
    // Expand all ancestors in the tree
    const parts = path.split("/");
    const treeEl = this.treeEl;

    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join("/");
      const folderRow = treeEl.querySelector(
        `.vault-viewer-folder[data-path="${ancestorPath}"]`
      ) as HTMLElement;
      if (!folderRow) continue;
      const childrenEl = folderRow.nextElementSibling as HTMLElement;
      if (childrenEl?.hasClass?.("vault-viewer-children") && childrenEl.hasClass("hidden")) {
        childrenEl.removeClass("hidden");
        const toggle = folderRow.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
        if (toggle) { toggle.empty(); setLucideIcon(toggle, "ChevronDown"); }
        const fIcon = folderRow.querySelector(".vault-viewer-folder-icon") as HTMLElement;
        if (fIcon) { fIcon.empty(); setLucideIcon(fIcon, "FolderOpenDot"); }
      }
    }

    // Highlight the folder itself
    const escapedPath = path.replace(/"/g, '\\"');
    const targetRow = treeEl.querySelector(
      `[data-path="${escapedPath}"]`
    ) as HTMLElement;
    if (targetRow) this.highlightRow(targetRow);
  }
```

- [ ] **Step 4: Refactor `onNewFile` to delegate**

Replace `onNewFile()` body:

```typescript
  private onNewFile(): void {
    const folder = this.currentFolder || this.app.vault.getRoot();
    this.createFileInFolder(folder);
  }
```

- [ ] **Step 5: Refactor `onNewFolder` to delegate**

Replace `onNewFolder()` body:

```typescript
  private onNewFolder(): void {
    const parent = this.currentFolder || this.app.vault.getRoot();
    this.createFolderInFolder(parent);
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "feat: extract createFileInFolder and createFolderInFolder shared methods"
```

---

### Task 3: Add context menu items to tree right-click menu

**Files:**
- Modify: `src/views/VaultViewerView.ts` (inside `showTreeContextMenu` around line 1092)

- [ ] **Step 1: Insert "New Markdown file" button before the separator in `showTreeContextMenu`**

When `isFolder === true`, add before `menu.createDiv({ cls: "vault-viewer-context-separator" })`:

```typescript
    if (isFolder) {
      const newFileBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
      setLucideIcon(newFileBtn.createSpan(), "FilePlusCorner", 14);
      newFileBtn.createSpan({ text: ` ${t("treeContext.newFile")}` });
      newFileBtn.addEventListener("click", () => {
        this.closeTreeContextMenu();
        this.createFileInFolder(item as TFolder);
      });

      const newFolderBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
      setLucideIcon(newFolderBtn.createSpan(), "FolderPlus", 14);
      newFolderBtn.createSpan({ text: ` ${t("treeContext.newFolder")}` });
      newFolderBtn.addEventListener("click", () => {
        this.closeTreeContextMenu();
        this.createFolderInFolder(item as TFolder);
      });

      menu.createDiv({ cls: "vault-viewer-context-separator" });
    }
```

- [ ] **Step 2: Remove the always-present separator** (currently at line 1090)

Look for the existing `menu.createDiv({ cls: "vault-viewer-context-separator" });` before the Delete button and remove it — the separator is now conditionally inserted inside the `if (isFolder)` block. If right-clicking a file, no separator is shown between the top items and the delete button.

Wait — check the existing code: the separator is currently always created (line 1090). With this change:
- When right-clicking a **folder**: the `if (isFolder)` block adds new file/folder + separator → then Delete follows
- When right-clicking a **file**: the `if (isFolder)` block is skipped → no separator appears before Delete

We need a separator before Delete for the file case too. Adjust: keep the separator unconditional after the `if (isFolder)` block:

```typescript
    if (isFolder) {
      // ... new file button ...
      // ... new folder button ...
    }

    menu.createDiv({ cls: "vault-viewer-context-separator" });
```

- [ ] **Step 3: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "feat: add new file/folder to tree context menu"
```

---

### Task 4: Run tests and verify

- [ ] **Step 1: Run existing tests**

Run: `npm test`
Expected: All existing tests pass.

- [ ] **Step 2: Final verification checklist**

1. Open Obsidian with the plugin loaded (run `npm run dev` to rebuild)
2. Right-click a subfolder in tree → "New Markdown file" and "New folder" visible
3. Right-click a file in tree → these items absent, delete still works
4. Click "New Markdown file" on a subfolder → InputModal appears → enter name → file created, tree auto-locates and highlights
5. Click "New folder" on a subfolder → folder created, tree auto-locates and highlights
6. Toolbar "New Markdown file" and "New folder" buttons still work as before
7. Right-click vault root → new items present and functional
8. Try creating with duplicate name → error notice shown

- [ ] **Step 3: Commit any final adjustments**

```bash
git add -A
git commit -m "test: verify tree context menu new file/folder feature"
```
