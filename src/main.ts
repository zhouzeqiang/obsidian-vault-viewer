import { Plugin, TFile } from "obsidian";
import {
  VaultViewerSettings,
  DEFAULT_SETTINGS,
  VaultViewerSettingTab,
} from "./settings";
import {
  VaultViewerView,
  VIEW_TYPE_VAULT_VIEWER,
} from "./views/VaultViewerView";
import { OfficeView, VIEW_TYPE_OFFICE } from "./views/OfficeView";
import { OfficeRenderer } from "./services/OfficeRenderer";
import { FileService } from "./services/FileService";
import { LinkService } from "./services/LinkService";
import { setIconTheme } from "./utils/lucide-icons";
import { setLang } from "./i18n";

export default class VaultViewerPlugin extends Plugin {
  settings: VaultViewerSettings;
  fileService: FileService;
  linkService: LinkService;
  officeRenderer: OfficeRenderer;

  async onload() {
    await this.loadSettings();
    setIconTheme(this.settings.theme);
    setLang(this.settings.lang);

    this.fileService = new FileService(this.app.vault);
    this.linkService = new LinkService(this.app.metadataCache);
    this.officeRenderer = new OfficeRenderer(this.app.vault);

    this.addSettingTab(new VaultViewerSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_OFFICE,
      (leaf) => new OfficeView(leaf, this.officeRenderer)
    );

    this.registerView(
      VIEW_TYPE_VAULT_VIEWER,
      (leaf) => new VaultViewerView(leaf, this)
    );

    this.addCommand({
      id: "open",
      name: "Open Viewer",
      callback: () => void this.activateView(),
    });

    this.app.workspace.onLayoutReady(() => {
      void this.activateView();
    });
  }

  async loadSettings() {
    const data = await this.loadData() as Partial<VaultViewerSettings>;
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      data
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView(forceRecreate = false) {
    const { workspace } = this.app;
    if (forceRecreate) {
      workspace.detachLeavesOfType(VIEW_TYPE_VAULT_VIEWER);
    }
    const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_VAULT_VIEWER);
    if (existingLeaves.length > 0) {
      workspace.setActiveLeaf(existingLeaves[0]);
      return;
    }

    const leaf = workspace.getLeftLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({
      type: VIEW_TYPE_VAULT_VIEWER,
      active: true,
    });

    workspace.setActiveLeaf(leaf);
  }

  async openOfficeFile(file: TFile): Promise<void> {
    const { workspace } = this.app;

    // Check if the file is already open in an existing OfficeView tab
    const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_OFFICE);
    for (const leaf of existingLeaves) {
      const view = leaf.view;
      if (view instanceof OfficeView && view.file?.path === file.path) {
        workspace.setActiveLeaf(leaf);
        return;
      }
    }

    // Not already open — create a new tab
    const leaf = workspace.getLeaf(true);
    if (!leaf) return;

    await leaf.setViewState({
      type: VIEW_TYPE_OFFICE,
      active: true,
      state: { filePath: file.path },
    });

    workspace.setActiveLeaf(leaf);
  }

  onunload() {
  }
}
