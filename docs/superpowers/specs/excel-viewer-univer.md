# Excel 查看器升级设计规格：引入 Univer 替代手动 HTML Table 渲染

## 1. 背景与动机

### 当前问题

Vault Viewer 插件当前使用 JSZip 手动解析 .xlsx XML 并生成 HTML `<table>` 来展示 Excel 文件。该方案存在以下严重不足：

- **样式还原差**：合并单元格显示异常、边框渲染不准确、行高列宽偏差大、颜色/字体还原不准
- **交互功能缺失**：无行号列标、无冻结窗格、无缩放、Sheet 切换仅有 ◀▶ 按钮
- **性能限制**：硬编码最多 1000 行，HTML table 在大数据量时 DOM 节点过多
- **维护成本高**：约 500+ 行手动 XML 解析代码，难以覆盖 xlsx 规范的复杂样式

### 目标

用高保真的 Excel 查看体验替代当前简陋的 HTML table 渲染，样式还原接近 Office Excel / 腾讯在线文档水平，支持 Sheet 标签页、行号列标、冻结窗格、缩放等交互功能。

## 2. 方案选择

### 评估的方案

| 方案 | 样式还原 | 交互功能 | 性能 | 只读模式 | Bundle 大小 | 维护状态 |
|------|---------|---------|------|---------|------------|---------|
| **A: Univer** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ 原生支持 | ~500KB+ gzip | 非常活跃 |
| B: Luckysheet | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⚠️ 需 hack | ~800KB+ gzip | 已停更 |
| C: 改进现有方案 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ✅ 天然只读 | ~50KB | 自维护 |

### 选择：方案 A（Univer）

理由：
1. 样式还原度最高，直接解决核心痛点
2. 交互功能开箱即用（Sheet 标签、行号列标、冻结、缩放）
3. 活跃维护，有商业支持
4. 原生支持只读模式
5. 虚拟滚动，5000 行无压力
6. Bundle 大小作为 Obsidian 桌面插件可接受

## 3. 约束

- **纯前端离线运行**：不依赖外部服务或网络请求
- **只读模式**：不需要编辑功能
- **性能目标**：支持 500-5000 行中等表格，流畅滚动
- **Obsidian 插件兼容**：esbuild 打包、CJS 格式、不与 Obsidian CSS 冲突
- **降级策略**：Univer 导入失败时回退到当前 JSZip + HTML table 方案

## 4. 架构设计

### 4.1 渲染流程变更

**当前流程**：
```
xlsx 二进制 → JSZip 解析 XML → 手动提取样式/数据 → 生成 HTML <table>
```

**新流程**：
```
xlsx 二进制 → Univer ImportExport 插件 → Univer 数据模型 → Univer Sheet 渲染（Canvas）
```

### 4.2 UI 结构

```
┌─────────────────────────────────────────────┐
│  OfficeView.ts                              │
│  ┌───────────────────────────────────────┐  │
│  │ 操作栏（返回 / 外部打开）              │  │
│  ├───────────────────────────────────────┤  │
│  │ contentEl                             │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ Univer 容器 div                  │  │  │
│  │  │  - Univer Sheet 实例             │  │  │
│  │  │  - 只读模式                      │  │  │
│  │  │  - Sheet 标签页                  │  │  │
│  │  │  - 行号列标                      │  │  │
│  │  │  - 冻结窗格                      │  │  │
│  │  │  - 缩放控制                      │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 4.3 关键设计决策

1. **Univer 实例生命周期**：在 `OfficeView.onOpen()` 中创建，在 `OfficeView.onClose()` 中销毁（`univer.dispose()`），避免内存泄漏
2. **只读模式**：通过 Univer 权限配置禁用编辑
3. **样式隔离**：Univer 渲染在 Canvas 上，不与 Obsidian CSS 冲突；Univer UI 组件需确认 CSS scope 隔离方式
4. **动态导入**：`UniverXlsxRenderer` 使用动态 `import()` 加载，避免影响非 xlsx 文件的加载性能
5. **降级策略**：Univer 导入失败时回退到当前 JSZip + HTML table 方案

## 5. 代码改造细节

### 5.1 OfficeRenderer.ts 改造

**重构**（约 500+ 行 xlsx 代码）：
1. 将当前 `renderXlsx()` 方法重命名为 `renderXlsxFallback()`，保留全部现有逻辑作为降级方案
2. 新增 `renderXlsx()` 方法，优先使用 Univer 渲染，失败时降级：

```typescript
private _univerRenderer: UniverXlsxRenderer | null = null;

