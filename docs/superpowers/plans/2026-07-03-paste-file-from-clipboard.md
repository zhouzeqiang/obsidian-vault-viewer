# Implementation Plan: Paste File from System Clipboard

Date: 2026-07-03
Spec: `docs/superpowers/specs/2026-07-03-paste-file-from-clipboard-design.md`

## Overview

Add a "Paste file" right-click context menu on the file list blank area, allowing users to paste a single external file from the system clipboard into the current folder.

## Tasks

### Task 1: Add `listAreaContextMenuEl` property

**File**: `src/views/VaultViewerView.ts`
**Where**: Line ~22, next to `contextMenuEl` property
**What**: Add `listAreaContextMenuEl: HTMLElement | null = null;`

```typescript
// After line 22:
listAreaContextMenuEl: HTMLElement | null = null;
```

### Task 2: Add `getClipboardFilePath()` method

**File**: `src/views/VaultViewerView.ts`
**Where**: After `closeContextMenu` method (after line 1139)
**What**: New private method that reads file path from system clipboard via Electron API

```typescript
private getClipboardFilePath(): string | null {
    try {
        interface ElectronClipboardAPI { read: (format: string) => string; }
        const _window = window as unknown as { require: (mod: string) => ElectronClipboardAPI };
        const { clipboard } = _window.require("electron");
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
```

### Task 3: Add `showListAreaContextMenu()` and `closeListAreaContextMenu()` methods

**File**: `src/views/VaultViewerView.ts`
**Where**: After `getClipboardFilePath()` method
**What**: Two new methods following the same pattern as `showContextMenu`/`closeContextMenu`

```typescript
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
                item.action();
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
```

### Task 4: Add `pasteFileFromClipboard()` method

**File**: `src/views/VaultViewerView.ts`
**Where**: After `closeListAreaContextMenu()` method
**What**: Async method that reads external file and writes to vault

```typescript
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
        const fs = require("fs") as { promises: { readFile: (p: string) => Promise<Buffer> } };
        const path = require("path") as { basename: (p: string, ext?: string) => string; extname: (p: string) => string };

        const buffer = await fs.promises.readFile(filePath);
        const fileName = path.basename(filePath);

        let targetPath = this.currentFolder.path + "/" + fileName;
        let finalName = fileName;
        let counter = 1;

        while (this.app.vault.getAbstractFileByPath(targetPath)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
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
```

### Task 5: Register `contextmenu` event listener on `listContentEl`

**File**: `src/views/VaultViewerView.ts`
**Where**: After line 107 (`this.listEl = this.listContentEl.createDiv(...)`)
**What**: Add contextmenu listener that only triggers on blank area (not on file rows)

```typescript
this.listContentEl.addEventListener("contextmenu", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".vault-viewer-list-row")) return;
    this.showListAreaContextMenu(e);
});
```

**Important**: The file row class is `vault-viewer-list-row` (NOT `.vv-file-row` as in the spec — spec had an error, corrected here).

### Task 6: Add i18n keys to all three locale files

**File**: `src/i18n/en.ts`
**Where**: Before the closing `};` (line 72)
**What**:
```typescript
"listContext.pasteFile": "Paste file",
"notice.filePasted": (name: string) => `File pasted: ${name}`,
"notice.pasteFailed": "Failed to paste file",
"notice.noFileInClipboard": "No file found in clipboard",
```

**File**: `src/i18n/zh-CN.ts`
**Where**: Before the closing `};` (line 72)
**What**:
```typescript
"listContext.pasteFile": "粘贴文件",
"notice.filePasted": (name: string) => `已粘贴文件: ${name}`,
"notice.pasteFailed": "粘贴文件失败",
"notice.noFileInClipboard": "剪贴板中没有文件",
```

**File**: `src/i18n/zh-TW.ts`
**Where**: Before the closing `};` (line 72)
**What**:
```typescript
"listContext.pasteFile": "貼上檔案",
"notice.filePasted": (name: string) => `已貼上檔案: ${name}`,
"notice.pasteFailed": "貼上檔案失敗",
"notice.noFileInClipboard": "剪貼簿中沒有檔案",
```

### Task 7: Add disabled state CSS

**File**: `styles.css`
**Where**: After `.vault-viewer-context-item:hover` block (after line 611)
**What**:
```css
.vault-viewer-context-item.is-disabled {
    opacity: 0.4;
    pointer-events: none;
}
```

### Task 8: Build verification

Run `npm run build` to confirm no TypeScript or bundling errors.

## Spec Deviations

1. **File row class**: Spec used `.vv-file-row`, actual codebase uses `.vault-viewer-list-row`. Plan uses the correct class.
2. **Interface placement**: Spec defined `ElectronClipboardAPI` at module level; plan places it inside `getClipboardFilePath()` to match the existing pattern in `showContextMenu()` where `ElectronAPI` is defined locally.

## Execution Order

Tasks 1-5 are sequential (each builds on the previous in the same file). Tasks 6-7 are independent of each other but depend on Tasks 1-5 conceptually. Task 8 depends on all others.

Recommended: Execute Tasks 1-5 together as one edit session on VaultViewerView.ts, then Tasks 6-7 in parallel, then Task 8.
