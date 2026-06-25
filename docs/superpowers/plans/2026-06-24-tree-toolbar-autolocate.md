# Tree Toolbar + Auto-locate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tree toolbar (new file, sort, expand/collapse all, root name), search toggle, and auto-locate on editor switch

**Architecture:** Extend existing VaultViewerView with toolbar DOM + handlers. Modify syncWithActiveEditor to auto-locate instead of auto-reference. One new setting toggle.

**Tech Stack:** Obsidian plugin API, TypeScript, CSS

---

### Task 1: Settings — add treeSortEnabled

**Files:**
- Modify: `src/settings.ts`
- Test: `__tests__/extensions.test.ts` (add one assertion for default)

- [ ] **Step 1: Add `treeSortEnabled` to settings interface + defaults**

In `src/settings.ts`, add `treeSortEnabled: boolean` to `VaultViewerSettings` and set `true` in `DEFAULT_SETTINGS`.

- [ ] **Step 2: Add settings UI toggle**

In `VaultViewerSettingTab.display()`, add a new `Setting` under "Tree display" section:

```ts
new Setting(containerEl)
  .setName("Sort folders A-Z")
  .setDesc("Sort folders alphabetically in the tree")
  .addToggle((t) =>
    t
      .setValue(this.plugin.settings.treeSortEnabled)
      .onChange(async (val) => {
        this.plugin.settings.treeSortEnabled = val;
        await this.plugin.saveSettings();
      })
  );
```

- [ ] **Step 3: Build + verify**

Run: `npm run build && npm test`
Expected: Build succeeds, all 25 tests pass.

---

### Task 2: CSS for tree toolbar + search toggle

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add tree toolbar CSS**

```css
.vault-viewer-tree-toolbar {
  flex: 0 0 auto;
  padding: 6px 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}

.vault-viewer-tree-toolbar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.vault-viewer-toolbar-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 1em;
  border-radius: 3px;
  transition: background 0.1s;
}

.vault-viewer-toolbar-btn:hover {
  background: var(--background-modifier-hover);
}

.vault-viewer-toolbar-btn.active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.vault-viewer-tree-root-name {
  font-size: 0.8em;
  color: var(--text-muted);
  padding: 0 4px;
}
```

- [ ] **Step 2: Add search toggle CSS**

```css
.vault-viewer-search-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 1em;
  border-radius: 3px;
  transition: background 0.1s;
}

.vault-viewer-search-toggle-btn:hover {
  background: var(--background-modifier-hover);
}

.vault-viewer-search-wrapper {
  display: none;
}

.vault-viewer-search-wrapper.visible {
  display: block;
}
```

- [ ] **Step 3: Update `.vault-viewer-search` to be inside wrapper**

No change needed — just wrap existing search input in `.vault-viewer-search-wrapper` which is hidden by default and shown when `.visible` class is added.

---

### Task 3: Tree toolbar rendering + button handlers

**Files:**
- Modify: `src/views/VaultViewerView.ts`

- [ ] **Step 1: Add `treeToolbarEl` property and create in `onOpen`**

Add property: `treeToolbarEl: HTMLElement;`

In `onOpen()`, after creating `this.treeEl`, insert the toolbar:

```ts
this.treeToolbarEl = container.createDiv({ cls: "vault-viewer-tree-toolbar" });
this.buildTreeToolbar();
```

And move `this.treeEl = container.createDiv({ cls: "vault-viewer-tree" });` after treeToolbarEl.

- [ ] **Step 2: Implement `buildTreeToolbar()`**

```ts
private buildTreeToolbar(): void {
  this.treeToolbarEl.empty();

  // Button row
  const btnRow = this.treeToolbarEl.createDiv({ cls: "vault-viewer-tree-toolbar-row" });

  // 📁 New file
  const newBtn = btnRow.createEl("button", {
    cls: "vault-viewer-toolbar-btn",
    text: "📁",
    attr: { title: "新建文件" },
  });
  newBtn.addEventListener("click", () => this.onNewFile());

  // ↕ Sort toggle
  const sortBtn = btnRow.createEl("button", {
    cls: "vault-viewer-toolbar-btn",
    text: "↕",
    attr: { title: "文件夹排序" },
  });
  if (this.plugin.settings.treeSortEnabled) sortBtn.addClass("active");
  sortBtn.addEventListener("click", () => {
    this.plugin.settings.treeSortEnabled = !this.plugin.settings.treeSortEnabled;
    this.plugin.saveSettings();
    sortBtn.toggleClass("active", this.plugin.settings.treeSortEnabled);
    this.renderTree();
  });

  // ▼ Expand all
  const expandBtn = btnRow.createEl("button", {
    cls: "vault-viewer-toolbar-btn",
    text: "▼",
    attr: { title: "展开全部" },
  });
  expandBtn.addEventListener("click", () => this.expandAllFolders());

  // ▲ Collapse all
  const collapseBtn = btnRow.createEl("button", {
    cls: "vault-viewer-toolbar-btn",
    text: "▲",
    attr: { title: "收缩全部" },
  });
  collapseBtn.addEventListener("click", () => this.collapseAllFolders());

  // Root name
  const vaultName = this.app.vault.getName() || "Vault";
  this.treeToolbarEl.createDiv({
    cls: "vault-viewer-tree-root-name",
    text: `📁 ${vaultName}`,
  });
}
```

- [ ] **Step 3: Implement `onNewFile()`**

```ts
private async onNewFile(): Promise<void> {
  const name = prompt("输入文件名（不需要 .md 后缀）:", "未命名");
  if (!name) return;

  const folder = this.currentFolder || this.app.vault.getRoot();
  const filePath = `${folder.path}/${name}.md`;

  try {
    await this.app.vault.create(filePath, "");
    // Re-render tree and auto-expand to the new file
    this.renderTree();
    // Find the new file in vault and locate it
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) this.locateInTree(file);
  } catch (e) {
    console.error("Vault Viewer: 新建文件失败", e);
  }
}
```

