# Vault Viewer - 增强型文件浏览器

Vault Viewer 是一个 Obsidian 插件，提供直观的文件浏览器界面，包含目录树、文件列表，并支持直接在 Obsidian 中预览 Office 文档（Word、Excel、PowerPoint）。最大的特点是文档和文件分离，这样可以更专注于文档的编写，同时查找相关的文件也更轻松。相关的文件放置到一个文件夹下，点击文件夹，在下面文件区域可以直接展示该文件夹下所有文件。点击md文件，可以显示该md文件中已经引用的文件。同时支持在文件夹树上直接新增、删除文件和文件夹，支持拖拽文件到其他文件下。

## 功能特性

### 📂 文件目录树

- 可展开/收缩的文件夹层级树，显示仓库名称作为根节点
- 支持拖拽移动文件和文件夹到目标目录
- 文件夹统计信息（Markdown 文件数 / 其他文件数）
- 一键展开/收缩全部节点
- 在树中定位当前活动笔记，自动展开并高亮
- 树工具栏：新建文件、新建文件夹、文件夹排序开关、展开/收缩全部
- 树右键菜单：打开所在文件夹、复制路径、新建文件/文件夹（仅文件夹）、删除

### 📋 文件列表

- **目录模式**：显示当前目录下的所有非 Markdown 文件，以表格形式展示（文件名 + 修改时间）
- **引用模式**：点击 Markdown 文件后切换，显示该笔记的所有正向链接和嵌入文件，嵌入链接显示"嵌入"徽标，并提供"在树中定位"按钮
- **排序**：按名称、修改时间、创建时间、文件大小排序，支持升序/降序切换
- **搜索**：按文件名实时过滤
- **扩展名过滤**：点击标签切换文件类型的显示/隐藏
- **列宽调整**：拖拽表头边框调整列宽
- 文件右键菜单：打开所在文件夹、复制路径、复制文件名、在外部打开

### 📄 Office 文档预览

支持无需外部应用即可预览以下格式：

- **DOCX** — 使用 `docx-preview` 库渲染格式化文本
- **XLSX** — 以 HTML 表格形式展示（含样式、字体、背景色、合并单元格），支持多 Sheet 切换，每表最多 1000 行，列宽可拖拽调整
- **PPTX** — 使用 `pptxviewjs` 库在 Canvas 上渲染幻灯片，支持上/下页导航和键盘左右箭头操作，自适应容器大小
- **SQL** — 代码高亮显示

预览界面提供"返回"和"在外部打开"按钮，可调用系统默认应用打开文档。解析失败时会显示错误提示并提供外部编辑器打开选项。

### 🎨 主题系统

- **Default** — 适配 Obsidian 深色/浅色主题
- **Fresh** — 清新绿色主题

### 🌐 国际化

- 简体中文
- 繁體中文
- English

### 📐 可调整面板

- 拖拽树与文件列表之间的分隔条调整面板比例
- 面板比例自动保存到设置，重启后恢复

### ⚙️ 详细设置

- 主题切换（Default / Fresh）
- 界面语言切换（简体中文 / 繁體中文 / English）
- 默认排序字段（名称 / 修改时间 / 创建时间 / 大小）
- 排序顺序（升序 / 降序）
- 隐藏文件扩展名（每行一个扩展名）
- 树形文件类型（显示在树中的扩展名，默认 .md、.canvas、.excalidraw.md）
- 文件夹排序开关

## 安装方法

### 通过社区插件（待上架）

1. 打开设置 → 社区插件
2. 搜索 "Vault Viewer"
3. 安装并启用

### 手动安装 / BRAT

1. 从最新 Release 下载 `main.js`、`styles.css`、`manifest.json`
2. 放入 `<仓库>/.obsidian/plugins/vault-viewer/`
3. 重启 Obsidian，在社区插件设置中启用

## 使用说明

插件启动后会在左侧边栏自动打开 Vault Viewer 面板。

### 文件树操作