private async renderXlsx(
  buffer: ArrayBuffer,
  filename: string,
  container: HTMLElement
): Promise<string> {
  try {
    const { UniverXlsxRenderer } = await import("./UniverXlsxRenderer");
    const renderer = new UniverXlsxRenderer(container);
    this._univerRenderer = renderer;
    await renderer.render(buffer);
  } catch (err) {
    // 降级：回退到 JSZip + HTML table
    console.warn("Univer render failed, falling back to HTML table", err);
    this._univerRenderer = null;
    await this.renderXlsxFallback(buffer, filename, container);
  }
  return filename;
}

/** 降级方案：原有 JSZip + HTML table 渲染逻辑（从原 renderXlsx 重命名而来） */
private async renderXlsxFallback(
  buffer: ArrayBuffer,
  filename: string,
  container: HTMLElement
): Promise<string> {
  // ... 原有 renderXlsx 的全部实现 ...
}

disposeUniver(): void {
  if (this._univerRenderer) {
    this._univerRenderer.dispose();
    this._univerRenderer = null;
  }
}
```

### 5.2 新增文件：src/services/UniverXlsxRenderer.ts

> **重要**：以下代码为设计意图伪代码，具体 import 路径、类名、API 调用方式需在实施时根据 Univer 最新 npm 包和官方文档确认。Univer 版本迭代较快，包名和 API 可能有变化。

```typescript
// 注意：具体 import 路径需在实施时确认 Univer 最新版本的 API
import { Univer, UniverInstanceType } from "@univerjs/core";
import { defaultTheme } from "@univerjs/design";
import { UniverSheetsPlugin } from "@univerjs/sheets";
import { UniverSheetsImportExportPlugin } from "@univerjs/sheets-import-export";
import { UniverUIPlugin } from "@univerjs/ui";
import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverFormulaEnginePlugin } from "@univerjs/sheets-formula";

export class UniverXlsxRenderer {
  private univer: Univer | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(buffer: ArrayBuffer): Promise<void> {
    // 1. 创建 Univer 容器 div（使用标准 DOM API，不依赖 Obsidian 的 createDiv）
    const univerContainer = document.createElement("div");
    univerContainer.className = "univer-xlsx-container";
    univerContainer.style.width = "100%";
    univerContainer.style.height = "100%";
    this.container.appendChild(univerContainer);

    // 2. 初始化 Univer
    this.univer = new Univer({
      theme: defaultTheme,
      locale: "zh-CN",
    });

    // 3. 注册插件
    this.univer.registerPlugin(UniverRenderEnginePlugin);
    this.univer.registerPlugin(UniverUIPlugin, {
      container: univerContainer,
    });
    this.univer.registerPlugin(UniverSheetsPlugin);
    this.univer.registerPlugin(UniverSheetsImportExportPlugin);
    this.univer.registerPlugin(UniverFormulaEnginePlugin);

    // 4. 导入 xlsx 数据
    // 注意：具体 API 需在实施时确认，以下为设计意图
    const importPlugin = this.univer.__getInjector().get(
      UniverSheetsImportExportPlugin
    );
    const workbookData = await importPlugin.importXlsx(buffer);

    // 5. 创建工作簿（只读模式）
    // 注意：只读模式的具体配置方式需在实施时验证
    // 可能的方案：通过 workbookData 的 sheetPrivacy 配置、
    // 或通过 Univer 权限插件、或通过 CSS 禁用交互
    this.univer.createUnit(UniverInstanceType.UNIVER_SHEET, workbookData);
  }

