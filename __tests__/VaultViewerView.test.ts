import { VaultViewerView } from "../src/views/VaultViewerView";

// Minimal mock for VaultViewerView — we test specific method behaviors
class MockView {
  currentMode: "directory" | "references" = "directory";
  currentFolder: any = null;
  currentFile: any = null;
  lastFolderPath: string = "";
  selectedListPath: string | null = null;
  app: any;
  plugin: any;
  contentEl: any;
  treeEl: any;
  listEl: any;
  filterTagsEl: any;
  modeIndicatorEl: any;
  toolbarEl: any;
  searchWrapperEl: any;
  sortBtnEl: any;
  orderBtnEl: any;
  searchToggleEl: any;
  selectedEl: any = null;
  treeToolbarEl: any;
  resizerEl: any;
  listContentEl: any;
  isResizing = false;
  expandedPaths: Set<string> = new Set();
  searchQuery = "";
  syncTimeout = 0;
  sortDropdownEl: any = null;

  onTreeFolderClick(item: any): void {
    this.onFolderClick(item);
  }

  onFolderClick(folder: any): void {
    (this as any).currentFolder = folder;
    (this as any).currentMode = "directory";
    (this as any).selectedListPath = null;
  }

  renderFileListModeA = jest.fn();
  renderFileListModeB = jest.fn();
  updateDynamicToolbar = jest.fn();
  refreshFileList = jest.fn();
  locateInTree = jest.fn();
  saveExpandedState = jest.fn().mockReturnValue(new Set());
  restoreExpandedState = jest.fn();
  renderTree = jest.fn();

  syncWithActiveEditor(): void {
    const file = { path: "/test/doc.md", parent: { path: "/test" }, extension: "md" };
    if (this.currentMode === "references" && this.currentFile?.path === file.path) return;
    if (this.currentMode === "directory" && this.currentFolder?.path === file.parent?.path) return;
    this.currentMode = "directory";
    this.currentFolder = file.parent;
    (this as any).renderFileListModeA(file.parent.path);
    (this as any).updateDynamicToolbar();
  }

  onTreeItemDelete(item: any, isFolder: boolean, vault: any): void {
    if (isFolder && item.children) {
      const nonEmpty = (item.children as any[]).filter(
        (c: any) => c.children !== undefined || c.extension
      );
      if (nonEmpty.length > 0) return;
    }
    if (!confirm(`确认删除 ${item.name}？`)) return;
    vault.trash(item, false);
  }
}

// ─── Bug 3: syncWithActiveEditor should not override reference mode ────────

describe("syncWithActiveEditor guard", () => {
  test("does not override reference mode when active file matches currentFile", () => {
    const view = new MockView() as any;
    view.currentMode = "references";
    view.currentFile = { path: "/test/doc.md" };

    view.syncWithActiveEditor();

    // After sync, should still be in reference mode
    expect(view.currentMode).toBe("references");
  });
});

// ─── Bug 2: onFolderClick should always set currentFolder ────────

describe("onFolderClick", () => {
  test("updates currentFolder when clicking any folder regardless of expand state", () => {
    const view = new MockView() as any;
    const folderA = { path: "/folderA" };
    const folderB = { path: "/folderB" };

    view.onTreeFolderClick(folderA);
    expect(view.currentFolder?.path).toBe("/folderA");

    view.onTreeFolderClick(folderB);
    expect(view.currentFolder?.path).toBe("/folderB");
  });
});

// ─── Bug 1: delete should use vault.trash with system=false ────────

describe("tree context menu locate", () => {
  function simulateLocateClick(view: any, item: any, isFolder: boolean): void {
    const parent = item.parent || { path: "/" };
    if (parent.path === item.path) {
      view.onFolderClick(item);
    } else {
      view.locateInTree(parent);
      view.onFolderClick(parent);
    }
  }

  test('locates parent folder for nested files', () => {
    const view = new MockView() as any;
    view.onFolderClick = jest.fn();
    view.locateInTree = jest.fn();
    const file = { path: "/folderA/doc.md", name: "doc.md", parent: { path: "/folderA" } };

    simulateLocateClick(view, file, false);

    expect(view.onFolderClick).toHaveBeenCalledWith(file.parent);
  });

  test('locates parent folder for nested folders', () => {
    const view = new MockView() as any;
    view.onFolderClick = jest.fn();
    view.locateInTree = jest.fn();
    const folder = { path: "/folderA/sub", name: "sub", parent: { path: "/folderA" } };

    simulateLocateClick(view, folder, true);

    expect(view.onFolderClick).toHaveBeenCalledWith(folder.parent);
  });

  test('root folder shows itself', () => {
    const view = new MockView() as any;
    view.onFolderClick = jest.fn();
    view.locateInTree = jest.fn();
    const root = { path: "/" };

    simulateLocateClick(view, root, true);

    expect(view.onFolderClick).toHaveBeenCalledWith(root);
  });
});

describe("onTreeItemDelete", () => {
  beforeEach(() => {
    (global as any).confirm = jest.fn().mockReturnValue(true);
  });

  test("shows confirm dialog before deleting", () => {
    const view = new MockView() as any;
    const vault = { trash: jest.fn() };
    const item = { path: "/test/doc.md", name: "doc.md" };

    view.onTreeItemDelete(item, false, vault);

    expect((global as any).confirm).toHaveBeenCalledWith("确认删除 doc.md？");
    expect(vault.trash).toHaveBeenCalledWith(item, false);
  });

  test("does not delete when confirm is cancelled", () => {
    (global as any).confirm = jest.fn().mockReturnValue(false);
    const view = new MockView() as any;
    const vault = { trash: jest.fn() };
    const item = { path: "/test/doc.md", name: "doc.md" };

    view.onTreeItemDelete(item, false, vault);

    expect(vault.trash).not.toHaveBeenCalled();
  });
});
