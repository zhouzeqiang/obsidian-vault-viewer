# Tree Visual Interaction Enhancement Spec

## Summary

Optimize the file tree's visual interaction with a "minimal line" style: lighter selection background with left accent bar, icon changes on selection (outline→fill + accent color), per-extension file icons, and hover color changes on icons and text only.

## Motivation

Current issues:
1. Selection background uses `--interactive-accent` (deep accent color) — too dark, overwhelms the row
2. No icon change on selection — hard to distinguish selected state visually
3. All tree files use the same `File` icon — no visual differentiation by type
4. Hover only changes background — icons and text remain unchanged, lacking interactivity feedback

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual style | Minimal line (macOS Finder-like) | User preference — clean, unobtrusive |
| Selection indicator | Left accent bar + very light background | Clear without being heavy |
| Selected icon change | Outline→Fill + accent color | User preference — both effects selected |
| File icon differentiation | Per-extension mapping | User preference — .md/.canvas/.excalidraw each get unique icon |
| Hover effect | Icon + text color change only (no background change) | User preference — subtle, non-distracting |
| Implementation approach | CSS variable-driven (Scheme A) | User preference — consistent with existing theme system |

## Detailed Changes

### 1. Selection State: Left Accent Bar + Very Light Background

**File: `styles.css`**

Replace the current `.vault-viewer-highlighted` rules (lines 261-266, 1158-1162):

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

/* Selected icon color */
.vault-viewer-tree-row.vault-viewer-highlighted .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}

/* List row selected state */
.vault-viewer-list-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, rgba(0, 0, 0, 0.04));
  position: relative;
  transition: background 0.3s;
}

.vault-viewer-list-row.vault-viewer-highlighted::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 2px;
  border-radius: 1px;
  background: var(--vv-accent, var(--interactive-accent));
}

.vault-viewer-list-row.vault-viewer-highlighted .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}
```

**Key changes:**
- Remove `color: var(--vv-selected-text, var(--text-on-accent))` — text keeps original color
- Add `::before` pseudo-element for left accent bar (2px wide, rounded)
- Add `.vv-icon` color rule for accent color on selected icons
- Background uses `--vv-selected-bg` with fallback to `rgba(0,0,0,0.04)`

**Fresh theme update** (line 920):
```css
.vault-viewer-container.theme-fresh {
  --vv-selected-bg: rgba(22, 163, 74, 0.08);
}
```

**Dark mode consideration**: The `rgba(0,0,0,0.04)` fallback works for light mode. For dark mode, we need:
```css
.theme-dark .vault-viewer-container:not(.theme-fresh) {
  --vv-selected-bg: rgba(255, 255, 255, 0.06);
}
```

### 2. Selected Icon Change: Outline→Fill + Accent Color

**File: `src/utils/lucide-icons.ts`**

Add filled versions of key icons to both `default` and `fresh` icon sets:

```typescript
// In default icon set:
FileFill:
  '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" fill="currentColor"/><path d="M14 2v5a1 1 0 0 0 1 1h5" fill="none" stroke="currentColor"/>',
FolderFill:
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" fill="currentColor"/>',
FileTextFill:
  '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" fill="currentColor"/><path d="M14 2v5a1 1 0 0 0 1 1h5" fill="none" stroke="currentColor"/><path d="M10 9H8" stroke="currentColor" stroke-opacity="0.5"/><path d="M16 13H8" stroke="currentColor" stroke-opacity="0.5"/><path d="M16 17H8" stroke="currentColor" stroke-opacity="0.5"/>',
LayoutDashboard:
  '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