  dispose(): void {
    this.univer?.dispose();
    this.univer = null;
    // 清理容器 DOM
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
```

### 5.3 OfficeView.ts 改造

- `onOpen()` 中：xlsx 渲染后保存 `UniverXlsxRenderer` 实例引用（通过 `OfficeRenderer._univerRenderer` 暴露）
- `onClose()` 中：调用 `this.renderer.disposeUniver()` 释放 Univer 实例

> **注意**：当前 `OfficeView` 没有 `onClose()` 方法，需新增。同时需确认 Obsidian ItemView 的 `onClose()` 生命周期钩子是否可用（Obsidian API 支持）。

```typescript
async onClose() {
  this.renderer.disposeUniver();
}
```

### 5.4 styles.css 改造

**删除**：
- 所有 `.xlsx-*` 相关样式
- 所有 `.office-table*` 相关样式

**新增**：
```css
.univer-xlsx-container {
  width: 100%;
  height: calc(100% - var(--office-action-bar-height, 40px));
  overflow: hidden;
}
```

### 5.5 esbuild.config.mjs

- 无需额外插件配置，Univer 包会被 esbuild 正常打包
- **CSS 处理**：Univer 的 UI 组件依赖 CSS 样式。需在实施时确认：
  - Univer 是否将 CSS 内联到 JS 中（部分库的做法）
  - 还是需要额外配置 esbuild 的 CSS loader 来处理 Univer 的样式文件
  - 如果 Univer CSS 是独立文件，可能需要 `esbuild-plugin-inline-css` 或在 `onEnd` 钩子中手动注入
  - 备选方案：在 `UniverXlsxRenderer.render()` 中通过 `document.createElement('style')` 动态注入 Univer CSS

### 5.6 package.json 依赖变更

```diff
dependencies:
   jszip: ^3.10.1          # 保留（降级方案 + Univer 内部可能使用）
+  @univerjs/core: ^0.6.x  # 版本号需在实施时确认 npm 最新版本
+  @univerjs/design: ^0.6.x
+  @univerjs/sheets: ^0.6.x
+  @univerjs/sheets-import-export: ^0.6.x
+  @univerjs/ui: ^0.6.x
+  @univerjs/engine-render: ^0.6.x
+  @univerjs/sheets-formula: ^0.6.x
```

> **重要**：上述包名和版本号为设计时预估。Univer 采用模块化架构且版本迭代较快，实施时必须：
> 1. 查阅 Univer 官方文档确认最新版本和必要子包列表
> 2. 确认 `@univerjs/sheets-import-export` 是否为独立包还是包含在其他包中
> 3. 确认是否需要额外的样式包（如 `@univerjs/sheets-ui` 等）
> 4. 在本地 `npm install` 后验证打包是否正常

## 6. 功能映射

| 需求 | Univer 实现 | 备注 |
|------|------------|------|
| Sheet 标签页切换 | 内置 Sheet 标签栏 | 默认启用 |
| 行号列标 | 内置行头列头 | 默认启用 |
| 冻结窗格 | 内置冻结功能 | xlsx 中的冻结设置会被导入 |
| 缩放 | 内置缩放控制 | 状态栏缩放滑块 |
| 合并单元格 | ImportExport 自动解析 | 样式还原度高 |
| 边框/颜色/字体 | ImportExport 自动解析 | 样式还原度高 |
| 行高列宽 | ImportExport 自动解析 | 精确还原 |
| 数字格式 | ImportExport + formula 插件 | 日期/货币等格式 |
| 只读模式 | 禁用编辑权限 | 不可修改单元格内容 |

## 7. 范围外

以下功能明确不在本次改造范围内：

- 公式计算（只显示公式结果，不重新计算）
- 图表渲染
- 条件格式
- 数据透视表
- 图片/形状嵌入
- VBA 宏
- 打印预览
- 协同编辑

## 8. 降级策略

当 Univer ImportExport 导入失败时（如文件格式异常、Univer 初始化错误），回退到当前的 JSZip + HTML table 方案：

1. `renderXlsx()` 中 try/catch 包裹 Univer 渲染逻辑
2. catch 中调用 `renderXlsxFallback()` 执行原有逻辑
3. 降级渲染在控制台输出警告信息
4. 用户仍可看到原始数据（样式可能不完美，但不会白屏）

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Univer Bundle 过大影响插件加载 | 插件启动变慢 | 动态 import() 按需加载 |
| Univer API 变更导致兼容问题 | 升级困难 | 锁定版本，降级方案兜底 |
| Univer CSS 与 Obsidian 主题冲突 | UI 显示异常 | Canvas 渲染天然隔离；UI 组件需测试 |
| 某些 xlsx 文件导入失败 | 用户看到错误 | 降级到 HTML table 方案 |
| Univer 只读模式配置不完善 | 用户可能误编辑 | 实施时验证只读配置，必要时 CSS 禁用交互 |

## 10. 验收标准

1. 打开 .xlsx 文件后，合并单元格、边框、颜色、字体、行高列宽还原度显著优于当前方案
2. Sheet 标签页可点击切换，显示所有 Sheet 名称
3. 行号列标正确显示
4. 冻结窗格正确还原 xlsx 中的冻结设置
5. 缩放功能可用（鼠标滚轮或状态栏控制）
6. 5000 行表格滚动流畅，无明显卡顿
7. 只读模式下无法编辑单元格内容
8. Univer 导入失败时自动降级到 HTML table 渲染
9. 关闭 xlsx 预览后 Univer 实例被正确销毁，无内存泄漏
10. 插件打包后 main.js 大小增量在可接受范围内（< 1MB gzip）
