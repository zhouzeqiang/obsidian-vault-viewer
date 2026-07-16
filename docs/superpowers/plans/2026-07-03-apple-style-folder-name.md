# Apple-Style Folder Name Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply macOS Finder-inspired typography to folder names in the directory tree, creating visual hierarchy through font-weight, letter-spacing, antialiased rendering, and color differentiation.

**Architecture:** Pure CSS change — add two new CSS rule blocks to `styles.css` that target folder rows and file rows separately using the existing `.vault-viewer-folder` class as a discriminator. No TypeScript changes.

**Tech Stack:** CSS, Obsidian CSS variables

---

### Task 1: Add Apple-style folder name typography rules

**Files:**
- Modify: `styles.css:843-846` (near existing `.vault-viewer-tree-row .vault-viewer-tree-name` rule)

- [ ] **Step 1: Add folder name typography rule**

Insert the following CSS block immediately after the existing `.vault-viewer-tree-row .vault-viewer-tree-name` rule (after line 846):

```css
/* Apple-style folder name typography */
.vault-viewer-folder .vault-viewer-tree-name {
  font-weight: 600;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
  color: var(--vv-text, var(--text-normal));
}

/* File name: lighter weight for visual contrast */
.vault-viewer-tree-row:not(.vault-viewer-folder) .vault-viewer-tree-name {
  font-weight: 400;
  color: var(--vv-text-muted, var(--text-muted));
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npm run build`
Expected: Build completes successfully with no errors

- [ ] **Step 3: Manual visual verification**

Run: `npm run dev`, then in Obsidian:
1. Open Vault Viewer panel
2. Verify folder names appear semi-bold (heavier than before)
3. Verify file names appear lighter/regular weight
4. Verify folder names have slightly more letter spacing than file names
5. Switch to Fresh theme in settings — verify both folder and file name styles still look correct
6. Toggle between Obsidian light/dark mode — verify colors adapt properly
7. Hover over a folder row — verify highlight still works
8. Hover over a file row — verify highlight still works
9. Right-click a folder — verify context menu still appears
10. Drag a file onto a folder — verify drag-and-drop still works

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Add Apple-style folder name typography"
```