PenLine:
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
```

Same icons need to be added to the `fresh` icon set with appropriate styling.

**File: `src/views/VaultViewerView.ts`**

Modify `highlightRow()` method (line 671):

```typescript
private highlightRow(el: HTMLElement | null): void {
  // Restore previous selection: switch icons back to outline
  if (this.selectedEl) {
    this.selectedEl.removeClass("vault-viewer-highlighted");
    this.restoreOutlineIcon(this.selectedEl);
  }
  if (!el) return;
  this.selectedEl = el;
  el.addClass("vault-viewer-highlighted");
  // Switch icons to filled version
  this.applyFilledIcon(el);
}
```

Add helper methods:

```typescript
private applyFilledIcon(row: HTMLElement): void {
  const fileIcon = row.querySelector(".vault-viewer-file-icon");
  const folderIcon = row.querySelector(".vault-viewer-folder-icon");
  if (fileIcon) {
    const iconName = (row as HTMLElement).dataset.iconName || "File";
    const fillName = iconName + "Fill";
    setLucideIcon(fileIcon as HTMLElement, fillName);
  }
  if (folderIcon) {
    // For folders, use FolderFill (or FolderOpenDotFill if expanded)
    const isExpanded = !row.nextElementSibling?.hasClass("hidden");
    setLucideIcon(folderIcon as HTMLElement, isExpanded ? "FolderOpenDot" : "FolderFill");
  }
}

private restoreOutlineIcon(row: HTMLElement): void {
  const fileIcon = row.querySelector(".vault-viewer-file-icon");
  const folderIcon = row.querySelector(".vault-viewer-folder-icon");
  if (fileIcon) {
    const iconName = row.dataset.iconName || "File";
    setLucideIcon(fileIcon as HTMLElement, iconName);
  }
  if (folderIcon) {
    const isExpanded = !row.nextElementSibling?.hasClass("hidden");
    setLucideIcon(folderIcon as HTMLElement, isExpanded ? "FolderOpenDot" : "Folder");
  }
}
```

Store icon name on file rows in `renderFolder()`:
```typescript
// Line 652: change from
setLucideIcon(fileIcon, "File");
// to
const iconName = this.getFileIcon(file);
row.dataset.iconName = iconName;
setLucideIcon(fileIcon, iconName);
```

### 3. File Icon Differentiation by Extension

**File: `src/views/VaultViewerView.ts`**

Expand `getFileIcon()` method (line 1461):

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
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) return "FileImage";
  return "File";
}
```

**Key change**: `.md` → `FileText`, `.canvas` → `LayoutDashboard`, `.excalidraw.md` → `PenLine` (before the generic fallback).

### 4. Hover Effect: Icon + Text Color Change Only

**File: `styles.css`**

Modify existing hover rules and add new ones:

```css
/* Tree row hover — keep subtle background but add icon/text color */
.vault-viewer-tree-row:hover {
  background: var(--vv-row-hover, var(--background-modifier-hover));
}

.vault-viewer-tree-row:hover .vv-icon {
  color: var(--vv-accent, var(--interactive-accent));
}

.vault-viewer-tree-row:hover .vault-viewer-tree-name {
  color: var(--vv-accent, var(--interactive-accent));
}

/* List row hover */
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

**Note**: We keep the subtle background hover (`--background-modifier-hover`) for usability, but the primary visual feedback comes from icon/text color change.

### 5. Filter Tag Consistency

The `.vault-viewer-filter-tag` (line 161-168) also uses `--vv-selected-bg`. Since we're changing the semantics of this variable, filter tags should keep their current appearance. Update filter tag to use explicit accent color:

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

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `styles.css` | Modify | Selection state, hover state, dark mode, filter tag |
| `src/utils/lucide-icons.ts` | Add | FileFill, FolderFill, FileTextFill, LayoutDashboard, PenLine (both themes) |
| `src/views/VaultViewerView.ts` | Modify | highlightRow(), getFileIcon(), renderFolder() file icon line |

## Self-Review Fixes

### Fix 1: `setLucideIcon` hardcodes `fill="none"`

**Problem**: `setLucideIcon()` creates SVG with `fill="none"` (line 167). Filled icons need `fill="currentColor"`. Simply adding "Fill" icon names won't work because the SVG attribute overrides the path's `fill`.

**Solution**: Add a `setLucideIconFilled()` method that sets `fill="currentColor"` on the SVG element instead of `fill="none"`. Filled icon paths will use `fill="currentColor"` on individual paths, and the SVG element's `fill` attribute will be `currentColor` to inherit properly.

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
  svg.setAttribute("fill", "currentColor");  // Changed from "none"
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

### Fix 2: `::before` on `<tr>` list rows

**Problem**: `.vault-viewer-list-row` is a `<tr>` element. `::before` pseudo-elements don't render properly on table rows due to table layout constraints.

**Solution**: Use `border-left` on the `<tr>` instead of `::before` for list rows:

```css
.vault-viewer-list-row.vault-viewer-highlighted {
  background: var(--vv-selected-bg, rgba(0, 0, 0, 0.04));
  border-left: 2px solid var(--vv-accent, var(--interactive-accent));
  transition: background 0.3s;
}
```

Tree rows (which are `<div>` elements) can still use `::before` since they support `position: relative` + absolute positioning.

### Fix 3: Folder expanded state detection

**Problem**: `restoreOutlineIcon()` uses `row.nextElementSibling?.hasClass("hidden")` to detect expansion, but `nextElementSibling` might not be the children container (could be another tree row).

**Solution**: Store the children container reference on the row via `dataset`, or use a more reliable selector. Since folder rows are always followed by their `.vault-viewer-children` div in the DOM, we can use:

```typescript
const childrenEl = row.nextElementSibling?.hasClass("vault-viewer-children")
  ? row.nextElementSibling
  : null;
