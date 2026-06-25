import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import VaultViewerPlugin from "../main";
import { createLucideIcon, setLucideIcon } from "../utils/lucide-icons";
import { InputModal } from "../ui/InputModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { t } from "../i18n";

export const VIEW_TYPE_VAULT_VIEWER = "vault-viewer-view";

export class VaultViewerView extends ItemView {
  plugin: VaultViewerPlugin;
  treeToolbarEl: HTMLElement;
  treeEl: HTMLElement;
  resizerEl: HTMLElement;
  toolbarEl: HTMLElement;
  modeIndicatorEl: HTMLElement;
  filterTagsEl: HTMLElement;
  filterRowEl: HTMLElement;
  listContentEl: HTMLElement;
  listEl: HTMLElement;
  contextMenuEl: HTMLElement | null = null;
  currentMode: "directory" | "references" = "directory";
  currentFolder: any = null;
  currentFile: any = null;
  searchQuery: string = "";
  syncTimeout: number = 0;
  sortDropdownEl: HTMLElement | null = null;
  sortBtnEl: HTMLElement;
  orderBtnEl: HTMLElement;
  searchWrapperEl: HTMLElement;
  searchToggleEl: HTMLElement;
  eyeToggleEl: HTMLElement;
  selectedEl: HTMLElement | null = null;
  selectedListPath: string | null = null;
  private isResizing: boolean = false;
  private expandedPaths: Set<string> = new Set();
  private listCollapsed: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin: VaultViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_VAULT_VIEWER;
  }

  getDisplayText(): string {
    return "Vault Viewer";
  }

  getIcon(): string {
    return "files";
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("vault-viewer-container");
    container.addClass(`theme-${this.plugin.settings.theme}`);

    this.treeToolbarEl = container.createDiv({ cls: "vault-viewer-tree-toolbar" });
    this.buildTreeToolbar();
    this.treeEl = container.createDiv({ cls: "vault-viewer-tree" });
    this.resizerEl = container.createDiv({ cls: "vault-viewer-resizer" });

    this.setupResizer();

    const listArea = container.createDiv({ cls: "vault-viewer-list-area" });

    this.toolbarEl = listArea.createDiv({ cls: "vault-viewer-toolbar-row" });
    this.modeIndicatorEl = this.toolbarEl.createDiv({ cls: "vault-viewer-mode" });
    this.buildRightToolbar();

    this.filterRowEl = listArea.createDiv({ cls: "vault-viewer-toolbar-row-2" });
    this.filterTagsEl = this.filterRowEl.createDiv({ cls: "vault-viewer-filters" });

    this.searchWrapperEl = listArea.createDiv({ cls: "vault-viewer-search-wrapper" });
    const searchInput = this.searchWrapperEl.createEl("input", {
      cls: "vault-viewer-search",
      attr: { type: "text", placeholder: t("search.placeholder") },
    });
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value.toLowerCase();
      this.refreshFileList();
    });

    this.listContentEl = listArea.createDiv({ cls: "vault-viewer-list-content" });
    this.listEl = this.listContentEl.createDiv({ cls: "vault-viewer-list" });

    this.renderTree();
    this.renderFileListModeA("/");
    this.updateDynamicToolbar();

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = window.setTimeout(() => {
          this.syncWithActiveEditor();
        }, 150);
      })
    );

    if (this.plugin.fileService) {
      this.plugin.fileService.startListening((type, file) => {
        this.renderTree();
        this.updateDynamicToolbar();
        this.refreshFileList();
      });
    }

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (
          this.currentMode === "references" &&
          this.currentFile &&
          this.currentFile.path === file.path
        ) {
          this.renderFileListModeB(this.currentFile);
          this.updateDynamicToolbar();
        }
      })
    );
  }

  async onClose() {
    this.contentEl.empty();
  }

  private setupResizer(): void {
    const onMouseDown = (e: MouseEvent) => {
      this.isResizing = true;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      const startY = e.clientY;
      const startHeight = this.treeEl.offsetHeight;

      const onMouseMove = (ev: MouseEvent) => {
        if (!this.isResizing) return;
        const delta = ev.clientY - startY;
        const newHeight = Math.max(40, startHeight + delta);
        this.treeEl.style.height = `${newHeight}px`;
        this.treeEl.style.flex = "none";
      };

      const onMouseUp = () => {
        this.isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    this.resizerEl.addEventListener("mousedown", onMouseDown);
  }

  private syncWithActiveEditor(): void {
    const activeView = this.app.workspace.getActiveViewOfType(
      (this.app as any).internalPlugins?.getPluginById("markdown")?.instance?.View
        ?.prototype?.constructor || Object
    );

    if (!activeView) return;
    const file = (activeView as any).file;
    if (!file || file.extension !== "md") return;

    // Always locate in tree first, then skip re-render if already in same context
    this.locateInTree(file);

    if (this.currentMode === "references" && this.currentFile?.path === file.path) return;
    if (this.currentMode === "directory" && this.currentFolder?.path === file.parent?.path) return;

    const parentPath = file.parent ? file.parent.path : "/";
    this.currentFolder = file.parent || this.app.vault.getRoot();
    this.currentMode = "directory";
    this.renderFileListModeA(parentPath);
    this.updateDynamicToolbar();
  }

  // ─── Tree Toolbar ─────────────────────────────────

  private buildTreeToolbar(): void {
    this.treeToolbarEl.empty();

    const btnRow = this.treeToolbarEl.createDiv({ cls: "vault-viewer-tree-toolbar-row" });

    const newFileBtn = btnRow.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("tree.newFile") },
    });
    setLucideIcon(newFileBtn, "FilePlusCorner");
    newFileBtn.addEventListener("click", () => this.onNewFile());

    const newFolderBtn = btnRow.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("tree.newFolder") },
    });
    setLucideIcon(newFolderBtn, "FolderPlus");
    newFolderBtn.addEventListener("click", () => this.onNewFolder());

    const sortBtn = btnRow.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("tree.sortFolders") },
    });
    setLucideIcon(sortBtn, "ArrowUpDown");
    if (this.plugin.settings.treeSortEnabled) sortBtn.addClass("active");
    sortBtn.addEventListener("click", () => {
      this.plugin.settings.treeSortEnabled = !this.plugin.settings.treeSortEnabled;
      this.plugin.saveSettings();
      sortBtn.toggleClass("active", this.plugin.settings.treeSortEnabled);
      this.renderTree();
    });

    const expandBtn = btnRow.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("tree.expandAll") },
    });
    setLucideIcon(expandBtn, "ChevronsUpDown");
    expandBtn.addEventListener("click", () => this.expandAllFolders());

    const collapseBtn = btnRow.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("tree.collapseAll") },
    });
    setLucideIcon(collapseBtn, "ChevronsDownUp");
    collapseBtn.addEventListener("click", () => this.collapseAllFolders());
  }

  private onNewFile(): void {
    const folder = this.currentFolder || this.app.vault.getRoot();
    new InputModal(this.app, t("modal.newFile"), t("modal.fileName"), "未命名", async (name) => {
      const filePath = `${folder.path}/${name}.md`;
      try {
        await this.app.vault.create(filePath, "");
        this.renderTree();
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file) this.locateInTree(file);
        new Notice(t("notice.fileCreated", `${name}.md`));
      } catch (e) {
        new Notice(t("notice.createFailed", e.message));
        console.error("Vault Viewer: 新建文件失败", e);
      }
    }).open();
  }

  private onNewFolder(): void {
    const parent = this.currentFolder || this.app.vault.getRoot();
    new InputModal(this.app, t("modal.newFolder"), t("modal.folderName"), "新建文件夹", async (name) => {
      const folderPath = `${parent.path}/${name}`;
      try {
        await this.app.vault.createFolder(folderPath);
        this.renderTree();
        new Notice(t("notice.folderCreated", name));
      } catch (e) {
        new Notice(t("notice.createFailed", e.message));
        console.error("Vault Viewer: 新建文件夹失败", e);
      }
    }).open();
  }

  private expandAllFolders(): void {
    const treeEl = this.treeEl;
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-children"))) {
      (el as HTMLElement).style.display = "block";
    }
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-toggle-icon"))) {
      (el as HTMLElement).empty();
      setLucideIcon(el as HTMLElement, "ChevronDown");
    }
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-folder-icon"))) {
      (el as HTMLElement).empty();
      setLucideIcon(el as HTMLElement, "FolderOpenDot");
    }
  }

  private collapseAllFolders(): void {
    const treeEl = this.treeEl;
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-children"))) {
      (el as HTMLElement).style.display = "none";
    }
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-toggle-icon"))) {
      (el as HTMLElement).empty();
      setLucideIcon(el as HTMLElement, "ChevronRight");
    }
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-folder-icon"))) {
      (el as HTMLElement).empty();
      setLucideIcon(el as HTMLElement, "Folder");
    }
  }

  // ─── File list toolbar (top row, buttons on right) ───

  private buildRightToolbar(): void {
    const spacer = this.toolbarEl.createDiv({ cls: "vault-viewer-toolbar-spacer" });

    this.eyeToggleEl = this.toolbarEl.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("toolbar.toggleTree") },
    });
    setLucideIcon(this.eyeToggleEl, "Eye");
    this.eyeToggleEl.addEventListener("click", () => {
      this.listCollapsed = !this.listCollapsed;
      this.eyeToggleEl.empty();
      setLucideIcon(this.eyeToggleEl, this.listCollapsed ? "EyeOff" : "Eye");
      this.contentEl.toggleClass("list-collapsed", this.listCollapsed);
    });

    this.searchToggleEl = this.toolbarEl.createEl("button", {
      cls: "vault-viewer-toolbar-icon-btn",
      attr: { title: t("toolbar.search") },
    });
    setLucideIcon(this.searchToggleEl, "Search");
    this.searchToggleEl.addEventListener("click", () => {
      const nextVisible = !this.searchWrapperEl.hasClass("visible");
      this.searchWrapperEl.toggleClass("visible", nextVisible);
      if (nextVisible) {
        const input = this.searchWrapperEl.querySelector("input");
        if (input) { input.value = this.searchQuery; input.focus(); }
      }
    });

    this.sortBtnEl = this.toolbarEl.createEl("button", {
      cls: "vault-viewer-sort-btn",
      attr: { title: t("toolbar.sortOptions") },
    });
    setLucideIcon(this.sortBtnEl, "ListFilter");
    this.sortBtnEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleSortDropdown();
    });

    this.orderBtnEl = this.toolbarEl.createEl("button", {
      cls: "vault-viewer-order-btn",
      attr: { title: t("toolbar.sortOptions") },
    });
    setLucideIcon(this.orderBtnEl, "ArrowUpDown");
    this.orderBtnEl.addEventListener("click", () => {
      this.plugin.settings.sortOrder =
        this.plugin.settings.sortOrder === "asc" ? "desc" : "asc";
      this.plugin.saveSettings();
      this.refreshFileList();
    });
    this.refreshSortBtnIcon();
  }

  private toggleSortDropdown(): void {
    if (this.sortDropdownEl) {
      this.closeSortDropdown();
      return;
    }

    const btnRect = this.sortBtnEl.getBoundingClientRect();
    const dropdown = document.createElement("div");
    dropdown.className = "vault-viewer-sort-dropdown";
    document.body.appendChild(dropdown);
    dropdown.style.left = `${btnRect.left}px`;
    dropdown.style.top = `${btnRect.bottom + 4}px`;

    const options: { value: string; label: string }[] = [
      { value: "name", label: t("sort.name") },
      { value: "mtime", label: t("sort.mtime") },
      { value: "ctime", label: t("sort.ctime") },
      { value: "size", label: t("sort.size") },
    ];

    for (const opt of options) {
      const optEl = dropdown.createDiv({ cls: "vault-viewer-sort-option" });
      const isActive = this.plugin.settings.sortBy === opt.value;
      if (isActive) optEl.addClass("active");

      optEl.createSpan({ text: opt.label });

      optEl.addEventListener("click", () => {
        this.plugin.settings.sortBy = opt.value as any;
        this.plugin.settings.sortOrder = "asc";
        this.plugin.saveSettings();
        this.closeSortDropdown();
        this.refreshSortBtnIcon();
        this.refreshFileList();
      });
    }

    const sep = dropdown.createDiv({ cls: "vault-viewer-sort-separator" });

    const resetEl = dropdown.createDiv({ cls: "vault-viewer-sort-option" });
    resetEl.createSpan({ text: t("sort.reset") });
    resetEl.addEventListener("click", () => {
      this.plugin.settings.sortBy = "name";
      this.plugin.settings.sortOrder = "asc";
      this.plugin.saveSettings();
      this.closeSortDropdown();
      this.refreshSortBtnIcon();
      this.refreshFileList();
    });

    this.sortDropdownEl = dropdown;
    setTimeout(() => document.addEventListener("click", this.closeSortDropdown), 0);
  }

  private closeSortDropdown = (): void => {
    if (this.sortDropdownEl) {
      this.sortDropdownEl.remove();
      this.sortDropdownEl = null;
    }
    document.removeEventListener("click", this.closeSortDropdown);
  };

  private refreshSortBtnIcon(): void {
    setLucideIcon(this.sortBtnEl, "ListFilter");
    this.orderBtnEl.addClass("visible");
  }

  // ─── Tree ─────────────────────────────────────────

  private renderTree(): void {
    const savedExpanded = this.saveExpandedState();
    this.treeEl.empty();

    const rootFolder = this.app.vault.getAbstractFileByPath("/");
    if (!rootFolder) return;

    const rootRow = this.treeEl.createDiv({
      cls: "vault-viewer-tree-row vault-viewer-folder",
    });
    rootRow.style.paddingLeft = "4px";
    rootRow.dataset.path = "/";

    const toggle = rootRow.createSpan({ cls: "vault-viewer-toggle-icon" });
    setLucideIcon(toggle, "ChevronRight");
    const icon = rootRow.createSpan({ cls: "vault-viewer-folder-icon" });
    setLucideIcon(icon, "Folder");
    const vaultName = this.app.vault.getName() || "Vault";
    rootRow.createSpan({ cls: "vault-viewer-tree-name", text: vaultName });

    const rootChildren = (rootFolder as any).children;
    const mdCount = rootChildren
      ? rootChildren.filter((c: any) => c.extension === "md").length
      : 0;
    const otherCount = rootChildren
      ? rootChildren.filter((c: any) => c.extension && c.extension !== "md").length
      : 0;
    rootRow.createSpan({ cls: "vault-viewer-tree-count", text: `md ${mdCount} / other ${otherCount}` });

    const childrenEl = this.treeEl.createDiv({ cls: "vault-viewer-children" });
    childrenEl.style.setProperty("--vv-line-left", `${0 * 12 + 12}px`);
    childrenEl.style.display = "none";

    rootRow.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = childrenEl.style.display === "none";
      childrenEl.style.display = isHidden ? "block" : "none";
      toggle.empty();
      setLucideIcon(toggle, isHidden ? "ChevronDown" : "ChevronRight");
      icon.empty();
      setLucideIcon(icon, isHidden ? "FolderOpenDot" : "Folder");
      this.highlightRow(rootRow);
      this.onFolderClick(rootFolder as any);
    });
    rootRow.addEventListener("contextmenu", (e) => {
      this.showTreeContextMenu(e, rootFolder, true);
    });
    rootRow.draggable = true;
    rootRow.addEventListener("dragstart", (ev: DragEvent) => {
      ev.dataTransfer?.setData("text/plain", (rootFolder as any).path);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    });
    rootRow.addEventListener("dragover", (ev: DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      rootRow.addClass("drag-over");
    });
    rootRow.addEventListener("dragleave", () => {
      rootRow.removeClass("drag-over");
    });
    rootRow.addEventListener("drop", (ev: DragEvent) => {
      ev.preventDefault();
      rootRow.removeClass("drag-over");
      const srcPath = ev.dataTransfer?.getData("text/plain");
      if (!srcPath) return;
      if (srcPath === "/") return;
      this.moveTreeItem(srcPath, rootFolder);
    });

    this.renderFolder(rootFolder as any, childrenEl, 1);
    this.restoreExpandedState(savedExpanded);
  }

  private renderFolder(folder: any, parentEl: HTMLElement, depth: number): void {
    if (!folder.children) return;

    const children = folder.children as any[];
    const subfolders = children.filter((c: any) => c.children !== undefined);
    const allFiles = children.filter((c: any) => c.extension);
    const treeFiles = this.plugin.fileService
      ? this.plugin.fileService.getTreeFiles(
          allFiles,
          this.plugin.settings.treeExtensions
        )
      : [];

    const sortedSubfolders = this.plugin.settings.treeSortEnabled
      ? [...subfolders].sort((a: any, b: any) => a.name.localeCompare(b.name))
      : subfolders;
    const sortedFiles = [...treeFiles].sort((a: any, b: any) =>
      a.name.localeCompare(b.name)
    );

    for (const subfolder of sortedSubfolders) {
      const row = parentEl.createDiv({
        cls: "vault-viewer-tree-row vault-viewer-folder",
      });
      row.style.paddingLeft = `${depth * 12 + 4}px`;

      const toggle = row.createSpan({ cls: "vault-viewer-toggle-icon" });
      setLucideIcon(toggle, "ChevronRight");
      const folderIcon = row.createSpan({ cls: "vault-viewer-folder-icon" });
      setLucideIcon(folderIcon, "Folder");
      row.createSpan({ cls: "vault-viewer-tree-name", text: subfolder.name });
      const folderMdCount = subfolder.children
        ? subfolder.children.filter((c: any) => c.extension === "md").length
        : 0;
      const folderOtherCount = subfolder.children
        ? subfolder.children.filter((c: any) => c.extension && c.extension !== "md").length
        : 0;
      row.createSpan({ cls: "vault-viewer-tree-count", text: `md ${folderMdCount} / other ${folderOtherCount}` });

      const childrenEl = parentEl.createDiv({ cls: "vault-viewer-children" });
      childrenEl.style.setProperty("--vv-line-left", `${depth * 12 + 12}px`);
      childrenEl.style.display = "none";

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = childrenEl.style.display === "none";
        childrenEl.style.display = isHidden ? "block" : "none";
        toggle.empty();
        setLucideIcon(toggle, isHidden ? "ChevronDown" : "ChevronRight");
        folderIcon.empty();
        setLucideIcon(folderIcon, isHidden ? "FolderOpenDot" : "Folder");
        this.highlightRow(row);
        this.onFolderClick(subfolder);
      });
      row.addEventListener("contextmenu", (e) => {
        this.showTreeContextMenu(e, subfolder, true);
      });
      row.draggable = true;
      row.addEventListener("dragstart", (ev: DragEvent) => {
        ev.dataTransfer?.setData("text/plain", subfolder.path);
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragover", (ev: DragEvent) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
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
        if (srcPath === subfolder.path) return;
        if (subfolder.path.startsWith(srcPath + "/")) return;
        this.moveTreeItem(srcPath, subfolder);
      });

      this.renderFolder(subfolder, childrenEl, depth + 1);
    }

    for (const file of sortedFiles) {
      const row = parentEl.createDiv({
        cls: "vault-viewer-tree-row vault-viewer-file",
      });
      row.style.paddingLeft = `${depth * 12 + 4}px`;

      const fileIcon = row.createSpan({ cls: "vault-viewer-file-icon" });
      setLucideIcon(fileIcon, "File");
      row.createSpan({ cls: "vault-viewer-tree-name", text: file.name });

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        this.highlightRow(row);
        this.onFileClick(file);
      });
      row.addEventListener("contextmenu", (e) => {
        this.showTreeContextMenu(e, file, false);
      });
      row.draggable = true;
      row.addEventListener("dragstart", (ev: DragEvent) => {
        ev.dataTransfer?.setData("text/plain", file.path);
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
      });
    }
  }

  private highlightRow(el: HTMLElement | null): void {
    if (this.selectedEl) {
      this.selectedEl.removeClass("vault-viewer-highlighted");
    }
    this.selectedEl = el;
    if (el) {
      el.addClass("vault-viewer-highlighted");
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  private onFolderClick(folder: any): void {
    this.currentFolder = folder;
    this.currentMode = "directory";
    this.renderFileListModeA(folder.path);
    this.updateDynamicToolbar();
  }

  private onFileClick(file: any): void {
    this.app.workspace.openLinkText(file.path, "/", false);

    if (file.extension === "md") {
      this.currentFile = file;
      this.currentMode = "references";
      this.renderFileListModeB(file);
      this.updateDynamicToolbar();
    }
  }

  // ─── Toolbar (mode + filters) ─────────────────────

  private updateDynamicToolbar(): void {
    this.modeIndicatorEl.empty();
    if (this.currentMode === "directory") {
      const path = this.currentFolder ? this.currentFolder.path : "/";
      const modeIcon = this.modeIndicatorEl.createSpan({ cls: "vault-viewer-mode-icon" });
      setLucideIcon(modeIcon, "FolderKanban", 14);
      this.modeIndicatorEl.createSpan({ text: ` ${path}` });
    } else if (this.currentFile) {
      this.modeIndicatorEl.empty();
      const refIcon = this.modeIndicatorEl.createSpan();
      setLucideIcon(refIcon, "FileText", 14);
      this.modeIndicatorEl.createSpan({ text: ` ${t("mode.references", this.currentFile.name)}` });
    }

    this.filterTagsEl.empty();
    const files = this.getDisplayedFilesForFilters();
    const extensions = new Set<string>();
    for (const f of files) {
      extensions.add(this.getExtensionForDisplay(f));
    }
    for (const ext of [...extensions].sort()) {
      const hidden = this.plugin.settings.hiddenExtensions.includes(ext);
      const tag = this.filterTagsEl.createEl("button", {
        cls: `vault-viewer-filter-tag${hidden ? " hidden" : ""}`,
      });
      if (hidden) {
        const xIcon = tag.createSpan();
        setLucideIcon(xIcon, "X", 10);
        tag.createSpan({ text: ` ${ext}` });
      } else {
        tag.setText(ext);
      }
      tag.addEventListener("click", () => {
        const idx = this.plugin.settings.hiddenExtensions.indexOf(ext);
        if (idx >= 0) {
          this.plugin.settings.hiddenExtensions.splice(idx, 1);
        } else {
          this.plugin.settings.hiddenExtensions.push(ext);
        }
        this.plugin.saveSettings();
        this.refreshFileList();
      });
    }
    // Hide filter row when no extensions to show
    this.filterRowEl.toggleClass("vault-viewer-hidden", extensions.size === 0);
  }

  // ─── File List Mode A ──────────────────────────────

  private renderFileListModeA(folderPath: string): void {
    this.listEl.empty();
    this.currentMode = "directory";

    if (!this.plugin.fileService) return;

    const allFiles = this.plugin.fileService.getAllFiles();
    const dirFiles = this.plugin.fileService.getDirectoryChildren(
      folderPath,
      allFiles
    );
    const nonMdFiles = this.plugin.fileService.getNonMdFiles(
      dirFiles,
      this.plugin.settings.treeExtensions,
      this.plugin.settings.sortBy,
      this.plugin.settings.sortOrder
    );

    const filtered = this.searchQuery
      ? nonMdFiles.filter((f) =>
          f.name.toLowerCase().includes(this.searchQuery)
        )
      : nonMdFiles;

    const hidden = this.plugin.settings.hiddenExtensions;
    const visible = filtered.filter((f) => {
      const ext = this.getExtensionForDisplay(f);
      return !hidden.includes(ext);
    });

    if (visible.length === 0) {
      this.listEl.createEl("p", {
        text: t("empty.noFiles"),
        cls: "vault-viewer-empty",
      });
      return;
    }

    for (const file of visible) {
      const row = this.listEl.createDiv({ cls: "vault-viewer-list-row" });
      row.dataset.path = file.path;
      if (file.path === this.selectedListPath) row.addClass("vault-viewer-highlighted");

      const iconSpan = row.createSpan({ cls: "vault-viewer-list-icon" });
      setLucideIcon(iconSpan, this.getFileIcon(file));
      row.createSpan({
        cls: "vault-viewer-list-name",
        text: file.name,
      });
      row.createSpan({ cls: "vault-viewer-list-time" }).setText(
        this.formatTime(file.stat.mtime)
      );

      row.addEventListener("click", () => {
        this.selectedListPath = file.path;
        this.highlightRow(row);
        this.onListFileClick(file);
      });
      row.addEventListener("contextmenu", (e) => this.showContextMenu(e, file));
    }
  }

  // ─── File List Mode B ──────────────────────────────

  private renderFileListModeB(file: any): void {
    this.listEl.empty();
    this.currentMode = "references";
    this.currentFile = file;

    if (!this.plugin.linkService) return;

    const links = this.plugin.linkService.getForwardLinks(file);

    const filtered = this.searchQuery
      ? links.filter(
          (l) =>
            l.file &&
            l.file.name.toLowerCase().includes(this.searchQuery)
        )
      : links;

    const hidden = this.plugin.settings.hiddenExtensions;
    const visible = filtered.filter((l) => {
      if (!l.file) return true;
      const ext = this.getExtensionForDisplay(l.file);
      return !hidden.includes(ext);
    });

    if (visible.length === 0) {
      this.listEl.createEl("p", {
        text: "此文件没有引用其他文件",
        cls: "vault-viewer-empty",
      });
      return;
    }

    for (const link of visible) {
      if (!link.file) {
        const row = this.listEl.createDiv({ cls: "vault-viewer-list-row" });
        const iconSpan = row.createSpan({ cls: "vault-viewer-list-icon" });
        setLucideIcon(iconSpan, "File");
        row.createSpan({
          cls: "vault-viewer-list-name unresolved",
          text: link.original,
        });
        continue;
      }

      const row = this.listEl.createDiv({ cls: "vault-viewer-list-row" });
      row.dataset.path = link.file.path;

      const iconSpan = row.createSpan({ cls: "vault-viewer-list-icon" });
      if (link.linkType === "embed") {
        setLucideIcon(iconSpan, "Image");
      } else {
        setLucideIcon(iconSpan, this.getFileIcon(link.file));
      }
      row.createSpan({
        cls: "vault-viewer-list-name",
        text: link.file.name,
      });

      if (link.linkType === "embed") {
        row.createSpan({ cls: "vault-viewer-badge", text: t("badge.embed") });
      }

      const locBtn = row.createEl("button", {
        cls: "vault-viewer-locate-btn",
        title: t("list.locateInTree"),
      });
      setLucideIcon(locBtn, "Locate", 14);
      locBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.locateInTree(link.file!);
      });

      row.addEventListener("click", () => this.onReferenceClick(link));
      row.addEventListener("contextmenu", (e) => this.showContextMenu(e, link.file!));
    }
  }

  private onReferenceClick(link: any): void {
    if (!link.file) return;
    const ext = "." + link.file.extension;
    if ([".docx", ".xlsx", ".pptx", ".sql"].includes(ext)) {
      if (this.plugin.openOfficeFile) {
        this.plugin.openOfficeFile(link.file);
        return;
      }
    }
    this.app.workspace.openLinkText(link.file.path, "/", false);
    if (link.file.extension === "md") {
      this.renderFileListModeB(link.file);
      this.updateDynamicToolbar();
    }
  }

  private locateInTree(file: any): void {
    const pathParts = file.path.split("/");
    if (pathParts.length <= 1) return;

    const treeEl = this.treeEl;

    // expand root first
    const rootRow = treeEl.querySelector(
      ".vault-viewer-folder[data-path='/']"
    ) as HTMLElement;
    const rootToggle = rootRow?.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
    const rootIcon = rootRow?.querySelector(".vault-viewer-folder-icon") as HTMLElement;
    const rootChildren = rootRow?.nextElementSibling as HTMLElement;
    if (rootChildren && rootChildren.style.display === "none") {
      rootChildren.style.display = "block";
      if (rootToggle) { rootToggle.empty(); setLucideIcon(rootToggle, "ChevronDown"); }
      if (rootIcon) { rootIcon.empty(); setLucideIcon(rootIcon, "FolderOpenDot"); }
    }

    for (let i = 2; i < pathParts.length; i++) {
      const ancestorPath = pathParts.slice(0, i).join("/");
      const folderRow = treeEl.querySelector(
        `.vault-viewer-folder[data-path="${ancestorPath}"]`
      ) as HTMLElement;
      if (!folderRow) {
        console.warn("Vault Viewer: 未找到目录:", ancestorPath);
        continue;
      }
      const childrenEl = folderRow.nextElementSibling as HTMLElement;
      if (childrenEl && childrenEl.style.display === "none") {
        childrenEl.style.display = "block";
        const toggle = folderRow.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
        const fIcon = folderRow.querySelector(".vault-viewer-folder-icon") as HTMLElement;
        if (toggle) { toggle.empty(); setLucideIcon(toggle, "ChevronDown"); }
        if (fIcon) { fIcon.empty(); setLucideIcon(fIcon, "FolderOpenDot"); }
      }
    }

    const escapedPath = file.path.replace(/"/g, '\\"');
    const targetRow = treeEl.querySelector(
      `[data-path="${escapedPath}"]`
    ) as HTMLElement;
    if (targetRow) {
      this.highlightRow(targetRow);
    } else {
      const parentFolderPath = pathParts.slice(0, -1).join("/");
      const folderRow = treeEl.querySelector(
        `.vault-viewer-folder[data-path="${parentFolderPath}"]`
      ) as HTMLElement;
      if (folderRow) {
        this.highlightRow(folderRow);
      }
    }
  }

  private locateParentInTree(item: any): void {
    // Compute parent path from item path (no reliance on Obsidian API)
    const lastSep = item.path.lastIndexOf("/");
    if (lastSep <= 0) {
      // Item is at root — just show root
      this.onFolderClick({ path: "/" });
      return;
    }
    const parentPath = item.path.slice(0, lastSep);

    // Walk the tree DOM expanding all ancestors
    const treeEl = this.treeEl;
    const parts = parentPath.split("/").filter(Boolean);

    // First expand root
    const rootRow = treeEl.querySelector(
      ".vault-viewer-folder[data-path='/']"
    ) as HTMLElement;
    if (!rootRow) return;
    this.expandTreeNode(rootRow);

    // Then expand each ancestor folder
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      const folderRow = treeEl.querySelector(
        `.vault-viewer-folder[data-path="/${accumulated}"]`
      ) as HTMLElement;
      if (!folderRow) break;
      this.expandTreeNode(folderRow);
    }

    // Find and highlight the parent folder row
    const parentRow = treeEl.querySelector(
      `.vault-viewer-folder[data-path="/${accumulated}"]`
    ) as HTMLElement;
    if (parentRow) this.highlightRow(parentRow);

    // Switch file list to parent folder
    this.onFolderClick({ path: `/${accumulated}` });
  }

  private expandTreeNode(row: HTMLElement): void {
    const childrenEl = row.nextElementSibling as HTMLElement;
    if (!childrenEl?.hasClass?.("vault-viewer-children")) return;
    if (childrenEl.style.display === "none") {
      childrenEl.style.display = "block";
      const toggle = row.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
      if (toggle) { toggle.empty(); setLucideIcon(toggle, "ChevronDown"); }
      const folderIcon = row.querySelector(".vault-viewer-folder-icon") as HTMLElement;
      if (folderIcon) { folderIcon.empty(); setLucideIcon(folderIcon, "FolderOpenDot"); }
    }
  }

  // ─── Context Menu ─────────────────────────────────────

  private showContextMenu(e: MouseEvent, file: any): void {
    e.preventDefault();
    this.closeContextMenu();

    const menu = this.contentEl.createDiv({ cls: "vault-viewer-context-menu" });
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const adapter = this.app.vault.adapter;
    const basePath = (adapter as any).basePath || "";
    const fullPath = `${basePath}/${file.path}`;

    const getElectron = () => {
      try { return (window as any).require("electron"); } catch { return null; }
    };

    const items = [
      { icon: "Folder", text: t("context.openFolder"), action: () => {
        const electron = getElectron();
        if (electron?.shell) {
          electron.shell.showItemInFolder(fullPath);
        } else {
          const folderPath = fullPath.slice(0, fullPath.lastIndexOf("/"));
          (window as any).open(folderPath);
        }
      }},
      { icon: "Clipboard", text: t("context.copyPath"), action: () => navigator.clipboard.writeText(fullPath) },
      { icon: "Pencil", text: t("context.copyName"), action: () => navigator.clipboard.writeText(file.name) },
      { separator: true },
      { icon: "Paperclip", text: t("context.openExternal"), action: () => {
        const electron = getElectron();
        if (electron?.shell) {
          electron.shell.openPath(fullPath);
        } else {
          (window as any).open(fullPath);
        }
      }},
    ];

    for (const item of items) {
      if ("separator" in item) {
        menu.createDiv({ cls: "vault-viewer-context-separator" });
        continue;
      }
      const row = menu.createDiv({ cls: "vault-viewer-context-item" });
      if (item.icon) {
        const iconSpan = row.createSpan();
        setLucideIcon(iconSpan, item.icon, 14);
      }
      row.createSpan({ text: item.text });
      row.addEventListener("click", () => {
        item.action();
        this.closeContextMenu();
      });
    }

    this.contextMenuEl = menu;
    setTimeout(() => document.addEventListener("click", this.closeContextMenu), 0);
  }

  private closeContextMenu = (): void => {
    if (this.contextMenuEl) {
      this.contextMenuEl.remove();
      this.contextMenuEl = null;
    }
    document.removeEventListener("click", this.closeContextMenu);
  };

  private saveExpandedState(): Set<string> {
    const paths = new Set<string>();
    for (const el of Array.from(this.treeEl.querySelectorAll(".vault-viewer-children"))) {
      const childrenEl = el as HTMLElement;
      if (childrenEl.style.display !== "none") {
        const prev = childrenEl.previousElementSibling as HTMLElement;
        if (prev?.dataset?.path) paths.add(prev.dataset.path);
      }
    }
    return paths;
  }

  private restoreExpandedState(paths: Set<string>): void {
    if (paths.size === 0) return;
    for (const row of Array.from(this.treeEl.querySelectorAll(".vault-viewer-folder")) as HTMLElement[]) {
      if (!row.dataset.path) continue;
      if (!paths.has(row.dataset.path)) continue;
      const childrenEl = row.nextElementSibling as HTMLElement;
      if (!childrenEl?.hasClass?.("vault-viewer-children")) continue;
      childrenEl.style.display = "block";
      const toggle = row.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
      if (toggle) { toggle.empty(); setLucideIcon(toggle, "ChevronDown"); }
      const folderIcon = row.querySelector(".vault-viewer-folder-icon") as HTMLElement;
      if (folderIcon) { folderIcon.empty(); setLucideIcon(folderIcon, "FolderOpenDot"); }
    }
  }

  private showTreeContextMenu(e: MouseEvent, item: any, isFolder: boolean): void {
    e.preventDefault();
    e.stopPropagation();
    this.closeTreeContextMenu();

    const menu = this.contentEl.createDiv({ cls: "vault-viewer-tree-context-menu" });
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const locateBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
    locateBtn.innerHTML = `${createLucideIcon("FolderUp", 14)} ${t("treeContext.openFolder")}`;
    locateBtn.addEventListener("click", () => {
      this.closeTreeContextMenu();
      const adapter = this.app.vault.adapter;
      const basePath = (adapter as any).basePath || "";
      const fullPath = `${basePath}/${item.path}`;
      const getElectron = () => {
        try { return (window as any).require("electron"); } catch { return null; }
      };
      const electron = getElectron();
      if (electron?.shell) {
        electron.shell.showItemInFolder(fullPath);
      } else {
        const folderPath = fullPath.slice(0, fullPath.lastIndexOf("/"));
        (window as any).open(folderPath);
      }
    });

    const copyBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
    copyBtn.innerHTML = `${createLucideIcon("Copy", 14)} ${t("treeContext.copyPath")}`;
    copyBtn.addEventListener("click", () => {
      this.closeTreeContextMenu();
      navigator.clipboard.writeText(item.path);
      new Notice(t("notice.pathCopied"));
    });

    menu.createDiv({ cls: "vault-viewer-context-separator" });

    const deleteBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
    deleteBtn.innerHTML = `${createLucideIcon("Trash2", 14)} ${t("treeContext.delete")}`;
    deleteBtn.addEventListener("click", () => {
      this.closeTreeContextMenu();
      this.onTreeItemDelete(item, isFolder);
    });

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

  private closeTreeContextMenu(): void {
    const existing = this.contentEl.querySelector(".vault-viewer-tree-context-menu");
    if (existing) existing.remove();
  }

  private onTreeItemDelete(item: any, isFolder: boolean): void {
    const prefix = isFolder ? t("modal.folderName") : t("modal.fileName");
    const name = `${prefix} "${item.name}"`;
    if (isFolder && item.children) {
      const nonEmpty = (item.children as any[]).filter((c: any) => c.children !== undefined || c.extension);
      if (nonEmpty.length > 0) {
        new Notice(t("notice.cantDeleteNonEmpty", name), 5000);
        return;
      }
    }
    new ConfirmModal(this.app, t("modal.confirmDelete"), t("modal.confirmDeleteBody", name), () => {
      try {
        this.app.vault.trash(item, false);
        new Notice(isFolder ? t("notice.folderDeleted", name) : t("notice.fileDeleted", name));
        const savedExpanded = this.saveExpandedState();
        this.renderTree();
        this.restoreExpandedState(savedExpanded);
        this.refreshFileList();
      } catch (e) {
        new Notice(t("notice.deleteFailed", (e as Error).message));
      }
    }).open();
  }

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
      new Notice(`移动失败: ${(e as Error).message}`);
    }
  }

  // ─── Common helpers ────────────────────────────────

  private getExtensionForDisplay(file: any): string {
    if (file.name.endsWith(".excalidraw.md")) return ".excalidraw.md";
    if (file.name.endsWith(".canvas.md")) return ".canvas.md";
    return "." + file.extension;
  }

  private getFileIcon(file: any): string {
    const ext = "." + file.extension;
    if (ext === ".docx") return "FileText";
    if (ext === ".xlsx") return "FileSpreadsheet";
    if (ext === ".pptx") return "Presentation";
    if (ext === ".pdf") return "FileText";
    if (ext === ".sql") return "Database";
    if (
      [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)
    )
      return "FileImage";
    return "File";
  }

  private formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      year:
        d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }

  private refreshFileList(): void {
    if (this.currentMode === "directory") {
      const path = this.currentFolder ? this.currentFolder.path : "/";
      this.renderFileListModeA(path);
    } else if (this.currentFile) {
      this.renderFileListModeB(this.currentFile);
    }
    this.updateDynamicToolbar();
  }

  private getCurrentDisplayFiles(): any[] {
    if (!this.plugin.fileService) return [];
    if (this.currentMode === "directory") {
      const path = this.currentFolder ? this.currentFolder.path : "/";
      const allFiles = this.plugin.fileService.getAllFiles();
      return this.plugin.fileService.getDirectoryChildren(path, allFiles);
    } else if (this.currentFile && this.plugin.linkService) {
      return this.plugin.linkService
        .getForwardLinks(this.currentFile)
        .filter((l) => l.file)
        .map((l) => l.file);
    }
    return [];
  }

  private getDisplayedFilesForFilters(): any[] {
    if (!this.plugin.fileService) return [];
    if (this.currentMode === "directory") {
      const path = this.currentFolder ? this.currentFolder.path : "/";
      const allFiles = this.plugin.fileService.getAllFiles();
      const dirFiles = this.plugin.fileService.getDirectoryChildren(path, allFiles);
      return this.plugin.fileService.getNonMdFiles(
        dirFiles,
        this.plugin.settings.treeExtensions,
        this.plugin.settings.sortBy,
        this.plugin.settings.sortOrder
      );
    } else if (this.currentFile && this.plugin.linkService) {
      return this.plugin.linkService
        .getForwardLinks(this.currentFile)
        .filter((l) => l.file)
        .map((l) => l.file);
    }
    return [];
  }

  private onListFileClick(file: any): void {
    const ext = "." + file.extension;
    if ([".docx", ".xlsx", ".pptx", ".sql"].includes(ext)) {
      if (this.plugin.openOfficeFile) {
        this.plugin.openOfficeFile(file);
      }
    } else {
      this.app.workspace.openLinkText(file.path, "/", false);
    }
  }
}
