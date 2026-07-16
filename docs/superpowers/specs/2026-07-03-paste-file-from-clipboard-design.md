# File List Context Menu: Paste File from System Clipboard

Date: 2026-07-03
Author: AI brainstorming session

## Summary

Add a "Paste file" option to the right-click context menu on the file list area (blank space) of Vault Viewer, allowing users to paste a single file from the system clipboard into the current folder.

## Motivation

Users currently have no way to import external files into the Vault from within the plugin. To add a file from outside, they must switch to the system file manager, copy the file, navigate to the target folder in the Vault, and paste it there. This feature enables a direct "copy in system → paste in plugin" workflow, reducing context switching.

## Files Changed

| File | Change |
|------|--------|
| `src/views/VaultViewerView.ts` | Add `showListAreaContextMenu()` and `closeListAreaContextMenu()` methods; add `pasteFileFromClipboard()` and `getClipboardFilePath()` methods; add `listAreaContextMenuEl` property; add `contextmenu` event listener on list container blank area |
| `src/i18n/en.ts` | Add `listContext.pasteFile`, `notice.filePasted`, `notice.pasteFailed`, `notice.noFileInClipboard` |
| `src/i18n/zh-CN.ts` | Add `listContext.pasteFile`, `notice.filePasted`, `notice.pasteFailed`, `notice.noFileInClipboard` |
| `src/i18n/zh-TW.ts` | Add `listContext.pasteFile`, `notice.filePasted`, `notice.pasteFailed`, `notice.noFileInClipboard` |
| `styles.css` | Add `.vault-viewer-context-item.is-disabled` style for greyed-out menu items |

## Detailed Design

### 1. Detect clipboard file path

Use Electron's clipboard API to read the file path from the system clipboard. Follow the same pattern as the existing `showContextMenu` method for accessing Electron APIs (typed interface + `window.require`):

```typescript
interface ElectronClipboardAPI { read: (format: string) => string; }

private getClipboardFilePath(): string | null {
    try {
        const _window = window as unknown as { require: (mod: string) => ElectronClipboardAPI };
        const { clipboard } = _window.require("electron");
        // Read file URL from clipboard (works on Windows/macOS)
        const fileUrl = clipboard.read("public.file-url");
        if (fileUrl && fileUrl.startsWith("file://")) {
            // Convert file URL to local path
            // Windows: file:///C:/path/to/file.txt → C:/path/to/file.txt
            // macOS:   file:///path/to/file.txt → /path/to/file.txt
            let filePath = fileUrl.replace("file:///", "");
            // On non-Windows, the path lost its leading slash — restore it
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

**Platform notes**:
- **Windows**: `clipboard.read('public.file-url')` returns a `file:///C:/...` URL when a file is copied in Explorer.
- **macOS**: Same API works with Finder copy operations, returns `file:///Users/...`.
- **Linux**: May require fallback to `clipboard.readBuffer('x-special/gnome-copied-files')`. Not supported in v1.

### 2. Add context menu on file list blank area

Currently, the file list only shows a context menu when right-clicking on a file row. A new context menu is added for right-clicking on the blank area of the file list. Follow the same custom DOM menu pattern as `showContextMenu()`:

```typescript
private listAreaContextMenuEl: HTMLElement | null = null;

private showListAreaContextMenu(e: MouseEvent): void {
    e.preventDefault();
    this.closeListAreaContextMenu();

    // Only in directory mode
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

**CSS for disabled state** (add to `styles.css`):
```css
.vault-viewer-context-item.is-disabled {
    opacity: 0.4;
    pointer-events: none;
}
```

**Event listener registration**: In the `renderFileListModeA()` method, add a `contextmenu` listener on the list container:

```typescript
this.listContentEl.addEventListener('contextmenu', (e: MouseEvent) => {
    // Only trigger on blank area, not on file rows
    const target = e.target as HTMLElement;
    if (target.closest('.vv-file-row')) return;
    this.showListAreaContextMenu(e);
});
```

### 3. Paste file implementation

```typescript
private async pasteFileFromClipboard(): Promise<void> {
    const filePath = this.getClipboardFilePath();
    if (!filePath) {
        new Notice(t('notice.noFileInClipboard'));
        return;
    }

    // Only available in directory mode
    if (!this.currentFolder) {
        new Notice(t('notice.pasteFailed'));
        return;
    }

    try {
        const fs = require('fs') as { promises: { readFile: (p: string) => Promise<Buffer> } };
        const path = require('path') as { basename: (p: string, ext?: string) => string; extname: (p: string) => string };

        // Read external file asynchronously
        const buffer = await fs.promises.readFile(filePath);
        const fileName = path.basename(filePath);

        // Build target path, handle name conflicts
        let targetPath = this.currentFolder.path + '/' + fileName;
        let finalName = fileName;
        let counter = 1;

        while (this.app.vault.getAbstractFileByPath(targetPath)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            finalName = `${base}-${counter}${ext}`;
            targetPath = this.currentFolder.path + '/' + finalName;
            counter++;
        }

        // Write to vault
        await this.app.vault.createBinary(targetPath, new Uint8Array(buffer));

        // Refresh UI
        this.refreshFileList();
        this.renderTree();

        new Notice(t('notice.filePasted').replace('{name}', finalName));
    } catch (err) {
        console.error('Paste file failed:', err);
        new Notice(t('notice.pasteFailed'));
    }
}
```

### 4. Availability conditions

The "Paste file" menu item is:
- **Visible**: Always shown in the file list blank area context menu
- **Disabled** (greyed out): When no file is detected in the system clipboard
- **Enabled**: When a file path is detected in the system clipboard
- **Only in directory mode**: The menu only appears when `currentFolder` is set (directory mode). In reference mode, there is no "current folder" to paste into.

### Edge Cases

- **No file in clipboard**: Menu item is disabled (greyed out). If somehow triggered, shows `notice.noFileInClipboard`.
- **Same-name file exists**: Auto-append counter suffix (e.g., `report-1.xlsx`, `report-2.xlsx`).
- **Reference mode**: No context menu on blank area (no current folder to paste into).
- **Large files**: No size limit enforced; Obsidian's `createBinary` handles the write. Very large files may cause brief UI freeze — acceptable for v1.
- **Binary files**: Supported — `fs.readFileSync` returns a Buffer, converted to `Uint8Array` for `createBinary`.
- **Folders in clipboard**: If the clipboard contains a folder path, `fs.readFileSync` will throw. The error is caught and `notice.pasteFailed` is shown.
- **Permission errors**: If the external file cannot be read (e.g., locked by another process), the error is caught and `notice.pasteFailed` is shown.
- **Special characters in filename**: `path.basename()` handles most cases; `decodeURIComponent` handles URL-encoded characters from the clipboard.

## i18n Keys

```
listContext.pasteFile    = "Paste file" / "粘贴文件" / "貼上檔案"
notice.filePasted       = "File pasted: {name}" / "已粘贴文件: {name}" / "已貼上檔案: {name}"
notice.pasteFailed      = "Failed to paste file" / "粘贴文件失败" / "貼上檔案失敗"
notice.noFileInClipboard = "No file found in clipboard" / "剪贴板中没有文件" / "剪貼簿中沒有檔案"
```

## Testing

1. Copy a file in system file manager → right-click file list blank area → "Paste file" is enabled
2. Click "Paste file" → file appears in current folder, notice shown
3. No file in clipboard → "Paste file" is disabled (greyed out)
4. Paste when same-name file exists → auto-renamed with counter suffix
5. In reference mode → no context menu on blank area
6. Paste a folder path → error notice shown
7. Paste a locked file → error notice shown
8. File list and tree refresh after successful paste
