import { App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
  private resolved = false;
  constructor(
    app: App,
    private titleText: string,
    private message: string,
    private onConfirm: () => void | Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("vault-viewer-input-modal");
    contentEl.createEl("h3", { text: this.titleText });
    contentEl.createEl("p", { text: this.message });

    const btnContainer = contentEl.createDiv({ cls: "vault-viewer-input-buttons" });
    const okBtn = btnContainer.createEl("button", {
      cls: "vault-viewer-input-btn mod-cta",
      text: "确认删除",
    });
    okBtn.addEventListener("click", async () => {
      this.resolved = true;
      await this.onConfirm();
      this.close();
    });
    const cancelBtn = btnContainer.createEl("button", {
      cls: "vault-viewer-input-btn",
      text: "取消",
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
