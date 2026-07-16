# PPTX Scrollable Viewer with Thumbnail Sidebar

## Problem

Current PPTX preview uses a single-canvas page-flip model (prev/next buttons, keyboard arrows). Users want a scrollable view where all slides are visible vertically, with a thumbnail sidebar for quick navigation.

## Design

### Layout

```
┌─────────────────────────────────────────────────┐
│  ← 返回  📎 在外部打开  [≡]                      │  操作栏 + 折叠按钮
├────────────────────────────────┬────────────────┤
│                                │  [缩略图1]     │
│                                │  [缩略图2]     │
│   主幻灯片滚动区域              │  [缩略图3] ←高亮│
│   （上下滑动浏览所有幻灯片）      │  [缩略图4]     │
│                                │  [缩略图5]     │
│                                │  ...           │
├────────────────────────────────┴────────────────┤
│  3 / 10                                         │  底部状态栏
└─────────────────────────────────────────────────┘
```

### Components

1. **Main scroll area** (`.pptx-scroll-area`): Flex-grow container, vertically scrollable. Each slide rendered to its own canvas, stacked vertically with spacing.

2. **Thumbnail sidebar** (`.pptx-thumbnails`): Fixed 120px width on the right. Contains small canvas thumbnails for each slide. Clickable to scroll main area to that slide. Collapsible via toggle button.

3. **Status bar** (`.pptx-status-bar`): Bottom bar showing "N / Total". Updated via IntersectionObserver detecting which slide is most visible.

4. **Toggle button**: In the action bar, toggles thumbnail sidebar visibility.

### Rendering Strategy

- **Main slides**: Each slide gets its own `<canvas>`. Rendered lazily via IntersectionObserver — only render when the canvas enters the viewport.
- **Thumbnails**: Each thumbnail is a small `<canvas>` (width ~100px, height proportional). Rendered lazily via IntersectionObserver on the thumbnail sidebar scroll.
- **Resize**: On container resize, re-render only visible slides (tracked by IntersectionObserver).

### Interaction

- **Scroll**: Main area scrolls vertically through all slides.
- **Thumbnail click**: Scrolls main area to the corresponding slide using `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- **Thumbnail highlight**: IntersectionObserver on main area detects which slide is most visible; corresponding thumbnail gets `.active` class.
- **Sidebar toggle**: Button in action bar toggles `.pptx-thumbnails` visibility. State persisted in the container's dataset.
- **Keyboard**: Up/Down arrows scroll main area by one slide. Home/End jump to first/last.

### CSS Changes

Remove:
- `.pptx-nav` (already `display:none`, fully remove)
- `.pptx-nav-label`
- `.pptx-bottom-bar` / `.pptx-sheet-tabs` / `.pptx-sheet-tab` (these were XLSX-style tabs, not used for PPTX)

Add:
- `.pptx-body`: Flex row container for scroll area + thumbnails
- `.pptx-scroll-area`: Flex-grow, overflow-y auto, padding
- `.pptx-slide-item`: Each slide wrapper with canvas + slide number label
- `.pptx-slide-canvas`: Individual slide canvas styling
- `.pptx-thumbnails`: Fixed-width sidebar, overflow-y auto, collapsible
- `.pptx-thumbnails.collapsed`: `width: 0; overflow: hidden; padding: 0;`
- `.pptx-thumb-item`: Thumbnail wrapper, clickable, with active state
- `.pptx-thumb-canvas`: Small canvas for thumbnail
- `.pptx-thumb-label`: Slide number under thumbnail
- `.pptx-status-bar`: Bottom status bar
- `.pptx-toggle-btn`: Sidebar toggle button

### Code Changes

**`OfficeRenderer.ts` — `renderPptx` method (lines 357-413)**:
- Remove: prevBtn, nextBtn, slideLabel, single canvas, keyboard left/right handlers
- Add: Create `.pptx-body` (flex row), `.pptx-scroll-area`, `.pptx-thumbnails`
- For each slide: create `.pptx-slide-item` with canvas in scroll area, create `.pptx-thumb-item` with small canvas in sidebar
- Use IntersectionObserver for lazy rendering of both main slides and thumbnails
- Use IntersectionObserver on main slides to track current slide and highlight thumbnail
- Add click handlers on thumbnails to scroll main area
- Add toggle button for sidebar collapse
- Add keyboard up/down/home/end handlers
- Add status bar showing current slide index

### Performance Considerations

- Lazy rendering: Only render slides/thumbnails when they enter the viewport
- Canvas reuse: On resize, only re-render visible canvases
- Thumbnail scale: Render thumbnails at low resolution (100px wide) to save memory
- Debounce resize: Debounce ResizeObserver callback to avoid excessive re-renders

### i18n

No new strings needed — the toggle button uses an icon (lucide:sidebar), and the status bar uses existing number formatting.
