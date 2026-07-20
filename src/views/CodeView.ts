import { ItemView, WorkspaceLeaf, TFile, FileSystemAdapter, ViewStateResult, Notice } from "obsidian";
import { highlight, extensionToLanguage } from "../services/CodeRenderer";
import { getFileIcon } from "../utils/file-icons";
import { setLucideIcon } from "../utils/lucide-icons";
import { setSvgContent } from "../utils/html-utils";
import { t } from "../i18n";

export const VIEW_TYPE_CODE = "vault-viewer-code";

export class CodeView extends ItemView {
  file: TFile | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CODE;
  }

  getDisplayText(): string {
    return this.file?.name ?? "Code";
  }

  getIcon(): string {
    return "code";
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
        if (this.contentEl.hasClass("code-view-container")) {
          void this.renderContent();
        }
      }
    }
  }

  async onOpen() {
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
    container.addClass("code-view-container");

    if (!this.file) {
      container.createEl("p", { text: t("code.parseError"), cls: "code-view-error" });
      const closeBtn = container.createEl("button", { cls: "code-view-btn", text: `← ${t("code.back")}` });
      closeBtn.addEventListener("click", () => this.leaf.detach());
      return;
    }

    const ext = this.file.extension.toLowerCase();

    // Action bar
    const actionBar = container.createDiv({ cls: "code-view-actions" });
    const backBtn = actionBar.createEl("button", { cls: "code-view-btn", text: `← ${t("code.back")}` });
    backBtn.addEventListener("click", () => this.leaf.detach());

    // Language badge
    const langId = extensionToLanguage(ext);
    const langBadge = actionBar.createSpan({ cls: "code-view-lang-badge" });
    const langIcon = getFileIcon(ext);
    if (langIcon) {
      const iconEl = langBadge.createSpan({ cls: "code-view-lang-icon" });
      setSvgContent(iconEl, langIcon.svg);
      const svg = iconEl.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.style.color = langIcon.color;
      }
    }
    langBadge.createSpan({ text: langId || ext, cls: "code-view-lang-name" });

    // Filename
    actionBar.createSpan({ text: this.file.name, cls: "code-view-filename" });

    // Open external
    const openBtn = actionBar.createEl("button", { cls: "code-view-btn external" });
    setLucideIcon(openBtn.createSpan(), "Paperclip", 14);
    openBtn.createSpan({ text: ` ${t("code.openExternal")}` });
    openBtn.addEventListener("click", () => { void this.openExternally(); });

    // Copy All button
    const copyAllBtn = actionBar.createEl("button", { cls: "code-view-btn copy-all" });
    setLucideIcon(copyAllBtn.createSpan(), "Copy", 14);
    copyAllBtn.createSpan({ text: ` ${t("code.copyAll")}` });
    copyAllBtn.addEventListener("click", () => {
      if (!this.file) return;
      void (async () => {
        try {
          const content = await this.app.vault.read(this.file!);
          await navigator.clipboard.writeText(content);
          copyAllBtn.empty();
          setLucideIcon(copyAllBtn.createSpan(), "Check", 14);
          copyAllBtn.createSpan({ text: ` ${t("code.copied")}` });
          copyAllBtn.addClass("copied");
          window.setTimeout(() => {
            copyAllBtn.empty();
            setLucideIcon(copyAllBtn.createSpan(), "Copy", 14);
            copyAllBtn.createSpan({ text: ` ${t("code.copyAll")}` });
            copyAllBtn.removeClass("copied");
          }, 2000);
        } catch (_err) {
          console.error("Copy failed:", _err);
          new Notice(t("code.copyFailed", (_err as Error).message));
        }
      })();
    });

    // Status
    const statusEl = container.createDiv({ cls: "code-view-status" });
    statusEl.setText(t("code.parsing"));

    // Code content
    const codeWrapper = container.createDiv({ cls: "code-view-wrapper" });

    try {
      const content = await this.app.vault.read(this.file);
      statusEl.setText("");

      const rendered = highlight(content, ext);
      const pre = codeWrapper.createEl("pre", { cls: "code-view-pre" });
      const code = pre.createEl("code", {
        cls: langId ? `language-${langId}` : "language-none",
      });

      if (langId) {
        setSvgContent(code, rendered);
      } else {
        code.setText(content);
      }

      // Line numbers via CSS counter — triggered by the code element being populated
      pre.addClass("code-view-line-numbers");
    } catch {
      statusEl.setText("");
      codeWrapper.createEl("p", { text: t("code.parseError"), cls: "code-view-error" });
    }
  }

  private async openExternally(): Promise<void> {
    if (!this.file) return;
    const adapter = this.app.vault.adapter;
    const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
    const fullPath = `${basePath}/${this.file.path}`;
    try {
      const win = window as unknown as { require: (mod: string) => { shell: { openPath(p: string): Promise<string> } } };
      const electron = win.require("electron");
      if (electron?.shell) { await electron.shell.openPath(fullPath); return; }
    } catch { /* ignore */ }
    void this.app.workspace.openLinkText(this.file.path, "/", false);
  }

  async onClose() {
    this.contentEl.empty();
  }
}
