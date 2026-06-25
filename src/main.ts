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
  private pendingOfficeFile: TFile | null = null;

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
      (leaf) => {
        const file = this.pendingOfficeFile;
        this.pendingOfficeFile = null;
        return new OfficeView(leaf, file!, this.officeRenderer);
      }
    );

    this.registerView(
      VIEW_TYPE_VAULT_VIEWER,
      (leaf) => new VaultViewerView(leaf, this)
    );

    this.addCommand({
      id: "open-vault-viewer",
      name: "Open Vault Viewer",
      callback: () => this.activateView(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
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
      workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    const leaf = workspace.getLeftLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({
      type: VIEW_TYPE_VAULT_VIEWER,
      active: true,
    });

    workspace.revealLeaf(leaf);
  }

  async openOfficeFile(file: TFile): Promise<void> {
    this.pendingOfficeFile = file;
    const leaf = this.app.workspace.getLeaf(true);
    if (!leaf) return;

    await leaf.setViewState({
      type: VIEW_TYPE_OFFICE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_VAULT_VIEWER);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_OFFICE);
  }
}
