# Vault Viewer — 设计文档

> 基于 proposal.md 的详细设计，记录了所有设计决策

## 1. 架构总览

```
┌────────────────────────────────────────────────────────────────┐
│                    VAULT VIEWER                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Plugin Entry (main.ts)                                        │
│  ├─ manifest.json (id: vault-viewer)                           │
│  ├─ esbuild 构建                                                │
│  ├─ registerView → VaultViewerView (左侧边栏)                   │
│  ├─ registerView → OfficeView (主编辑区)                       │
│  └─ addSettingTab → VaultViewerSettingTab                      │
│                                                                │
│  ┌─ 左侧面板 (VaultViewerView) ─────────────────────────────┐  │
│  │  ├─ TreeView (目录树)                                     │  │
│  │  ├─ Toolbar (搜索/排序/过滤标签)                           │  │
│  │  └─ FileList (文件列表 / 引用列表)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ 主编辑区 (OfficeView) ────────────────────────────────────┐  │
│  │  只读渲染 .docx / .xlsx / .pptx                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ 服务层 ────────────────────────────────────────────────────┐  │
│  │  FileService     文件遍历/过滤/vault 事件监听                │  │
│  │  LinkService     正向链接解析 (metadataCache)               │  │
│  │  OfficeRenderer  调用 mammoth/SheetJS/pptxjs 渲染           │  │
│  │  SettingsService 配置读写/持久化                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 构建工具

- **esbuild**: Obsidian 官方示例插件推荐，配置轻量
- 三个 Office 解析库通过 npm 安装，esbuild 自动 tree-shaking

### 依赖

| 库 | 用途 | 预估大小 |
|---|---|---|
| mammoth.js | .docx → HTML | ~50KB (gzip) |
| xlsx (SheetJS) | .xlsx → HTML table | ~300KB (min) |
| pptxjs | .pptx → slide HTML | ~100KB (gzip) |

总包体积预估: ~450KB (未压缩) / ~150KB (gzip)，对 Obsidian 插件属于正常范围。

---

## 2. 组件设计

### 2.1 TreeView — 目录树

**行为:**
- 初始全部折叠，仅显示 vault 根目录
- 展开目录时，只显示以下类型的文件：
  - `.md` 文件
  - `.canvas` 文件
  - `.excalidraw.md` 文件
- 点击目录 → 展开/收起该目录
- 点击 `.md` 文件 → 切换文件列表到模式 B，并在编辑器中打开
- 点击非 md 文件 → 无操作（这些在文件列表区域操作）
- 支持外部「定位」请求：展开到指定文件所在目录并高亮该文件

**白名单:**
```
treeExtensions = ['.md', '.canvas', '.excalidraw.md']
```
可在设置中扩展此列表。

### 2.2 Toolbar — 工具栏

**搜索:**
- 实时按文件名过滤（不区分大小写）
- 两种模式下均可用

**排序:**
- 排序字段: 文件名 / 修改时间 / 创建时间 / 文件大小
- 升降序切换
- 默认值可在设置中配置
- 两种模式下均可用

**类型过滤标签:**
- 动态生成：扫描当前文件列表中的所有扩展名
- 每个扩展名生成一个可点击标签
- 点击切换隐藏/显示该类型
- 显示为 `[.pdf] [.png] [.docx] [✕ .xlsx]`（隐藏的带 ✕）
- 过滤状态持久化到 `data.json`（关闭 Obsidian 仍保留）

**模式指示器:**
- 显示当前模式: 「目录: 项目/」或「引用: 周报.md」

### 2.3 FileList — 文件列表

**模式 A — 目录文件列表:**
- 显示当前选中目录下的**所有非 md 文件**（仅直接子文件，非递归）
- 未选中目录时 → 显示 vault 根目录下的非 md 文件
- 每个条目显示: 文件图标 + 名称 + 修改时间 + 大小
- 点击非 md 文件:
  - `.docx` / `.xlsx` / `.pptx` → 打开 OfficeView 标签
  - `.pdf` → 交给 Obsidian 原生 PDF 查看器
  - 其他 → 系统默认方式打开（`openLinkText`）

**模式 B — 引用文件列表:**
- 显示当前 .md 文件的正向链接（`[[wikilinks]]` + `![[embeds]]`）
- 包含被引用的 md 文件和非 md 文件
- 每个条目显示: 文件图标 + 文件名 + 链接类型标识 + 📍 定位按钮
- 点击条目的行为:
  - 被引用文件是 `.md` → 打开 + 文件列表更新为该文件的引用
  - 被引用文件是 Office 文档 → 打开 OfficeView，文件列表保持当前引用不变
  - 被引用文件是其他类型 → 原生打开，文件列表保持当前引用不变
- 点击 📍 → 在树中定位并高亮该文件（展开目标目录）

**模式切换规则:**
| 触发操作 | 新模式 |
|---------|--------|
| 点击目录 | 模式 A |
| 点击 .md 文件（树上） | 模式 B |
| 点击引用列表中的 `.md` 文件 | 模式 B (更新为该文件的引用) |
| 点击引用列表中的非 `.md` 文件 | 保持当前引用不变 |
| 切换编辑器标签页 | 模式 B (追踪新标签) |
| 过滤/排序 | 保持当前模式 |

**空状态:**
- 目录无非 md 文件 → "此目录下无其他类型文件"
- .md 无引用 → "此文件没有引用其他文件"

### 2.4 OfficeView — Office 渲染视图

**实现方式:**
- 独立的 `View` 类型，在编辑器新标签页中打开
- 支持同时打开多个 Office 文件（多个标签页）

**渲染流程:**
```
用户点击 .docx
    ↓