- **点击文件夹** — 展开/收缩子目录，下方文件列表切换到该目录
- **点击 Markdown 文件** — 在 Obsidian 中打开，文件列表切换到引用模式
- **点击树中的其他文件** — 在 Obsidian 中打开
- **拖拽** — 将文件或文件夹拖到目标文件夹上移动
- **右键文件夹** — 打开所在文件夹、复制路径、新建文件/文件夹、删除
- **右键文件** — 打开所在文件夹、复制路径、删除
- **工具栏** — 新建文件、新建文件夹、文件夹排序开关、展开/收缩全部

### 文件列表操作

- **目录模式** — 点击文件夹后显示该目录下的非 Markdown 文件
- **引用模式** — 点击 Markdown 文件后显示其所有正向链接和嵌入文件
- **搜索图标** — 显示/隐藏搜索框，按文件名实时过滤
- **排序图标** — 选择排序字段和顺序
- **升降序按钮** — 切换升序/降序
- **眼睛图标** — 显示/隐藏文件树面板
- **扩展名标签** — 点击切换该类型文件的可见性
- **列宽调整** — 拖拽表头边框调整列宽
- **右键文件** — 打开所在文件夹、复制路径、复制文件名、在外部打开

### Office 预览面板

- 点击文件列表中的 Office 文件自动打开预览
- **DOCX** — 渲染格式化文本内容
- **XLSX** — 表格展示，底部 Sheet 标签切换，列宽可拖拽调整
- **PPTX** — Canvas 渲染幻灯片，支持翻页导航和键盘左右箭头操作
- **SQL** — 语法高亮代码视图
- 操作栏包含"返回"和"在外部打开"按钮
- 解析失败时会显示错误提示并提供外部编辑器打开选项

### 设置项

进入 设置 → Vault Viewer：

- **主题** — 选择 Default 或 Fresh
- **语言** — 简体中文 / 繁體中文 / English
- **默认排序字段** — 名称、修改时间、创建时间、大小
- **排序顺序** — 升序、降序
- **隐藏文件类型** — 每行一个扩展名，默认隐藏的文件类型
- **树形文件类型** — 显示在目录树中的扩展名（默认 .md、.canvas、.excalidraw.md）
- **文件夹排序** — 是否按字母顺序排序文件夹

## 命令

- **Open Vault Viewer** — 打开 Vault Viewer 面板

## 兼容性

- **仅限桌面端**（依赖 Electron shell 进行外部文件操作）
- 需要 Obsidian v1.5.0 以上
- 支持 `.docx`、`.xlsx`、`.pptx`、`.sql` 格式预览，无需外部服务

## 开发

```bash
npm install
npm run dev    # 开发模式（监听变化）
npm run build  # 生产构建
npm test       # 运行测试
```

## 许可

MIT

------

# Vault Viewer

Vault Viewer is an Obsidian plugin that provides an intuitive file browser interface with a directory tree, file list, and built-in Office document preview (Word, Excel, PowerPoint). Its key feature is the separation of documents and files — so you can focus on writing while easily finding related files. Place related files in a folder, click the folder, and the file area below displays all files in that folder. Click an md file to show the files referenced in that note. You can also create, delete files and folders directly in the folder tree, and drag files to other folders.

## Features

### 📂 File Directory Tree

- Expandable/collapsible folder hierarchy with vault name as root node
- Drag-and-drop to move files and folders to target directories
- Folder statistics (Markdown file count / other file count)
- One-click expand/collapse all nodes
- Locate the active note in the tree with auto-expand and highlight
- Tree toolbar: new file, new folder, folder sort toggle, expand/collapse all
- Tree context menu: reveal in folder, copy path, new file/folder (folders only), delete

### 📋 File List

- **Directory mode**: Displays all non-Markdown files in the current directory in a table (filename + modified time)
- **Reference mode**: Switches when clicking a Markdown file, showing all forward links and embedded files of that note; embedded links display an "Embed" badge and a "Locate in tree" button
- **Sorting**: Sort by name, modified time, created time, or file size; toggle ascending/descending
- **Search**: Real-time filtering by filename
- **Extension filter**: Click tags to toggle visibility of file types
- **Column resize**: Drag column header borders to adjust width
- File context menu: reveal in folder, copy path, copy filename, open externally

### 📄 Office Document Preview

Preview the following formats without external applications:

- **DOCX** — Renders formatted text using the `docx-preview` library
- **XLSX** — Displays as HTML table (with styles, fonts, background colors, merged cells), supports multi-sheet switching, up to 1000 rows per sheet, resizable column widths
- **PPTX** — Renders slides on Canvas using the `pptxviewjs` library, supports prev/next navigation and keyboard arrow keys, auto-fits container size
- **SQL** — Syntax-highlighted code display

The preview provides "Back" and "Open externally" buttons to open documents with the system default application. On parse failure, an error message is shown with an option to open in an external editor.

### 🎨 Theme System

- **Default** — Adapts to Obsidian dark/light theme
- **Fresh** — Fresh green theme

### 🌐 Internationalization

- Simplified Chinese
- Traditional Chinese
- English

### 📐 Resizable Panels

- Drag the divider between tree and file list to adjust panel ratio
- Panel ratio is automatically saved to settings and restored on restart

### ⚙️ Detailed Settings

- Theme switch (Default / Fresh)
- Language switch (Simplified Chinese / Traditional Chinese / English)
- Default sort field (Name / Modified time / Created time / Size)
- Sort order (Ascending / Descending)
- Hidden file extensions (one per line)
- Tree file types (extensions shown in the tree, default: .md, .canvas, .excalidraw.md)
- Folder sort toggle

## Installation

### Via Community Plugins (pending listing)

1. Open Settings → Community plugins
2. Search for "Vault Viewer"
3. Install and enable

### Manual Install / BRAT

1. Download `main.js`, `styles.css`, `manifest.json` from the latest Release
2. Place them in `<vault>/.obsidian/plugins/vault-viewer/`
3. Restart Obsidian and enable in Community plugins settings

## Usage

The Vault Viewer panel opens automatically in the left sidebar on startup.

### File Tree Operations

- **Click a folder** — Expand/collapse subdirectories; file list below switches to that directory
- **Click a Markdown file** — Opens in Obsidian; file list switches to reference mode
- **Click other files in the tree** — Opens in Obsidian
- **Drag** — Move a file or folder to a target folder
- **Right-click a folder** — Reveal in folder, copy path, new file/folder, delete
- **Right-click a file** — Reveal in folder, copy path, delete
- **Toolbar** — New file, new folder, folder sort toggle, expand/collapse all

### File List Operations

- **Directory mode** — Shows non-Markdown files in the current directory after clicking a folder
- **Reference mode** — Shows all forward links and embedded files after clicking a Markdown file
- **Search icon** — Show/hide search box; real-time filtering by filename
- **Sort icon** — Select sort field and order
- **Ascending/Descending button** — Toggle sort direction
- **Eye icon** — Show/hide the file tree panel
- **Extension tags** — Click to toggle visibility of that file type
- **Column resize** — Drag column header borders to adjust width
- **Right-click a file** — Reveal in folder, copy path, copy filename, open externally

### Office Preview Panel

- Click an Office file in the file list to open the preview automatically
- **DOCX** — Renders formatted text content
- **XLSX** — Table display with sheet tabs at the bottom; resizable column widths
- **PPTX** — Canvas-rendered slides with prev/next navigation and keyboard arrow keys
- **SQL** — Syntax-highlighted code view
- Action bar includes "Back" and "Open externally" buttons
- On parse failure, an error message is shown with an option to open in an external editor

### Settings

Go to Settings → Vault Viewer:

- **Theme** — Choose Default or Fresh
- **Language** — Simplified Chinese / Traditional Chinese / English
- **Default sort field** — Name, Modified time, Created time, Size
- **Sort order** — Ascending, Descending
- **Hidden file types** — One extension per line; file types hidden by default
- **Tree file types** — Extensions shown in the directory tree (default: .md, .canvas, .excalidraw.md)
- **Folder sort** — Whether to sort folders alphabetically

## Commands

- **Open Vault Viewer** — Open the Vault Viewer panel

## Compatibility

- **Desktop only** (depends on Electron shell for external file operations)
- Requires Obsidian v1.5.0 or above
- Supports `.docx`, `.xlsx`, `.pptx`, `.sql` format preview without external services

## Development

```bash
npm install
npm run dev    # Development mode (watch for changes)
npm run build  # Production build
npm test       # Run tests
```

## License

MIT
