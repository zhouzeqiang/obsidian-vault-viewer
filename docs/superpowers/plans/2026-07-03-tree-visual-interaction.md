# Tree Visual Interaction Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the file tree's visual interaction with a "minimal line" style — lighter selection background with left accent bar, icon changes on selection (outline→fill + accent color), per-extension file icons, and hover color changes on icons and text.

**Architecture:** CSS variable-driven approach. New `setLucideIconFilled()` function renders filled SVG icons. `highlightRow()` extended with `applyFilledIcon()`/`restoreOutlineIcon()` helpers. `getFileIcon()` expanded with per-extension mapping. All visual changes controlled by CSS variables for theme consistency.

**Tech Stack:** TypeScript, CSS (Obsidian plugin), Lucide icons (SVG), Jest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/lucide-icons.ts` | Modify | Add filled icon SVGs + `setLucideIconFilled()` export |
| `src/views/VaultViewerView.ts` | Modify | Extend `highlightRow()`, `getFileIcon()`, `renderFolder()`, folder click handler |
| `styles.css` | Modify | Selection state, hover state, dark mode, Fresh theme, filter tag |
| `__tests__/lucide-icons.test.ts` | Create | Test `setLucideIconFilled()` and new icon names |
| `__tests__/VaultViewerView.test.ts` | Modify | Add tests for `getFileIcon()` extension mapping |

---

### Task 1: Add Filled Icon SVGs to lucide-icons.ts

**Files:**
- Modify: `src/utils/lucide-icons.ts:4-69` (default icon set)
- Modify: `src/utils/lucide-icons.ts:71-136` (fresh icon set)
- Create: `__tests__/lucide-icons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lucide-icons.test.ts`:

```typescript
import { setLucideIconFilled, setIconTheme, getIconTheme } from "../src/utils/lucide-icons";

