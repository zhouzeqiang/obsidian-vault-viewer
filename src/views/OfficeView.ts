import { ItemView, WorkspaceLeaf, TFile, FileSystemAdapter, ViewStateResult } from "obsidian";
import { OfficeRenderer } from "../services/OfficeRenderer";
import { setLucideIcon } from "../utils/lucide-icons";
import { t } from "../i18n";

export const VIEW_TYPE_OFFICE = "vault-viewer-office";

export class OfficeView extends ItemView {
  file: TFile | null = null;
  renderer: OfficeRenderer;

  constructor(leaf: WorkspaceLeaf, renderer: OfficeRenderer) {
    super(leaf);
    this.renderer = renderer;
  }

  getViewType(): string {
    return VIEW_TYPE_OFFICE;
  }

  getDisplayText(): string {
    return this.file?.name ?? "Office";
  }

  getIcon(): string {
    return "document";
  }

  getState(): Record<string, unknown> {
    return { filePath: this.file?.path ?? "" };
  }

  async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const filePath = state.filePath as string | undefined;
    if (filePath) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        this.file = file;
        // If onOpen already ran (container has content), re-render with the new file
        if (this.contentEl.hasClass("office-view-container")) {
          void this.renderContent();
        }
      }
    }
  }

  async onOpen() {
    // Obsidian lifecycle: constructor → onOpen → setState
    // When setViewState is called with state, setState runs AFTER onOpen.
    // So we need to read filePath from the leaf's view state as a fallback.
    if (!this.file) {
      const viewState = this.leaf.getViewState();
      const filePath = (viewState?.state as Record<string, unknown>)?.filePath as string | undefined;
      if (filePath) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          this.file = file;
        }
      }
    }

    void this.renderContent();
  }

  private async renderContent(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("office-view-container");

    if (!this.file) {
      container.createEl("p", {
        text: t("office.parseError"),
        cls: "office-view-error",
      });
      const closeBtn = container.createEl("button", {
        cls: "office-view-btn",
        text: t("office.back"),
      });
      closeBtn.addEventListener("click", () => {
        this.leaf.detach();
      });
      return;
    }

    const actionBar = container.createDiv({ cls: "office-view-actions" });

    const backBtn = actionBar.createEl("button", {
      cls: "office-view-btn",
      text: `← ${t("office.back")}`,
    });
    backBtn.addEventListener("click", () => {
      this.leaf.detach();
    });

    const openExternalBtn = actionBar.createEl("button", {
      cls: "office-view-btn external",
    });
    setLucideIcon(openExternalBtn.createSpan(), "Paperclip", 14);
    openExternalBtn.createSpan({ text: ` ${t("office.openExternal")}` });
    openExternalBtn.addEventListener("click", () => {
      void this.openExternally();
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
    if (!this.file) return;
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
    } catch {
      // Electron not available
    }

    void this.app.workspace.openLinkText(this.file.path, "/", false);
  }

  async onClose() {
    // this.renderer.disposeUniver(); // TODO: implement disposeUniver in OfficeRenderer
    this.contentEl.empty();
  }
}

