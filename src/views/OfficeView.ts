import { ItemView, WorkspaceLeaf, TFile, FileSystemAdapter } from "obsidian";
import { OfficeRenderer } from "../services/OfficeRenderer";
import { setLucideIcon } from "../utils/lucide-icons";
import { t } from "../i18n";

export const VIEW_TYPE_OFFICE = "vault-viewer-office";

export class OfficeView extends ItemView {
  file: TFile;
  renderer: OfficeRenderer;

  constructor(leaf: WorkspaceLeaf, file: TFile, renderer: OfficeRenderer) {
    super(leaf);
    this.file = file;
    this.renderer = renderer;
  }

  getViewType(): string {
    return VIEW_TYPE_OFFICE;
  }

  getDisplayText(): string {
    return this.file.name;
  }

  getIcon(): string {
    return "document";
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("office-view-container");

    const actionBar = container.createDiv({ cls: "office-view-actions" });

    const backBtn = actionBar.createEl("button", {
      cls: "office-view-btn",
      text: `← ${t("office.back")}`,
    });
    backBtn.addEventListener("click", () => {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_OFFICE);
    });

    const openExternalBtn = actionBar.createEl("button", {
      cls: "office-view-btn external",
    });
    setLucideIcon(openExternalBtn.createSpan(), "Paperclip", 14);
    openExternalBtn.createSpan({ text: ` ${t("office.openExternal")}` });
    openExternalBtn.addEventListener("click", () => {
      void this.openExternally();
    });

    const title = actionBar.createSpan({
      cls: "office-view-title",
      text: this.file.name,
    });

    const statusEl = container.createDiv({ cls: "office-view-status" });
    statusEl.setText(t("office.parsing"));

    const contentEl = container.createDiv({ cls: "office-view-content" });

    try {
      await this.renderer.render(this.file, contentEl);
      statusEl.setText("");
    } catch (err) {
      statusEl.setText("");
      if ((err as Error)?.message === "OPEN_EXTERNALLY") {
        await this.openExternally();
        return;
      }
      contentEl.createEl("p", {
        text: t("office.parseError"),
        cls: "office-view-error",
      });
      openExternalBtn.empty();
      setLucideIcon(openExternalBtn.createSpan(), "Paperclip", 14);
      openExternalBtn.createSpan({ text: ` ${t("office.openInEditor")}` });
      openExternalBtn.removeClass("hidden");
    }
  }

  private async openExternally(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
    const fullPath = `${basePath}/${this.file.path}`;

    try {
      const _window = window as unknown as { require: (mod: string) => { shell: { openPath(path: string): Promise<string> } } };
      const electron = _window.require("electron");
      if (electron && electron.shell) {
        await electron.shell.openPath(fullPath);
        return;
      }
    } catch (e) {
      // Electron not available
    }

    this.app.workspace.openLinkText(this.file.path, "/", false);
  }

  async onClose() {
    this.contentEl.empty();
  }
}
