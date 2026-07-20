import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, TAbstractFile, FileSystemAdapter, MarkdownView, Platform } from "obsidian";
import VaultViewerPlugin from "../main";
import { setLucideIcon, setLucideIconFilled } from "../utils/lucide-icons";
import { InputModal } from "../ui/InputModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { t } from "../i18n";
import { ResolvedLink } from "../services/LinkService";
import { isCodeExtension } from "../utils/extensions";
import { getFileIcon as getDeviconIcon } from "../utils/file-icons";
import { setSvgContent } from "../utils/html-utils";

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
  listAreaContextMenuEl: HTMLElement | null = null;
  currentMode: "directory" | "references" = "directory";
  currentFolder: TFolder | null = null;
  currentFile: TFile | null = null;
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
    return "notebook-text";
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
    setLucideIcon(this.resizerEl.createSpan({ cls: "vault-viewer-resizer-icon" }), "ChevronsUpDown", 14);

    this.setupResizer();
    // Restore saved tree/list split ratio
    const savedSplit = this.plugin.settings.treeSplit;
    if (savedSplit !== 50) {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          const treeToolbarH = this.treeToolbarEl?.offsetHeight || 0;
          const avail = this.contentEl.offsetHeight - treeToolbarH;
          const treeH = Math.round(avail * savedSplit / 100);
          const listArea = this.contentEl.querySelector('.vault-viewer-list-area');
          if (treeH > 40 && listArea) {
            this.treeEl.style.setProperty('height', treeH + 'px');
            this.treeEl.addClass('vault-viewer-tree-fixed');
          }
        }, 0);
      });
    }

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

    this.listContentEl.addEventListener("contextmenu", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".vault-viewer-list-row")) return;
      this.showListAreaContextMenu(e);
    });

    this.renderTree();
    this.renderFileListModeA("/");
    this.updateDynamicToolbar();

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        window.clearTimeout(this.syncTimeout);
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
      activeDocument.body.addClass("vault-viewer-resizing");

      const startY = e.clientY;
      const startHeight = this.treeEl.offsetHeight;

      const onMouseMove = (ev: MouseEvent) => {
        if (!this.isResizing) return;
        const delta = ev.clientY - startY;
        const newHeight = Math.max(40, startHeight + delta);
        this.treeEl.style.setProperty("height", `${newHeight}px`);
        this.treeEl.addClass("vault-viewer-tree-fixed");
      };

      const onMouseUp = () => {
        this.isResizing = false;
        activeDocument.body.removeClass("vault-viewer-resizing");
        activeDocument.removeEventListener("mousemove", onMouseMove);
        activeDocument.removeEventListener("mouseup", onMouseUp);
        // Save split ratio to settings
        const containerHeight = this.contentEl.offsetHeight;
        const actionBarHeight = this.treeToolbarEl.offsetHeight;
        const treeHeight = this.treeEl.offsetHeight;
        const pct = Math.round((treeHeight / (containerHeight - actionBarHeight)) * 100);
        this.plugin.settings.treeSplit = Math.max(10, Math.min(90, pct));
        void this.plugin.saveSettings();
      };

      activeDocument.addEventListener("mousemove", onMouseMove);
      activeDocument.addEventListener("mouseup", onMouseUp);
    };

    this.resizerEl.addEventListener("mousedown", onMouseDown);
  }

  private syncWithActiveEditor(): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;
    const file = activeView.file;
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
      void this.plugin.saveSettings();
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

  private highlightParentAndFolder(folder: TFolder): void {
    const path = folder.path;
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

    const escapedPath = path.replace(/"/g, '\\"');
    const targetRow = treeEl.querySelector(
      `[data-path="${escapedPath}"]`
    ) as HTMLElement;
    if (targetRow) this.highlightRow(targetRow);
  }

  private onNewFile(): void {
    const folder = this.currentFolder || this.app.vault.getRoot();
    void this.createFileInFolder(folder);
  }

  private onNewFolder(): void {
    const parent = this.currentFolder || this.app.vault.getRoot();
    void this.createFolderInFolder(parent);
  }

  private expandAllFolders(): void {
    const treeEl = this.treeEl;
    for (const el of Array.from(treeEl.querySelectorAll(".vault-viewer-children"))) {
      (el as HTMLElement).removeClass("hidden");
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
      (el as HTMLElement).addClass("hidden");
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
    this.toolbarEl.createDiv({ cls: "vault-viewer-toolbar-spacer" });

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
      void this.plugin.saveSettings();
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
    const dropdown = activeDocument.body.createDiv({ cls: "vault-viewer-sort-dropdown" });
    activeDocument.body.appendChild(dropdown);
    dropdown.style.setProperty("left", `${btnRect.left}px`);
    dropdown.style.setProperty("top", `${btnRect.bottom + 4}px`);

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
        this.plugin.settings.sortBy = opt.value as "name" | "mtime" | "ctime" | "size";
        this.plugin.settings.sortOrder = "asc";
        void this.plugin.saveSettings();
        this.closeSortDropdown();
        this.refreshSortBtnIcon();
        this.refreshFileList();
      });
    }

    dropdown.createDiv({ cls: "vault-viewer-sort-separator" });

    const resetEl = dropdown.createDiv({ cls: "vault-viewer-sort-option" });
    resetEl.createSpan({ text: t("sort.reset") });
    resetEl.addEventListener("click", () => {
      this.plugin.settings.sortBy = "name";
      this.plugin.settings.sortOrder = "asc";
      void this.plugin.saveSettings();
      this.closeSortDropdown();
      this.refreshSortBtnIcon();
      this.refreshFileList();
    });

    this.sortDropdownEl = dropdown;
    window.setTimeout(() => activeDocument.addEventListener("click", this.closeSortDropdown), 0);
  }

  private closeSortDropdown = (): void => {
    if (this.sortDropdownEl) {
      this.sortDropdownEl.remove();
      this.sortDropdownEl = null;
    }
    activeDocument.removeEventListener("click", this.closeSortDropdown);
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
    if (!(rootFolder instanceof TFolder)) return;

    const rootRow = this.treeEl.createDiv({
      cls: "vault-viewer-tree-row vault-viewer-folder vault-viewer-folder-root",
    });
    rootRow.dataset.path = "/";

    const toggle = rootRow.createSpan({ cls: "vault-viewer-toggle-icon" });
    setLucideIcon(toggle, "ChevronRight");
    const icon = rootRow.createSpan({ cls: "vault-viewer-folder-icon" });
    setLucideIcon(icon, "Folder");
    const vaultName = this.app.vault.getName() || "Vault";
    rootRow.createSpan({ cls: "vault-viewer-tree-name", text: vaultName });

    const rootChildren = rootFolder.children;
    const mdCount = rootChildren
      ? rootChildren.filter((c): c is TFile => c instanceof TFile && c.extension === "md").length
      : 0;
    const otherCount = rootChildren
      ? rootChildren.filter((c): c is TFile => c instanceof TFile && c.extension !== "md").length
      : 0;
    rootRow.createSpan({ cls: "vault-viewer-tree-count", text: `md ${mdCount} / other ${otherCount}` });

    const childrenEl = this.treeEl.createDiv({ cls: "vault-viewer-children" });
    childrenEl.style.setProperty("--vv-line-left", `${0 * 12 + 12}px`);
    childrenEl.addClass("hidden");

    rootRow.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = childrenEl.hasClass("hidden");
      childrenEl.toggleClass("hidden", !isHidden);
      toggle.empty();
      setLucideIcon(toggle, isHidden ? "ChevronDown" : "ChevronRight");
      icon.empty();
      setLucideIcon(icon, isHidden ? "FolderOpenDot" : "Folder");
      this.highlightRow(rootRow);
      this.onFolderClick(rootFolder);
    });
    rootRow.addEventListener("contextmenu", (e) => {
      this.showTreeContextMenu(e, rootFolder, true);
    });
    rootRow.draggable = true;
    rootRow.addEventListener("dragstart", (ev: DragEvent) => {
      ev.dataTransfer?.setData("text/plain", rootFolder.path);
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

    this.renderFolder(rootFolder, childrenEl, 1);
    this.restoreExpandedState(savedExpanded);
  }

  private renderFolder(folder: TFolder, parentEl: HTMLElement, depth: number): void {
    if (!folder.children) return;

    const children = folder.children;
    const subfolders = children.filter((c): c is TFolder => "children" in c);
    const allFiles = children.filter((c): c is TFile => "extension" in c);
    const treeFiles = this.plugin.fileService
      ? this.plugin.fileService.getTreeFiles(
          allFiles,
          this.plugin.settings.treeExtensions
        )
      : [];

    const sortedSubfolders = this.plugin.settings.treeSortEnabled
      ? [...subfolders].sort((a: TFolder, b: TFolder) => a.name.localeCompare(b.name))
      : subfolders;
    const sortedFiles = [...treeFiles].sort((a: TFile, b: TFile) =>
      a.name.localeCompare(b.name)
    );

    for (const subfolder of sortedSubfolders) {
      const row = parentEl.createDiv({
        cls: "vault-viewer-tree-row vault-viewer-folder",
      });
      row.style.setProperty("padding-left", `${depth * 12 + 4}px`);
      row.dataset.path = subfolder.path;

      const toggle = row.createSpan({ cls: "vault-viewer-toggle-icon" });
      setLucideIcon(toggle, "ChevronRight");
      const folderIcon = row.createSpan({ cls: "vault-viewer-folder-icon" });
      setLucideIcon(folderIcon, "Folder");
      row.dataset.iconName = "Folder";
      row.createSpan({ cls: "vault-viewer-tree-name", text: subfolder.name });
      const folderMdCount = subfolder.children
        ? subfolder.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md").length
        : 0;
      const folderOtherCount = subfolder.children
        ? subfolder.children.filter((c): c is TFile => c instanceof TFile && c.extension !== "md").length
        : 0;
      row.createSpan({ cls: "vault-viewer-tree-count", text: `md ${folderMdCount} / other ${folderOtherCount}` });

      const childrenEl = parentEl.createDiv({ cls: "vault-viewer-children" });
      childrenEl.style.setProperty("--vv-line-left", `${depth * 12 + 12}px`);
      childrenEl.addClass("hidden");

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = childrenEl.hasClass("hidden");
        childrenEl.toggleClass("hidden", !isHidden);
        toggle.empty();
        setLucideIcon(toggle, isHidden ? "ChevronDown" : "ChevronRight");
        folderIcon.empty();
        const newFolderIcon = isHidden ? "FolderOpenDot" : "Folder";
        setLucideIcon(folderIcon, newFolderIcon);
        row.dataset.iconName = newFolderIcon;
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
      row.style.setProperty("padding-left", `${depth * 12 + 4}px`);
      row.dataset.path = file.path;

      const fileIcon = row.createSpan({ cls: "vault-viewer-file-icon" });
      const deviconIcon = getDeviconIcon(file.extension);
      if (deviconIcon) {
        setSvgContent(fileIcon, deviconIcon.svg);
        fileIcon.style.color = deviconIcon.color;
        fileIcon.addClass("vv-file-icon--devicon");
        const svg = fileIcon.querySelector("svg");
        if (svg) { svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
        row.dataset.iconName = "devicon";
      } else {
        const iconName = this.getFileIcon(file);
        setLucideIcon(fileIcon, iconName);
        row.dataset.iconName = iconName;
      }
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
      this.restoreOutlineIcon(this.selectedEl);
    }
    this.selectedEl = el;
    if (el) {
      el.addClass("vault-viewer-highlighted");
      this.applyFilledIcon(el);
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /** Map an outline icon name to its filled counterpart */
  private getFilledIconName(iconName: string): string {
    const fillMap: Record<string, string> = {
      "File": "FileFill",
      "Folder": "FolderFill",
      "FolderOpenDot": "FolderOpenDotFill",
      "FileText": "FileTextFill",
      "LayoutDashboard": "LayoutDashboard",
      "PenLine": "PenLine",
    };
    return fillMap[iconName] ?? iconName;
  }

/** Switch the icon inside a row to its filled variant */
  private applyFilledIcon(row: HTMLElement): void {
    const iconName = row.dataset.iconName;
    if (!iconName) return;
    // devicon icons are custom SVGs with color - they don't have filled variants
    if (iconName === "devicon") return;
    const filledName = this.getFilledIconName(iconName);
    const iconEl = row.querySelector(".vault-viewer-file-icon, .vault-viewer-folder-icon, .vault-viewer-list-icon");
    if (!iconEl || !(iconEl.instanceOf(HTMLElement))) return;
    iconEl.empty();
    setLucideIconFilled(iconEl, filledName, 16);
  }

/** Switch the icon inside a row back to its outline variant */
  private restoreOutlineIcon(row: HTMLElement): void {
    const iconName = row.dataset.iconName;
    if (!iconName) return;
    // devicon icons are custom SVGs with color - they don't have outline/filled variants
    if (iconName === "devicon") return;
    const iconEl = row.querySelector(".vault-viewer-file-icon, .vault-viewer-folder-icon, .vault-viewer-list-icon");
    if (!iconEl || !(iconEl.instanceOf(HTMLElement))) return;
    iconEl.empty();
    setLucideIcon(iconEl, iconName, 16);
  }

  private onFolderClick(folder: TFolder): void {
    this.currentFolder = folder;
    this.currentMode = "directory";
    this.renderFileListModeA(folder.path);
    this.updateDynamicToolbar();
  }

  private onFileClick(file: TFile): void {
    void this.app.workspace.openLinkText(file.path, "/", false);

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
        void this.plugin.saveSettings();
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

    // Build table with header
    const tableWrapper = this.listEl.createDiv({ cls: "vault-viewer-table-wrapper" });
    const table = tableWrapper.createEl("table", { cls: "vault-viewer-table" });

    // Header row with <th>
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr", { cls: "vault-viewer-table-header" });
    const nameTh = headerRow.createEl("th", { cls: "vault-viewer-table-th vault-viewer-col-name" });
    nameTh.setText(t("list.name") || "Name");
    const timeTh = headerRow.createEl("th", { cls: "vault-viewer-table-th vault-viewer-col-time" });
    timeTh.setText(t("list.modified") || "Modified");

    // Column resize handles
    this.setupColResize(nameTh.createDiv({ cls: "vault-viewer-col-resizer" }), nameTh);
    this.setupColResize(timeTh.createDiv({ cls: "vault-viewer-col-resizer" }), timeTh);

    // Body rows with <td>
    const tbody = table.createEl("tbody");
    for (const file of visible) {
      const row = tbody.createEl("tr", { cls: "vault-viewer-list-row" });
      row.dataset.path = file.path;
      if (file.path === this.selectedListPath) row.addClass("vault-viewer-highlighted");

      const nameTd = row.createEl("td", { cls: "vault-viewer-list-name" });
      const iconSpan = nameTd.createSpan({ cls: "vault-viewer-list-icon" });
      const deviconIcon = getDeviconIcon(file.extension);
      if (deviconIcon) {
        setSvgContent(iconSpan, deviconIcon.svg);
        iconSpan.style.color = deviconIcon.color;
        iconSpan.addClass("vv-file-icon--devicon");
        const svg = iconSpan.querySelector("svg");
        if (svg) { svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
        row.dataset.iconName = "devicon";
      } else {
        const iconName = this.getFileIcon(file);
        setLucideIcon(iconSpan, iconName);
        row.dataset.iconName = iconName;
      }
      nameTd.createSpan({ text: file.name });

      const timeTd = row.createEl("td", { cls: "vault-viewer-list-time" });
      timeTd.setText(this.formatTime(file.stat.mtime));

      row.addEventListener("click", () => {
        this.selectedListPath = file.path;
        this.highlightRow(row);
        this.onListFileClick(file);
      });
      row.addEventListener("contextmenu", (e) => this.showContextMenu(e, file));
    }
  }

  // ─── File List Mode B ──────────────────────────────

  private renderFileListModeB(file: TFile): void {
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
      if (!l.file) return false;
      const ext = this.getExtensionForDisplay(l.file);
      return !hidden.includes(ext);
    });

    if (visible.length === 0) {
      this.listEl.createEl("p", {
        text: t("empty.noReferences"),
        cls: "vault-viewer-empty",
      });
      return;
    }

    // Build table with header
    const tableWrapper = this.listEl.createDiv({ cls: "vault-viewer-table-wrapper" });
    const table = tableWrapper.createEl("table", { cls: "vault-viewer-table" });

    // Header row with <th>
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr", { cls: "vault-viewer-table-header" });
    const nameTh = headerRow.createEl("th", { cls: "vault-viewer-table-th vault-viewer-col-name" });
    nameTh.setText(t("list.name") || "Name");
    const badgeTh = headerRow.createEl("th", { cls: "vault-viewer-table-th vault-viewer-col-badge" });
    badgeTh.setText(t("list.type") || "Type");
    const locateTh = headerRow.createEl("th", { cls: "vault-viewer-table-th vault-viewer-col-locate" });
    locateTh.setText("");

    // Column resize handles
    this.setupColResize(nameTh.createDiv({ cls: "vault-viewer-col-resizer" }), nameTh);
    this.setupColResize(badgeTh.createDiv({ cls: "vault-viewer-col-resizer" }), badgeTh);
    this.setupColResize(locateTh.createDiv({ cls: "vault-viewer-col-resizer" }), locateTh);

    // Body rows with <td>
    const tbody = table.createEl("tbody");
    for (const link of visible) {
      if (!link.file) continue;
      const row = tbody.createEl("tr", { cls: "vault-viewer-list-row" });
      row.dataset.path = link.file.path;

      const nameTd = row.createEl("td", { cls: "vault-viewer-list-name" });
      const iconSpan = nameTd.createSpan({ cls: "vault-viewer-list-icon" });
      if (link.linkType === "embed") {
        setLucideIcon(iconSpan, "Image");
        row.dataset.iconName = "Image";
      } else {
        const deviconIcon = getDeviconIcon(link.file.extension);
        if (deviconIcon) {
          setSvgContent(iconSpan, deviconIcon.svg);
          iconSpan.style.color = deviconIcon.color;
          iconSpan.addClass("vv-file-icon--devicon");
          const svg = iconSpan.querySelector("svg");
          if (svg) { svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
          row.dataset.iconName = "devicon";
        } else {
          const iconName = this.getFileIcon(link.file);
          setLucideIcon(iconSpan, iconName);
          row.dataset.iconName = iconName;
        }
      }
      nameTd.createSpan({ text: link.file.name });

      const badgeTd = row.createEl("td", { cls: "vault-viewer-list-badge-cell" });
      if (link.linkType === "embed") {
        badgeTd.createSpan({ cls: "vault-viewer-badge", text: t("badge.embed") });
      }

      const locateTd = row.createEl("td", { cls: "vault-viewer-list-locate-cell" });
      const locBtn = locateTd.createEl("button", {
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
  private setupColResize(handle: HTMLElement, th: HTMLElement): void {
    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = th.offsetWidth;

      activeDocument.addEventListener("mousemove", onMouseMove);
      activeDocument.addEventListener("mouseup", onMouseUp);
      activeDocument.body.addClass("vault-viewer-resizing");
    };

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      th.style.setProperty("width", `${newWidth}px`);
    };

    const onMouseUp = () => {
      activeDocument.removeEventListener("mousemove", onMouseMove);
      activeDocument.removeEventListener("mouseup", onMouseUp);
      activeDocument.body.removeClass("vault-viewer-resizing");
    };

    handle.addEventListener("mousedown", onMouseDown);
  }

  private onReferenceClick(link: ResolvedLink): void {
    if (!link.file) return;
    const ext = "." + link.file.extension;
    if ([".docx", ".xlsx", ".pptx", ".sql"].includes(ext)) {
      if (this.plugin.openOfficeFile) {
        void this.plugin.openOfficeFile(link.file);
        return;
      }
    }
    if (isCodeExtension(link.file.name)) {
      if (this.plugin.openCodeFile) {
        void this.plugin.openCodeFile(link.file);
        return;
      }
    }
    void this.app.workspace.openLinkText(link.file.path, "/", false);
    if (link.file.extension === "md") {
      this.renderFileListModeB(link.file);
      this.updateDynamicToolbar();
    }
  }

  private locateInTree(file: TFile): void {
    const pathParts = file.path.split("/");

    const treeEl = this.treeEl;

    // expand root first
    const rootRow = treeEl.querySelector(
      ".vault-viewer-folder[data-path='/']"
    ) as HTMLElement;
    const rootToggle = rootRow?.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
    const rootIcon = rootRow?.querySelector(".vault-viewer-folder-icon") as HTMLElement;
    const rootChildren = rootRow?.nextElementSibling as HTMLElement;
    if (rootChildren && rootChildren.hasClass("hidden")) {
      rootChildren.removeClass("hidden");
      if (rootToggle) { rootToggle.empty(); setLucideIcon(rootToggle, "ChevronDown"); }
      if (rootIcon) { rootIcon.empty(); setLucideIcon(rootIcon, "FolderOpenDot"); }
    }

    for (let i = 1; i < pathParts.length; i++) {
      const ancestorPath = pathParts.slice(0, i).join("/");
      if (!ancestorPath) continue;
      const folderRow = treeEl.querySelector(
        `.vault-viewer-folder[data-path="${ancestorPath}"]`
      ) as HTMLElement;
      if (!folderRow) {
        console.warn("Vault Viewer: 未找到目录:", ancestorPath);
        continue;
      }
      const childrenEl = folderRow.nextElementSibling as HTMLElement;
      if (childrenEl && childrenEl.hasClass("hidden")) {
        childrenEl.removeClass("hidden");
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
      const parentFolderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "/";
      const folderRow = treeEl.querySelector(
        `.vault-viewer-folder[data-path="${parentFolderPath}"]`
      ) as HTMLElement;
      if (folderRow) {
        this.highlightRow(folderRow);
      }
    }
  }

  private locateParentInTree(item: TAbstractFile): void {
    // Compute parent path from item path (no reliance on Obsidian API)
    const lastSep = item.path.lastIndexOf("/");
    if (lastSep <= 0) {
      // Item is at root — just show root
      const root = this.app.vault.getAbstractFileByPath("/");
      if (root instanceof TFolder) this.onFolderClick(root);
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
    const target = this.app.vault.getAbstractFileByPath(`/${accumulated}`);
    if (target instanceof TFolder) this.onFolderClick(target);
  }

  private expandTreeNode(row: HTMLElement): void {
    const childrenEl = row.nextElementSibling as HTMLElement;
    if (!childrenEl?.hasClass?.("vault-viewer-children")) return;
    if (childrenEl.hasClass("hidden")) {
      childrenEl.removeClass("hidden");
      const toggle = row.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
      if (toggle) { toggle.empty(); setLucideIcon(toggle, "ChevronDown"); }
      const folderIcon = row.querySelector(".vault-viewer-folder-icon") as HTMLElement;
      if (folderIcon) { folderIcon.empty(); setLucideIcon(folderIcon, "FolderOpenDot"); }
    }
  }

  // ─── Context Menu ─────────────────────────────────────

  private showContextMenu(e: MouseEvent, file: TFile): void {
    e.preventDefault();
    this.closeContextMenu();

    const menu = this.contentEl.createDiv({ cls: "vault-viewer-context-menu" });
    menu.style.setProperty("left", `${e.clientX}px`);
    menu.style.setProperty("top", `${e.clientY}px`);

    const adapter = this.app.vault.adapter;
    const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
    const fullPath = `${basePath}/${file.path}`;

    interface ElectronAPI { shell: { openPath: (p: string) => Promise<string>; showItemInFolder: (p: string) => void } }
    const getElectron = (): ElectronAPI | null => {
      try {
        const _window = window as unknown as { require: (mod: string) => ElectronAPI };
        return _window.require("electron");
      } catch { return null; }
    };

    const items = [
      { icon: "Folder", text: t("context.openFolder"), action: () => {
        const electron = getElectron();
        if (electron?.shell) {
          electron.shell.showItemInFolder(fullPath);
        } else {
          const folderPath = fullPath.slice(0, fullPath.lastIndexOf("/"));
          window.open(folderPath);
        }
      }},
      { icon: "Clipboard", text: t("context.copyPath"), action: () => window.navigator.clipboard.writeText(fullPath) },
      { icon: "Pencil", text: t("context.copyName"), action: () => window.navigator.clipboard.writeText(file.name) },
      { separator: true },
      { icon: "Paperclip", text: t("context.openExternal"), action: () => {
        const electron = getElectron();
        if (electron?.shell) {
          void electron.shell.openPath(fullPath);
        } else {
          window.open(fullPath);
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
    window.setTimeout(() => activeDocument.addEventListener("click", this.closeContextMenu), 0);
  }

  private closeContextMenu = (): void => {
    if (this.contextMenuEl) {
      this.contextMenuEl.remove();
      this.contextMenuEl = null;
    }
    activeDocument.removeEventListener("click", this.closeContextMenu);
  };

  // ─── List Area Context Menu (Paste File) ──────────

  private getClipboardFilePath(): string | null {
    try {
      interface ElectronClipboardAPI {
        clipboard: {
          read: (format: string) => string;
          readBuffer: (format: string) => Buffer;
        };
      }
      const _window = window as unknown as { require: (mod: string) => ElectronClipboardAPI };
      const { clipboard } = _window.require("electron");

      // Windows: read FileNameW (UTF-16LE null-terminated path)
      if (Platform.isWin) {
        const buf = clipboard.readBuffer("FileNameW");
        if (buf && buf.length > 0) {
          const raw = buf.toString("utf16le").replace(/\0+$/, "");
          if (raw) return raw;
        }
      }

      // macOS: read NSFilenamesPboardType (XML plist with file paths)
      if (Platform.isMacOS) {
        const buf = clipboard.readBuffer("NSFilenamesPboardType");
        if (buf && buf.length > 0) {
          const xml = buf.toString("utf-8");
          const match = xml.match(/<string>([^<]+)<\/string>/);
          if (match && match[1]) return match[1];
        }
      }

      // Fallback: try public.file-url (may work on some Linux desktops)
      const fileUrl = clipboard.read("public.file-url");
      if (fileUrl && fileUrl.startsWith("file://")) {
        let filePath = fileUrl.replace("file:///", "");
        if (!filePath.match(/^[A-Za-z]:/)) {
          filePath = "/" + filePath;
        }
        return decodeURIComponent(filePath);
      }
    } catch {
      return null;
    }
    return null;
  }

  private showListAreaContextMenu(e: MouseEvent): void {
    e.preventDefault();
    this.closeListAreaContextMenu();
    this.closeContextMenu();

    if (!this.currentFolder) return;

    const filePath = this.getClipboardFilePath();
    const hasFile = filePath !== null;

    const menu = this.contentEl.createDiv({ cls: "vault-viewer-context-menu" });
    menu.style.setProperty("left", `${e.clientX}px`);
    menu.style.setProperty("top", `${e.clientY}px`);

    const items = [
      { icon: "ClipboardPaste", text: t("listContext.pasteFile"), disabled: !hasFile, action: () => this.pasteFileFromClipboard() },
    ];

    for (const item of items) {
      const row = menu.createDiv({ cls: "vault-viewer-context-item" });
      if (item.disabled) row.addClass("is-disabled");
      if (item.icon) {
        const iconSpan = row.createSpan();
        setLucideIcon(iconSpan, item.icon, 14);
      }
      row.createSpan({ text: item.text });
      if (!item.disabled) {
        row.addEventListener("click", () => {
          void item.action();
          this.closeListAreaContextMenu();
        });
      }
    }

    this.listAreaContextMenuEl = menu;
    window.setTimeout(() => activeDocument.addEventListener("click", this.closeListAreaContextMenu), 0);
  }

  private closeListAreaContextMenu = (): void => {
    if (this.listAreaContextMenuEl) {
      this.listAreaContextMenuEl.remove();
      this.listAreaContextMenuEl = null;
    }
    activeDocument.removeEventListener("click", this.closeListAreaContextMenu);
  };

  private async pasteFileFromClipboard(): Promise<void> {
    const filePath = this.getClipboardFilePath();
    if (!filePath) {
      new Notice(t("notice.noFileInClipboard"));
      return;
    }

    if (!this.currentFolder) {
      new Notice(t("notice.pasteFailed"));
      return;
    }

    try {
      const buffer = await FileSystemAdapter.readLocalFile(filePath);
      const fileName = filePath.replace(/^.*[\\/]/, "");
      const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";
      const base = ext ? fileName.slice(0, -ext.length) : fileName;

      let targetPath = this.currentFolder.path + "/" + fileName;
      let finalName = fileName;
      let counter = 1;

      while (this.app.vault.getAbstractFileByPath(targetPath)) {
        finalName = `${base}-${counter}${ext}`;
        targetPath = this.currentFolder.path + "/" + finalName;
        counter++;
      }

      await this.app.vault.createBinary(targetPath, new Uint8Array(buffer));

      this.refreshFileList();
      this.renderTree();

      new Notice(t("notice.filePasted").replace("{name}", finalName));
    } catch (err) {
      console.error("Paste file failed:", err);
      new Notice(t("notice.pasteFailed"));
    }
  }

  private saveExpandedState(): Set<string> {
    const paths = new Set<string>();
    for (const el of Array.from(this.treeEl.querySelectorAll(".vault-viewer-children"))) {
      const childrenEl = el as HTMLElement;
      if (!childrenEl.hasClass("hidden")) {
        const prev = childrenEl.previousElementSibling as HTMLElement;
        if (prev?.dataset?.path) paths.add(prev.dataset.path);
      }
    }
    return paths;
  }

  private restoreExpandedState(paths: Set<string>): void {
    if (paths.size === 0) return;
    for (const el of Array.from(this.treeEl.querySelectorAll(".vault-viewer-folder"))) {
      const row = el as HTMLElement;
      if (!row.dataset.path) continue;
      if (!paths.has(row.dataset.path)) continue;
      const childrenEl = row.nextElementSibling as HTMLElement;
      if (!childrenEl?.hasClass?.("vault-viewer-children")) continue;
      childrenEl.removeClass("hidden");
      const toggle = row.querySelector(".vault-viewer-toggle-icon") as HTMLElement;
      if (toggle) { toggle.empty(); setLucideIcon(toggle, "ChevronDown"); }
      const folderIcon = row.querySelector(".vault-viewer-folder-icon") as HTMLElement;
      if (folderIcon) { folderIcon.empty(); setLucideIcon(folderIcon, "FolderOpenDot"); }
    }
  }

  private showTreeContextMenu(e: MouseEvent, item: TAbstractFile, isFolder: boolean): void {
    e.preventDefault();
    e.stopPropagation();
    this.closeTreeContextMenu();

    const menu = this.contentEl.createDiv({ cls: "vault-viewer-tree-context-menu" });
    menu.style.setProperty("left", `${e.clientX}px`);
    menu.style.setProperty("top", `${e.clientY}px`);

    const locateBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
    setLucideIcon(locateBtn.createSpan(), "FolderUp", 14);
    locateBtn.createSpan({ text: ` ${t("treeContext.openFolder")}` });
    locateBtn.addEventListener("click", () => {
      this.closeTreeContextMenu();
      const adapter = this.app.vault.adapter;
      const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
      const fullPath = `${basePath}/${item.path}`;
      interface ElectronAPI { shell: { openPath: (p: string) => Promise<string>; showItemInFolder: (p: string) => void } }
      const getElectron = (): ElectronAPI | null => {
        try {
          const _window = window as unknown as { require: (mod: string) => ElectronAPI };
          return _window.require("electron");
        } catch { return null; }
      };
      const electron = getElectron();
      if (electron?.shell) {
        electron.shell.showItemInFolder(fullPath);
      } else {
        const folderPath = fullPath.slice(0, fullPath.lastIndexOf("/"));
        window.open(folderPath);
      }
    });

    const copyBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
    setLucideIcon(copyBtn.createSpan(), "Copy", 14);
    copyBtn.createSpan({ text: ` ${t("treeContext.copyPath")}` });
    copyBtn.addEventListener("click", () => {
      this.closeTreeContextMenu();
      void window.navigator.clipboard.writeText(item.path);
      new Notice(t("notice.pathCopied"));
    });

    if (isFolder) {
      const newFileBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
      setLucideIcon(newFileBtn.createSpan(), "FilePlusCorner", 14);
      newFileBtn.createSpan({ text: ` ${t("treeContext.newFile")}` });
      newFileBtn.addEventListener("click", () => {
        this.closeTreeContextMenu();
        if (item instanceof TFolder) void this.createFileInFolder(item);
      });

      const newFolderBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
      setLucideIcon(newFolderBtn.createSpan(), "FolderPlus", 14);
      newFolderBtn.createSpan({ text: ` ${t("treeContext.newFolder")}` });
      newFolderBtn.addEventListener("click", () => {
        this.closeTreeContextMenu();
        if (item instanceof TFolder) void this.createFolderInFolder(item);
      });

      menu.createDiv({ cls: "vault-viewer-context-separator" });
    }

    menu.createDiv({ cls: "vault-viewer-context-separator" });

    const deleteBtn = menu.createEl("button", { cls: "vault-viewer-tree-context-btn" });
    setLucideIcon(deleteBtn.createSpan(), "Trash2", 14);
    deleteBtn.createSpan({ text: ` ${t("treeContext.delete")}` });
    deleteBtn.addEventListener("click", () => {
      this.closeTreeContextMenu();
      this.onTreeItemDelete(item, isFolder);
    });

    window.requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      const overflowX = rect.right - window.innerWidth;
      const overflowY = rect.bottom - window.innerHeight;
      if (overflowX > 0) menu.style.setProperty("left", `${e.clientX - rect.width}px`);
      if (overflowY > 0) menu.style.setProperty("top", `${e.clientY - rect.height}px`);
    });

    const clickHandler = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeTreeContextMenu();
        activeDocument.removeEventListener("click", clickHandler);
      }
    };
    window.setTimeout(() => activeDocument.addEventListener("click", clickHandler), 0);
  }

  private closeTreeContextMenu(): void {
    const existing = this.contentEl.querySelector(".vault-viewer-tree-context-menu");
    if (existing) existing.remove();
  }

  private onTreeItemDelete(item: TAbstractFile, isFolder: boolean): void {
    const prefix = isFolder ? t("modal.folderName") : t("modal.fileName");
    const name = `${prefix} "${item.name}"`;
    if (isFolder && item instanceof TFolder) {
      if (!item.children) return;
      const nonEmpty = item.children.filter((c: TAbstractFile) => c instanceof TFolder || c instanceof TFile);
      if (nonEmpty.length > 0) {
        new Notice(t("notice.cantDeleteNonEmpty", name), 5000);
        return;
      }
    }
    new ConfirmModal(this.app, t("modal.confirmDelete"), t("modal.confirmDeleteBody", name), () => {
      try {
        void this.app.fileManager.trashFile(item);
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

  private moveTreeItem(srcPath: string, targetFolder: TFolder): void {
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
      void this.app.vault.rename(file, newPath);
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

  private getExtensionForDisplay(file: TFile): string {
    if (file.name.endsWith(".excalidraw.md")) return ".excalidraw.md";
    if (file.name.endsWith(".canvas.md")) return ".canvas.md";
    return "." + file.extension;
  }

  private getFileIcon(file: TFile): string {
    // Handle compound extensions first
    if (file.name.endsWith(".excalidraw.md")) return "PenLine";
    if (file.name.endsWith(".canvas.md")) return "LayoutDashboard";

    const ext = "." + file.extension;
    if (ext === ".md") return "FileText";
    if (ext === ".canvas") return "LayoutDashboard";
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

  private getCurrentDisplayFiles(): TFile[] {
    if (!this.plugin.fileService) return [];
    if (this.currentMode === "directory") {
      const path = this.currentFolder ? this.currentFolder.path : "/";
      const allFiles = this.plugin.fileService.getAllFiles();
      return this.plugin.fileService.getDirectoryChildren(path, allFiles);
    } else if (this.currentFile && this.plugin.linkService) {
      return this.plugin.linkService
        .getForwardLinks(this.currentFile)
        .filter((l): l is ResolvedLink & { file: TFile } => !!l.file)
        .map((l) => l.file);
    }
    return [];
  }

  private getDisplayedFilesForFilters(): TFile[] {
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
        .filter((l): l is ResolvedLink & { file: TFile } => !!l.file)
        .map((l) => l.file);
    }
    return [];
  }

  private onListFileClick(file: TFile): void {
    const ext = "." + file.extension;
    if ([".docx", ".xlsx", ".pptx", ".sql"].includes(ext)) {
      if (this.plugin.openOfficeFile) {
        void this.plugin.openOfficeFile(file);
      }
    } else if (isCodeExtension(file.name)) {
      if (this.plugin.openCodeFile) {
        void this.plugin.openCodeFile(file);
      }
    } else {
      void this.app.workspace.openLinkText(file.path, "/", false);
    }
  }
}