const isExpanded = childrenEl ? !childrenEl.hasClass("hidden") : false;
```

### Fix 4: No `FolderOpenDotFill` icon

**Problem**: When a folder is both selected and expanded, we need a filled version of `FolderOpenDot`. Without it, the icon would revert to outline on expansion.

**Solution**: Add `FolderOpenDotFill` to both icon sets. The filled version has the same path but with `fill="currentColor"` on the folder body path.

### Fix 5: `::before` position with dynamic `padding-left`

**Problem**: Tree rows have dynamic `padding-left` (e.g., `depth * 12 + 4`px). The `::before` with `left: 0` will be at the very left edge of the row, which is correct — the accent bar should span the full row height from the left edge, regardless of content padding. This is actually the desired behavior (like VS Code's selection indicator).

**No fix needed** — `left: 0` is correct.

## Edge Cases

1. **Folder selection + expansion**: When a folder is selected and then expanded/collapsed, the icon should update correctly (FolderFill ↔ FolderOpenDotFill). The click handler already calls `setLucideIcon(folderIcon, ...)` — need to check if selected and use filled variant.
2. **Dark mode**: `--vv-selected-bg` fallback must work in both light and dark Obsidian themes
3. **Fresh theme**: Already has custom `--vv-selected-bg`, needs update to new rgba style
4. **List mode**: Same selection/hover changes apply to `.vault-viewer-list-row` (using `border-left` instead of `::before`)
5. **Filter tags**: Must not be affected by `--vv-selected-bg` change — use `--vv-accent` directly
6. **Drag state**: `.drag-over` class should not conflict with new selection styles
7. **Folder click handler**: Currently sets folder icon to `FolderOpenDot`/`Folder` on toggle. When selected, should use `FolderOpenDotFill`/`FolderFill` instead

## Testing

- [ ] Select a file in tree → left accent bar visible, icon fills + accent color, background very light
- [ ] Select a folder in tree → same visual treatment
- [ ] Deselect (click another) → previous row restores outline icon
- [ ] Hover over tree row → icon and text turn accent color
- [ ] Hover over list row → icon and text turn accent color
- [ ] .md file shows FileText icon, .canvas shows LayoutDashboard, .excalidraw.md shows PenLine
- [ ] Fresh theme: selection uses green-tinted background
- [ ] Dark mode: selection background is light-on-dark (rgba white)
- [ ] Filter tags still show accent background with white text
- [ ] Existing tests pass (`npm test`)