创建新标签 → 显示 "正在解析文档..." (加载状态)
    ↓
调用对应解析库 (.docx → mammoth, .xlsx → SheetJS, .pptx → pptxjs)
    ↓
┌─ 成功: 渲染为 HTML 展示
│       顶部操作栏: [← 返回] [📎 外部打开] [文件名]
│
└─ 失败: 显示错误提示 + [📎 在外部打开] 按钮
        错误提示: "无法解析此文件，可能格式不兼容"
```

**「📎 外部打开」行为:**
- 调用 `shell.openPath()`（Electron API）或 `opn` 库
- 使用系统默认关联应用打开原始文件

---

## 3. 数据模型

```typescript
interface VaultViewerSettings {
  sortBy: 'name' | 'mtime' | 'ctime' | 'size';
  sortOrder: 'asc' | 'desc';
  hiddenExtensions: string[];
  treeExtensions: string[];
}

const DEFAULT_SETTINGS: VaultViewerSettings = {
  sortBy: 'name',
  sortOrder: 'asc',
  hiddenExtensions: [],
  treeExtensions: ['.md', '.canvas', '.excalidraw.md'],
};

interface FileEntry {
  file: TFile;
  extension: string;
  stat: { size: number; mtime: number; ctime: number };
}

interface LinkEntry {
  file: TFile;
  linkType: 'link' | 'embed';
  displayText?: string;
  resolved: boolean;
}
```

---

## 4. 状态管理

### 何时更新

| 事件 | 触发更新 |
|------|---------|
| vault.on('create') | 树 + 文件列表 |
| vault.on('delete') | 树 + 文件列表 |
| vault.on('rename') | 树 + 文件列表 |
| vault.on('modify', .md) | 仅模式 B 引用列表 |
| metadataCache.on('changed') | 仅模式 B 引用列表 |
| workspace.on('active-leaf-change') | 模式 B 追踪活动文件 |

**性能处理:**
- `on('create')` 首次加载时大量触发 → 在 `onLayoutReady` 中注册事件监听
- 批量事件加入防抖队列（300ms），统一刷新 UI

### 初始加载流程

```
1. onLayoutReady()
2.   → FileService.scanAll()          // 建立完整文件索引
3.   → TreeView.render(vaultRoot)     // 渲染树 (全部折叠)
4.   → FileList.renderModeA(vaultRoot)// 显示根目录非 md 文件
5.   → 如果编辑器中有活动 .md 文件    // 追踪当前文件
6.       → FileList.renderModeB(activeFile)
```

---

## 5. 文件归类规则

```
树上显示:
  ├── .md (普通 Markdown)
  ├── .canvas (Obsidian Canvas)
  └── .excalidraw.md (Excalidraw 绘图)
      (通过 treeExtensions 白名单控制)

文件列表显示:
  ├── 所有不在 treeExtensions 中的文件
  ├── .pdf → 点击后 Obsidian 原生查看
  ├── .docx / .xlsx / .pptx → 点击后 OfficeView 渲染
  └── 其他 → 点击后系统默认打开
```

---

## 6. 设置面板

```
┌─ 设置: Vault Viewer ──────────────────────────────┐
│                                                     │
│  默认排序方式:  [ 名称 ▼ ]  [⬆ 升序 / ⬇ 降序]      │
│                                                     │
│  树显示扩展名:                                       │
│    [.md] ✓  [.canvas] ✓  [.excalidraw.md] ✓        │
│    [+ 添加扩展名]                                    │
│                                                     │
│  默认隐藏文件类型:                                    │
│    [.exe] [.zip] ...                                │
│    [+ 添加扩展名]                                    │
│                                                     │
│  [重置为默认值]                                       │
└─────────────────────────────────────────────────────┘
```

---

## 7. 实现任务

1. 搭建项目骨架 (main.ts / manifest.json / tsconfig / esbuild)
2. 实现 SettingsService + 设置面板
3. 实现 FileService (文件遍历 + vault 事件监听)
4. 实现 TreeView (目录树 + md 文件显示)
5. 实现 Toolbar (搜索 + 排序 + 动态过滤标签)
6. 实现 FileList 模式 A (目录非 md 文件列表)
7. 实现 LinkService (正向链接解析)
8. 实现 FileList 模式 B (引用文件列表 + 定位功能)
9. 实现 OfficeView + OfficeRenderer (.docx)
10. 实现 OfficeRenderer (.xlsx)
11. 实现 OfficeRenderer (.pptx)
12. 实现「外部打开」功能
13. 集成测试：文件变更实时刷新、编辑器同步
14. 打包和发布配置