- [ ] **Step 4: Implement `expandAllFolders()` and `collapseAllFolders()`**

```ts
private expandAllFolders(): void {
  const treeEl = this.treeEl;
  for (const children of Array.from(treeEl.querySelectorAll(".vault-viewer-children"))) {
    (children as HTMLElement).style.display = "block";
  }
  for (const toggle of Array.from(treeEl.querySelectorAll(".vault-viewer-toggle-icon"))) {
    toggle.setText("▼");
  }
}

private collapseAllFolders(): void {
  const treeEl = this.treeEl;
  for (const children of Array.from(treeEl.querySelectorAll(".vault-viewer-children"))) {
    (children as HTMLElement).style.display = "none";
  }
  for (const toggle of Array.from(treeEl.querySelectorAll(".vault-viewer-toggle-icon"))) {
    toggle.setText("▶");
  }
}
```

- [ ] **Step 5: Wrap folder sort in `renderFolder` with setting check**

In `renderFolder()`, change:
```ts
const sortedSubfolders = [...subfolders].sort((a: any, b: any) =>
  a.name.localeCompare(b.name)
);
```
to:
```ts
const sortedSubfolders = this.plugin.settings.treeSortEnabled
  ? [...subfolders].sort((a: any, b: any) => a.name.localeCompare(b.name))
  : subfolders;
```

- [ ] **Step 6: Build + verify**

Run: `npm run build && npm test`
Expected: Build succeeds, all 25 tests pass.

---

### Task 4: Search toggle (🔍 show/hide)

**Files:**
- Modify: `src/views/VaultViewerView.ts`

- [ ] **Step 1: Add search wrapper in `buildStaticToolbar`**

Modify `buildStaticToolbar()` to wrap search in a togglable container and add 🔍 button:

```ts
private buildStaticToolbar(): void {
  const topRow = this.toolbarEl.createDiv({ cls: "vault-viewer-toolbar-row" });

  // 🔍 search toggle
  const searchToggleBtn = topRow.createEl("button", {
    cls: "vault-viewer-search-toggle-btn",
    text: "🔍",
    attr: { title: "搜索文件" },
  });

  // Search wrapper (hidden by default)
  const searchWrapper = this.toolbarEl.createDiv({ cls: "vault-viewer-search-wrapper" });
  const searchInput = searchWrapper.createEl("input", {
    cls: "vault-viewer-search",
    attr: { type: "text", placeholder: "搜索文件..." },
  });
  searchInput.addEventListener("input", () => {
    this.searchQuery = searchInput.value.toLowerCase();
    this.refreshFileList();
  });

  searchToggleBtn.addEventListener("click", () => {
    searchWrapper.toggleClass("visible");
    if (searchWrapper.hasClass("visible")) {
      searchInput.focus();
    }
  });

  // sort select + order button (unchanged)
  const sortSelect = topRow.createEl("select", { cls: "vault-viewer-sort" });
  // ... rest of existing sort code ...
}
```

Note: the sort select, order button, mode indicator, and filter tags remain unchanged. Only the search input moves into the wrapper.

- [ ] **Step 2: Build + verify**

Run: `npm run build && npm test`
Expected: Build succeeds, all 25 tests pass.

---

### Task 5: Auto-locate on editor switch

**Files:**
- Modify: `src/views/VaultViewerView.ts`

- [ ] **Step 1: Rewrite `syncWithActiveEditor()`**

Replace existing implementation:

```ts
private syncWithActiveEditor(): void {
  const activeView = this.app.workspace.getActiveViewOfType(
    (this.app as any).internalPlugins?.getPluginById("markdown")?.instance?.View
      ?.prototype?.constructor || Object
  );

  if (!activeView) return;
  const file = (activeView as any).file;
  if (!file || file.extension !== "md") return;

  // If already viewing this file's directory, skip
  if (this.currentMode === "directory" && this.currentFolder?.path === file.parent?.path) return;

  // Auto-locate in tree
  this.locateInTree(file);

  // Switch to directory mode showing parent folder
  const parentPath = file.parent ? file.parent.path : "/";
  this.currentFolder = file.parent || this.app.vault.getRoot();
  this.currentMode = "directory";
  this.renderFileListModeA(parentPath);
  this.updateDynamicToolbar();
}
```

- [ ] **Step 2: Build + verify**

Run: `npm run build && npm test`
Expected: Build succeeds, all 25 tests pass.

---

### Task 6: Build, deploy, verify

**Files:**
- (all modified files)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: 0 errors

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: 25 passed

- [ ] **Step 3: Deploy to vault**

```powershell
$vaultDir = (Get-ChildItem -LiteralPath "D:\app\obsidian" -Directory | Where-Object { $_.Name -ne "Superforce" }).FullName
$targetDir = Join-Path $vaultDir ".obsidian\plugins\vault-viewer"
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -LiteralPath "main.js" -Destination (Join-Path $targetDir "main.js") -Force
Copy-Item -LiteralPath "manifest.json" -Destination (Join-Path $targetDir "manifest.json") -Force
Copy-Item -LiteralPath "styles.css" -Destination (Join-Path $targetDir "styles.css") -Force
Write-Output "deployed"
```

Run from `D:\app\AI\projects\obsibian-document-management`

- [ ] **Step 4: Verify deployed files**

Check 4 files exist in target with correct sizes.

- [ ] **Step 5: Update AGENTS.md context summary**

Note: tree toolbar, search toggle, auto-locate features added.
