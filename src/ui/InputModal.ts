import { App, Modal } from "obsidian";

export class InputModal extends Modal {
  result: string = "";
  constructor(
    app: App,
    private titleText: string,
    private placeholder: string,
    private defaultValue: string,
    private onSubmit: (value: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("vault-viewer-input-modal");
    contentEl.createEl("h3", { text: this.titleText });

    const inputContainer = contentEl.createDiv({ cls: "vault-viewer-input-wrapper" });
    const inputEl = inputContainer.createEl("input", {
      cls: "vault-viewer-input-full",
      attr: { type: "text", placeholder: this.placeholder },
    });
    inputEl.value = this.defaultValue;
    this.result = this.defaultValue;
    inputEl.addEventListener("input", () => {
      this.result = inputEl.value;
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submit();
    });
    inputEl.select();
    setTimeout(() => inputEl.focus(), 50);

    const btnContainer = contentEl.createDiv({ cls: "vault-viewer-input-buttons" });
    const okBtn = btnContainer.createEl("button", {
      cls: "vault-viewer-input-btn mod-cta",
      text: "确定",
    });
    okBtn.addEventListener("click", () => this.submit());
    const cancelBtn = btnContainer.createEl("button", {
      cls: "vault-viewer-input-btn",
      text: "取消",
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  private submit(): void {
    if (this.result.trim()) {
      this.onSubmit(this.result.trim());
      this.close();
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
