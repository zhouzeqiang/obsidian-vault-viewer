# Vault Viewer — Obsidian 插件

## 概要

一个 Obsidian 侧边栏面板插件，提供增强的文件浏览能力：目录树中显示 `.md` 文件，文件列表展示非 Markdown 文件（支持排序/搜索/过滤），并能在主编辑区渲染 Office 文档（.docx/.xlsx/.pptx），同时支持点击 `.md` 文件时显示其正向引用链接。

## 动机

Obsidian 内置文件浏览器只显示 `.md` 文件，仓库中的图片、PDF、Office 文档等不可见；没有目录级文件一览视图；无法从当前文件导航到它引用的其他文件。

## 功能列表

### F1: 目录树

- 与 Obsidian 文件结构一致的目录树
- 展开目录时，`<name>.md` 文件直接显示在树上
- 非 md 文件不显示在树上（显示在下方文件列表中）
- 点击目录 → 展开/收起
- 点击 `.md` 文件 → 打开到主编辑区 + 文件列表切换到引用模式
- 点击非 `.md` 文件 → 无操作（这些文件在文件列表中操作）

### F2: 文件列表

目录树下方的一个可变区域，有两种模式：

**模式 A — 目录文件列表（默认）**
- 点击任意目录 → 显示该目录下的**所有非 md 文件**
- 仅显示直接子文件（非递归）
- 未选中目录时 → 显示 vault 根目录下的非 md 文件

**模式 B — 引用文件列表**
- 点击树上 `.md` 文件 → 显示该文件的正向引用（`[[wikilinks]]` 和 `![[embeds]]`）
- 同时包含被引用的 md 文件和非 md 文件

**通用功能（两种模式均支持）**
- 🔍 按文件名搜索/过滤
- ▼ 排序：文件名、修改时间、文件类型、文件大小（升降序）
- ✕ 文件类型标签：点击切换是否显示该类型（临时过滤）
- 文件类型过滤默认值在设置中配置

### F3: Office 文档渲染

- 点击文件列表中的 `.docx` / `.xlsx` / `.pptx` → 在主编辑区以只读模式渲染内容
- `.docx` → 使用 mammoth.js 渲染为 HTML
- `.xlsx` → 使用 SheetJS (xlsx) 提取数据并渲染为表格
- `.pptx` → 使用 pptxjs 渲染为幻灯片浏览
- 渲染页面顶部显示「📎 打开外部编辑」按钮 → 调用系统默认应用编辑
- `.pdf` → 不处理，交给 Obsidian 原生 PDF 查看器

### F4: 设置面板

- 配置文件类型过滤默认值（隐藏/显示哪些扩展名）
- 配置默认排序方式
- 配置可识别的 Office 扩展名列表

## 交互流程

```
用户点击目录         → 树展开/收起 + 文件列表切换到模式 A
用户点击 .md 文件    → 文件打开 + 文件列表切换到模式 B
用户点击非 .md 文件  → 主编辑区渲染内容（Office）或原生打开（其他）
用户点击引用列表中   → 打开该文件 + 文件列表切换到模式 B（更新为新的引用）
  的文件
```

## 技术方案

### 插件结构

```
main.ts             插件入口，注册视图、设置、命令
views/
  VaultViewerView.ts ItemView 实现左侧面板
  OfficeView.ts      CustomView/ItemView 实现 Office 文件渲染
services/
  FileService.ts     文件读取、目录遍历、文件类型判断
  LinkService.ts     正向链接解析（metadataCache）
  OfficeRenderer.ts  调用各解析库渲染 Office 文件
settings.ts          设置界面 + 数据类型
utils/
  extensions.ts      文件扩展名工具函数（处理 .excalidraw.md 等）
```

### 依赖库

| 库 | 用途 | 预计大小 |
|---|---|---|
| mammoth.js | .docx → HTML | ~50KB (gzip) |
| xlsx (SheetJS) | .xlsx → table data | ~300KB (min) |
| pptxjs | .pptx → slides | ~100KB (gzip) |

### 关键 API

- `ItemView` — 自定义侧边栏面板
- `Workspace.getLeftLeaf()` — 在左侧边栏创建 leaf
- `vault.getFiles()` / `vault.getAbstractFileByPath()` — 文件遍历
- `metadataCache.getFileCache()` → `.links`, `.embeds` — 正向链接
- `metadataCache.getFirstLinkpathDest()` — 链接解析到真实文件
- `vault.on('create'|'delete'|'rename'|'modify')` — 实时更新文件列表
- `workspace.openLinkText()` — 打开文件
- `PluginSettingTab` — 设置面板
- `loadData()` / `saveData()` — 持久化配置

## 实现任务

1. 搭建插件骨架：main.ts、manifest.json、package.json
2. 实现目录树组件（F1）
3. 实现文件列表组件：模式 A + 搜索/排序/过滤（F2）
4. 实现模式 B：引用文件列表（F3 中点击 .md 相关）
5. 实现 Office 渲染视图：.docx（mammoth.js）
6. 实现 Office 渲染视图：.xlsx（SheetJS）
7. 实现 Office 渲染视图：.pptx（pptxjs）
8. 实现「打开外部编辑」按钮
9. 实现设置面板 + 配置持久化
10. 事件监听：文件变更实时刷新、编辑器切换同步引用
