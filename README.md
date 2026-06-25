# Vault Viewer - 增强型文件浏览器

Vault Viewer 是一个 Obsidian 插件，提供直观的文件浏览器界面，包含目录树、文件列表，并支持直接在 Obsidian 中预览 Office 文档（Word、Excel、PowerPoint）。

## 功能特性

### 📂 文件目录树

- 可展开/收缩的文件夹层级树
- 支持拖拽移动文件和文件夹
- 右键菜单：复制路径、打开所在文件夹、删除
- 一键展开/收缩全部节点
- 在树中定位当前活动笔记
- 文件夹统计信息（Markdown 文件数 / 其他文件数）

### 📋 文件列表

- 显示当前目录下的所有非 Markdown 文件
- **排序**：按名称、修改时间、创建时间、文件大小排序
- **搜索**：按文件名过滤
- **扩展名过滤**：点击标签切换文件类型的显示/隐藏
- 支持 Office 文件预览和图片/其他文件的打开

### 📄 Office 文档预览

支持无需外部应用即可预览以下格式：

- **DOCX** — 使用 `docx-preview` 库渲染格式化文本
- **XLSX** — 以 HTML 表格形式展示（含样式、字体、背景色），每表最多 1000 行
- **PPTX** — 渲染每张幻灯片中的文本内容（含位置、字号、颜色、粗斜体等格式）
- **SQL** — 代码高亮显示

预览界面提供"在外部打开"按钮，可调用系统默认应用打开文档。

### 🔗 引用模式

点击任意 Markdown 文件，文件列表将切换至"引用模式"，显示该笔记的所有正向链接和嵌入文件。点击引用可跳转，嵌入链接会显示"嵌入"徽标。

### 🎨 主题系统

- **Default** — 适配 Obsidian 深色/浅色主题
- **Fresh** — 清新绿色主题

### 🌐 国际化

- 简体中文
- 繁體中文
- English

### ⚙️ 详细设置

- 主题切换
- 界面语言切换
- 默认排序字段
- 隐藏文件扩展名
- 树形文件类型（显示在树中的扩展名）
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

- **点击文件夹** — 展开/收缩子目录
- **点击文件** — 打开文件（Markdown 切换到引用模式，Office 文件打开预览）
- **拖拽** — 将文件或文件夹拖到目标文件夹上移动
- **右键** — 打开上下文菜单

### 文件列表工具栏

- **搜索图标** — 显示/隐藏搜索框，按文件名实时过滤
- **排序图标** — 选择排序字段和顺序
- **眼睛图标** — 显示/隐藏文件树面板
- **扩展名标签** — 点击切换该类型文件的可见性

### Office 预览面板

- 自动解析文档内容
- 操作栏包含"返回"和"在外部打开"按钮
- 解析失败时会显示错误提示并提供外部编辑器打开选项

### 设置项

进入 设置 → Vault Viewer：

- **主题** — 选择 Default 或 Fresh
- **语言** — 简体中文 / 繁體中文 / English
- **默认排序字段** — 名称、修改时间、创建时间、大小
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

An Obsidian plugin that provides an intuitive file browser with a folder tree, file list, and inline preview for Office documents (Word, Excel, PowerPoint) directly inside Obsidian.

## Features

- **File Tree** — Browse your vault with an expandable folder/file tree; supports drag-and-drop to move items
- **File List** — View files in the current directory with sorting (name, date modified, date created, size) and search
- **Office Preview** — Render `.docx`, `.xlsx`, `.pptx`, and `.sql` files as readable HTML within Obsidian
- **Reference Mode** — Click a Markdown file to see all its forward links and embeds; click a reference to navigate
- **Locate in Tree** — Automatically highlights the active note's location in the folder tree
- **Filter by Extension** — Toggle file extension visibility with clickable filter tags
- **Right-click Context Menu** — Copy path, copy name, open containing folder, open externally
- **Tree Context Menu** — Copy path, open containing folder, delete files/folders (with confirmation)
- **Create Files/Folders** — New Markdown files and folders from the tree toolbar
- **Collapse/Expand All** — One-click expand/collapse of the entire tree
- **Themes** — Default dark/light compatible theme and a "Fresh" green-toned theme
- **Internationalization** — English, Simplified Chinese, Traditional Chinese
- **Resizable Panel** — Drag the divider between tree and file list to resize

## Installation

### From Obsidian Community Plugins (future)

1. Open Settings → Community Plugins
2. Search for "Vault Viewer"
3. Install and enable

### Manual / BRAT

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest release
2. Place them in `<vault>/.obsidian/plugins/vault-viewer/`
3. Reload Obsidian and enable the plugin in Community Plugins settings

## Usage

The plugin automatically opens the Vault Viewer panel on the left sidebar when Obsidian starts.

### File Tree

- Click a folder to expand/collapse it
- Click a file to open it
- Drag files and folders to move them between directories
- Right-click for the context menu (copy path, open in folder, delete)

### File List (lower panel)

Shows all non-Markdown files in the currently selected directory. Use the toolbar to:

- **Search** — Filter files by name
- **Sort** — Sort by name, modified time, created time, or size; toggle ascending/descending
- **Tree Toggle** — Eye icon shows/hides the tree panel
- **Filter Tags** — Click a file extension tag to hide/show that type

### Office Preview

Double-click any `.docx`, `.xlsx`, `.pptx`, or `.sql` file to open it in a dedicated preview pane with formatted content:

- **DOCX** — Rendered via `docx-preview` library
- **XLSX** — Tables rendered with sheet names and cell formatting (up to 1000 rows per sheet)
- **PPTX** — Slides with positioned text and formatting
- **SQL** — Syntax-highlighted code view

Use the "Open externally" button to open the file in its native application.

### Reference Mode

Click any Markdown file in the tree to switch the file list to "references" mode, showing all files linked or embedded from that note. Click a reference to navigate. The badge indicates embed links.

### Settings

Access via Settings → Vault Viewer:

- **Theme** — Default or Fresh
- **Language** — 简体中文, 繁體中文, English
- **Default Sort** — Name, modified time, created time, size
- **Hidden Extensions** — File types to hide by default
- **Tree Extensions** — File types shown in the tree (default: `.md`, `.canvas`, `.excalidraw.md`)
- **Sort Folders** — Toggle alphabetical folder sorting in the tree

## Commands

- **Open Vault Viewer** — Opens the Vault Viewer panel

## Compatibility

- **Desktop only** (relies on Electron shell for external file operations)
- Requires Obsidian v1.5.0+
- Supports `.docx`, `.xlsx`, `.pptx`, and `.sql` preview (no external services needed)

## Development

```
npm install
npm run dev    # watch mode
npm run build  # production build
npm test       # run tests
```

## License

MIT