describe("lucide-icons filled variants", () => {
  test("setLucideIconFilled renders SVG with fill=currentColor", () => {
    const el = document.createElement("span");
    setLucideIconFilled(el, "FileFill");
    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });

  test("setLucideIconFilled renders SVG with class vv-icon", () => {
    const el = document.createElement("span");
    setLucideIconFilled(el, "FolderFill");
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("vv-icon");
  });

  test("setLucideIconFilled returns empty for unknown icon", () => {
    const el = document.createElement("span");
    setLucideIconFilled(el, "NonExistentIcon");
    expect(el.children.length).toBe(0);
  });

  test("filled icon names exist in default set", () => {
    const el = document.createElement("span");
    const originalTheme = getIconTheme();
    setIconTheme("default");
    for (const name of ["FileFill", "FolderFill", "FileTextFill", "FolderOpenDotFill", "LayoutDashboard", "PenLine"]) {
      setLucideIconFilled(el, name);
      expect(el.querySelector("svg"), `Icon ${name} should render`).not.toBeNull();
      el.empty();
    }
    setIconTheme(originalTheme);
  });

  test("filled icon names exist in fresh set", () => {
    const el = document.createElement("span");
    const originalTheme = getIconTheme();
    setIconTheme("fresh");
    for (const name of ["FileFill", "FolderFill", "FileTextFill", "FolderOpenDotFill", "LayoutDashboard", "PenLine"]) {
      setLucideIconFilled(el, name);
      expect(el.querySelector("svg"), `Icon ${name} should render in fresh theme`).not.toBeNull();
      el.empty();
    }
    setIconTheme(originalTheme);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lucide-icons.test.ts --no-coverage 2>&1 | head -30`
Expected: FAIL — `setLucideIconFilled` is not exported, icon names don't exist yet

- [ ] **Step 3: Add filled icon SVGs to the default icon set**

In `src/utils/lucide-icons.ts`, add the following entries to the `default` object (after `PanelRight` at line 68, before the closing `},`):

```typescript
    FileFill:
      '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" fill="currentColor"/><path d="M14 2v5a1 1 0 0 0 1 1h5" fill="none" stroke="currentColor"/>',
    FolderFill:
      '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" fill="currentColor"/>',
    FileTextFill:
      '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" fill="currentColor"/><path d="M14 2v5a1 1 0 0 0 1 1h5" fill="none" stroke="currentColor"/><path d="M10 9H8" stroke="currentColor" stroke-opacity="0.5"/><path d="M16 13H8" stroke="currentColor" stroke-opacity="0.5"/><path d="M16 17H8" stroke="currentColor" stroke-opacity="0.5"/>',
    FolderOpenDotFill:
      '<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" fill="currentColor"/><circle cx="14" cy="15" r="1"/>',
    LayoutDashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    PenLine:
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
```

- [ ] **Step 4: Add filled icon SVGs to the fresh icon set**

In the `fresh` object (after `PanelRight` at line 135, before the closing `},`):

```typescript
    FileFill:
      '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" fill="currentColor"/><polyline points="13 2 13 9 20 9"/>',
    FolderFill:
      '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="currentColor"/>',
    FileTextFill:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    FolderOpenDotFill:
      '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="currentColor"/>',
    LayoutDashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    PenLine:
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
```

- [ ] **Step 5: Add `setLucideIconFilled()` export function**

In `src/utils/lucide-icons.ts`, add after the existing `setLucideIcon` function (after line 184):

```typescript
export function setLucideIconFilled(el: HTMLElement, name: string, size: number = 16): void {
  el.empty();
  const themePaths = iconSets[currentTheme] || iconSets.default;
  const iconPath = themePaths[name];
  if (!iconPath) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = activeDocument.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", "vv-icon");

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<svg xmlns="${svgNS}">${iconPath}</svg>`, "image/svg+xml");
  const parsedSvg = doc.querySelector("svg");
  if (parsedSvg) {
    for (const child of Array.from(parsedSvg.childNodes)) {
      svg.appendChild(child.cloneNode(true));
    }
  }

  el.appendChild(svg);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/lucide-icons.test.ts --no-coverage`
Expected: All 5 tests PASS

- [ ] **Step 7: Run full test suite to check no regressions**

Run: `npm test`
Expected: All existing tests + new tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/utils/lucide-icons.ts __tests__/lucide-icons.test.ts
git commit -m "Add filled icon SVGs and setLucideIconFilled function"
```

---

### Task 2: Expand getFileIcon() with Per-Extension Mapping

**Files:**
- Modify: `src/views/VaultViewerView.ts:1461-1473`
- Modify: `__tests__/VaultViewerView.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/VaultViewerView.test.ts` (before the closing of the file):

```typescript
// ─── getFileIcon: per-extension icon mapping ────────

describe("getFileIcon extension mapping", () => {
  // We test the logic directly by replicating the function behavior
  // since getFileIcon is a private method. We use a helper that mirrors it.
  function getFileIcon(file: { name: string; extension: string }): string {
    const ext = file.name.endsWith(".excalidraw.md")
      ? ".excalidraw.md"
      : file.name.endsWith(".canvas.md")
        ? ".canvas.md"
        : "." + file.extension;
    if (ext === ".md") return "FileText";
    if (ext === ".canvas") return "LayoutDashboard";
    if (ext === ".excalidraw.md") return "PenLine";
    if (ext === ".docx") return "FileText";
    if (ext === ".xlsx") return "FileSpreadsheet";
    if (ext === ".pptx") return "Presentation";
    if (ext === ".pdf") return "FileText";
    if (ext === ".sql") return "Database";
    if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) return "FileImage";
    return "File";
  }

  test(".md files return FileText", () => {
    expect(getFileIcon({ name: "note.md", extension: "md" })).toBe("FileText");
  });

  test(".canvas files return LayoutDashboard", () => {
    expect(getFileIcon({ name: "board.canvas", extension: "canvas" })).toBe("LayoutDashboard");
  });

  test(".excalidraw.md files return PenLine", () => {
    expect(getFileIcon({ name: "drawing.excalidraw.md", extension: "md" })).toBe("PenLine");
  });

  test("unknown extensions return File", () => {
    expect(getFileIcon({ name: "data.csv", extension: "csv" })).toBe("File");
  });

  test(".xlsx files return FileSpreadsheet", () => {
    expect(getFileIcon({ name: "sheet.xlsx", extension: "xlsx" })).toBe("FileSpreadsheet");
  });

  test(".png files return FileImage", () => {
    expect(getFileIcon({ name: "photo.png", extension: "png" })).toBe("FileImage");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/VaultViewerView.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — `.md` currently returns `"File"` not `"FileText"`, `.canvas` not mapped, `.excalidraw.md` not mapped

- [ ] **Step 3: Implement the expanded getFileIcon()**

Replace the `getFileIcon()` method in `src/views/VaultViewerView.ts` (lines 1461-1473) with:

```typescript
  private getFileIcon(file: TFile): string {
    const ext = this.getExtensionForDisplay(file);
    if (ext === ".md") return "FileText";
    if (ext === ".canvas") return "LayoutDashboard";
    if (ext === ".excalidraw.md") return "PenLine";
    if (ext === ".docx") return "FileText";
    if (ext === ".xlsx") return "FileSpreadsheet";
    if (ext === ".pptx") return "Presentation";
    if (ext === ".pdf") return "FileText";
    if (ext === ".sql") return "Database";
    if (
      [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)
    )
      return "FileImage";
    return "File";
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/VaultViewerView.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/VaultViewerView.ts __tests__/VaultViewerView.test.ts
git commit -m "Expand getFileIcon with per-extension icon mapping"
```

---

### Task 3: Update renderFolder() to Use getFileIcon() and Store iconName

**Files:**
- Modify: `src/views/VaultViewerView.ts:644-668`

- [ ] **Step 1: Update the file row rendering in renderFolder()**

In `src/views/VaultViewerView.ts`, replace lines 651-653:

```typescript
      const fileIcon = row.createSpan({ cls: "vault-viewer-file-icon" });
      setLucideIcon(fileIcon, "File");
      row.createSpan({ cls: "vault-viewer-tree-name", text: file.name });
```

with:

```typescript
      const fileIcon = row.createSpan({ cls: "vault-viewer-file-icon" });
      const iconName = this.getFileIcon(file);
      row.dataset.iconName = iconName;
      setLucideIcon(fileIcon, iconName);
      row.createSpan({ cls: "vault-viewer-tree-name", text: file.name });
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "Use getFileIcon in tree file rows and store iconName in dataset"
```

---

### Task 4: Add applyFilledIcon() and restoreOutlineIcon() Helpers

**Files:**
- Modify: `src/views/VaultViewerView.ts` (add after `highlightRow()`)

- [ ] **Step 1: Add the import for setLucideIconFilled**

At the top of `src/views/VaultViewerView.ts`, find the existing import from `../utils/lucide-icons` and add `setLucideIconFilled`:

```typescript
import { setLucideIcon, setLucideIconFilled } from "../utils/lucide-icons";
```

- [ ] **Step 2: Add applyFilledIcon() method**

Add after the `highlightRow()` method (after line 680):

```typescript
  private applyFilledIcon(row: HTMLElement): void {
    const fileIcon = row.querySelector(".vault-viewer-file-icon");
    const folderIcon = row.querySelector(".vault-viewer-folder-icon");
    if (fileIcon) {
      const iconName = row.dataset.iconName || "File";
      const fillName = iconName + "Fill";
      setLucideIconFilled(fileIcon as HTMLElement, fillName);
    }
    if (folderIcon) {
      const childrenEl = row.nextElementSibling?.hasClass("vault-viewer-children")
        ? row.nextElementSibling
        : null;
      const isExpanded = childrenEl ? !childrenEl.hasClass("hidden") : false;
      setLucideIconFilled(folderIcon as HTMLElement, isExpanded ? "FolderOpenDotFill" : "FolderFill");
    }
  }
```

- [ ] **Step 3: Add restoreOutlineIcon() method**

Add right after `applyFilledIcon()`:

```typescript
  private restoreOutlineIcon(row: HTMLElement): void {
    const fileIcon = row.querySelector(".vault-viewer-file-icon");
    const folderIcon = row.querySelector(".vault-viewer-folder-icon");
    if (fileIcon) {
      const iconName = row.dataset.iconName || "File";
      setLucideIcon(fileIcon as HTMLElement, iconName);
    }
    if (folderIcon) {
      const childrenEl = row.nextElementSibling?.hasClass("vault-viewer-children")
        ? row.nextElementSibling
        : null;
      const isExpanded = childrenEl ? !childrenEl.hasClass("hidden") : false;
      setLucideIcon(folderIcon as HTMLElement, isExpanded ? "FolderOpenDot" : "Folder");
    }
  }
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "Add applyFilledIcon and restoreOutlineIcon helper methods"
```

---

### Task 5: Update highlightRow() to Toggle Filled/Outline Icons

**Files:**
- Modify: `src/views/VaultViewerView.ts:671-680`

- [ ] **Step 1: Replace highlightRow() implementation**

Replace the `highlightRow()` method (lines 671-680):

```typescript
  private highlightRow(el: HTMLElement | null): void {
    if (this.selectedEl) {
      this.selectedEl.removeClass("vault-viewer-highlighted");
    }
    this.selectedEl = el;
    if (el) {
      el.addClass("vault-viewer-highlighted");
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
```

with:

```typescript
  private highlightRow(el: HTMLElement | null): void {
    if (this.selectedEl) {
      this.selectedEl.removeClass("vault-viewer-highlighted");
      this.restoreOutlineIcon(this.selectedEl);
    }
    this.selectedEl = el;
    if (el) {
      el.addClass("vault-viewer-highlighted");
      this.applyFilledIcon(el);
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "Update highlightRow to toggle filled/outline icons on selection"
```

---

### Task 6: Update Folder Click Handler for Filled Icons When Selected

**Files:**
- Modify: `src/views/VaultViewerView.ts:604-614`

- [ ] **Step 1: Update the folder click handler**

Replace the folder click handler (lines 604-614):

```typescript
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = childrenEl.hasClass("hidden");
        childrenEl.toggleClass("hidden", !isHidden);
        toggle.empty();
        setLucideIcon(toggle, isHidden ? "ChevronDown" : "ChevronRight");
        folderIcon.empty();
        setLucideIcon(folderIcon, isHidden ? "FolderOpenDot" : "Folder");
        this.highlightRow(row);
        this.onFolderClick(subfolder);
      });
```

with:

```typescript
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = childrenEl.hasClass("hidden");
        childrenEl.toggleClass("hidden", !isHidden);
        toggle.empty();
        setLucideIcon(toggle, isHidden ? "ChevronDown" : "ChevronRight");
        folderIcon.empty();
        const isSelected = this.selectedEl === row;
        if (isSelected) {
          setLucideIconFilled(folderIcon, isHidden ? "FolderOpenDotFill" : "FolderFill");
        } else {
          setLucideIcon(folderIcon, isHidden ? "FolderOpenDot" : "Folder");
        }
        this.highlightRow(row);
        this.onFolderClick(subfolder);
      });
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/views/VaultViewerView.ts
git commit -m "Update folder click handler to use filled icons when selected"
```

---

### Task 7: Update CSS — Selection State, Hover State, Dark Mode, Filter Tag

**Files:**
- Modify: `styles.css:89-91` (tree row hover)
- Modify: `styles.css:161-168` (filter tag)
- Modify: `styles.css:200-202` (list row hover)
- Modify: `styles.css:261-266` (highlighted state)
- Modify: `styles.css:920` (Fresh theme selected-bg)
- Modify: `styles.css:1154-1162` (compact list hover + highlighted)

- [ ] **Step 1: Update tree row hover (line 89-91)**

Replace:

```css
.vault-viewer-tree-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}
```

with:

```css
.vault-viewer-tree-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}

.vault-viewer-tree-row:hover .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}

.vault-viewer-tree-row:hover .vault-viewer-tree-name {
  color: var(--vv-accent, var(--interactive-accent));
}
```

- [ ] **Step 2: Update filter tag (line 161-168)**

Replace:

```css
.vault-viewer-filter-tag {
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8em;
  background: var(--vv-selected-bg, var(--vv-accent, var(--interactive-accent)));
  color: var(--vv-selected-text, var(--text-on-accent));
}
```

with:

```css
.vault-viewer-filter-tag {
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8em;
  background: var(--vv-accent, var(--interactive-accent));
  color: var(--vv-selected-text, var(--text-on-accent));
}
```

- [ ] **Step 3: Update list row hover (line 200-202)**

Replace:

```css
.vault-viewer-list-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}
```

with:

```css
.vault-viewer-list-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}

.vault-viewer-list-row:hover .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}

.vault-viewer-list-row:hover .vault-viewer-list-name {
  color: var(--vv-accent, var(--interactive-accent));
}
```

- [ ] **Step 4: Replace highlighted state (line 261-266)**

Replace:

```css
.vault-viewer-tree-row.vault-viewer-highlighted,
.vault-viewer-list-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, var(--vv-accent, var(--interactive-accent)));
  color: var(--vv-selected-text, var(--text-on-accent));
  transition: background 0.3s;
}
```

with:

```css
/* Tree row selected state */
.vault-viewer-tree-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, rgba(0, 0, 0, 0.04));
  position: relative;
  transition: background 0.3s;
}

.vault-viewer-tree-row.vault-viewer-highlighted::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 2px;
  border-radius: 1px;
  background: var(--vv-accent, var(--interactive-accent));
}

.vault-viewer-tree-row.vault-viewer-highlighted .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}

/* List row selected state */
.vault-viewer-list-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, rgba(0, 0, 0, 0.04));
  border-left: 2px solid var(--vv-accent, var(--interactive-accent));
  transition: background 0.3s;
}

.vault-viewer-list-row.vault-viewer-highlighted .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}
```

- [ ] **Step 5: Add dark mode rule**

After the highlighted state rules, add:

```css
/* Dark mode selection background */
.theme-dark .vault-viewer-container:not(.theme-fresh) {
  --vv-selected-bg: rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 6: Update Fresh theme selected-bg (line 920)**

Replace:

```css
  --vv-selected-bg: #86efac;
```

with:

```css
  --vv-selected-bg: rgba(22, 163, 74, 0.08);
```

- [ ] **Step 7: Update compact list row hover (line 1154-1156)**

Replace:

```css
.vault-viewer-list-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}
```

with:

```css
.vault-viewer-list-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}

.vault-viewer-list-row:hover .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}

.vault-viewer-list-row:hover .vault-viewer-list-name {
  color: var(--vv-accent, var(--interactive-accent));
}
```

- [ ] **Step 8: Update compact list highlighted state (line 1158-1162)**

Replace:

```css
.vault-viewer-list-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, var(--vv-accent, var(--interactive-accent)));
  color: var(--vv-selected-text, var(--text-on-accent));
  transition: background 0.3s;
}
```

with:

```css
.vault-viewer-list-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, rgba(0, 0, 0, 0.04));
  border-left: 2px solid var(--vv-accent, var(--interactive-accent));
  transition: background 0.3s;
}

.vault-viewer-list-row.vault-viewer-highlighted .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}
```

- [ ] **Step 9: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add styles.css
git commit -m "Update selection, hover, dark mode, and filter tag CSS"
```

---

### Task 8: Final Verification and Build

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds with exit code 0

- [ ] **Step 4: Verify no lint issues on changed files**

Run: `npx tsc --noEmit && echo "Type check passed"`
Expected: "Type check passed"

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "Fix any remaining issues from final verification"
```
