# Excel 查看器 Univer 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\- [ ]\) syntax for tracking.

**目标：** 将现有的 UniverXlsxRenderer 接入 OfficeRenderer，实现 Univer Canvas 渲染 + JSZip HTML table 自动降级，并在视图关闭时正确销毁 Univer 实例。

**架构：** OfficeRenderer.renderXlsx() 先用 try/catch 调用 UniverXlsxRenderer.render()，失败后自动降级到原有的 enderXlsxFallback()（从原 enderXlsx 提取）。OfficeView.onClose() 调用 enderer.disposeUniver()。Univer CSS 已通过 esbuild-plugin-inline-css 在构建时内联。

**技术栈：** Obsidian Plugin API、Univer（preset-sheets-core）、esbuild、TypeScript、Jest

**当前状态（已就绪）：**
- @univerjs/presets、@univerjs/preset-sheets-core、esbuild-plugin-inline-css 已安装
- src/services/UniverXlsxRenderer.ts 已存在并可正常工作
- esbuild.config.mjs 已配置 inlineCssPlugin()
- src/univer.d.ts 类型声明已就绪

---

### 任务 1：重构 OfficeRenderer — 提取降级方法 + 接入 Univer

**文件：**
- 修改：src/services/OfficeRenderer.ts

**说明：** 当前 enderXlsx()（约第 111-212 行）是纯 JSZip 逻辑。需要将其主体更名为 enderXlsxFallback，新写一个 enderXlsx 优先尝试 Univer，失败时调用降级方法。同时添加 _univerRenderer 字段和 disposeUniver() 方法。

- [ ] **步骤 1：添加 _univerRenderer 私有字段**

在 private vault: Vault;（第 81 行）之后添加：
\\\	ypescript
  private _univerRenderer: import("./UniverXlsxRenderer").UniverXlsxRenderer | null = null;
\\\

- [ ] **步骤 2：将原 enderXlsx 重命名为 enderXlsxFallback**

将方法签名：
\\\	ypescript
  private async renderXlsx(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<string> {
\\\
改为：
\\\	ypescript
  private async renderXlsxFallback(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<string> {
\\\
方法体完全不变（包括 JSZip 解析、导航栏、sheet 切换、表格生成等所有逻辑）。

- [ ] **步骤 3：编写新的 enderXlsx 方法（Univer + 降级）**

在 enderXlsxFallback 之前插入新方法：
\\\	ypescript
  private async renderXlsx(buffer: ArrayBuffer, filename: string, container: HTMLElement): Promise<string> {
    try {
      const { UniverXlsxRenderer } = await import("./UniverXlsxRenderer");
      const renderer = new UniverXlsxRenderer();
      this._univerRenderer = renderer;
      const success = await renderer.render(buffer, filename, container);
      if (!success) {
        throw new Error("Univer render returned false");
      }
      return filename;
    } catch (err) {
      console.warn("Univer render failed, falling back to HTML table", err);
      this._univerRenderer = null;
      await this.renderXlsxFallback(buffer, filename, container);
      return filename;
    }
  }
\\\

- [ ] **步骤 4：添加 disposeUniver() 公有方法**

在 // ============== XLSX helpers ============== 注释之前插入：
\\\	ypescript
  disposeUniver(): void {
    if (this._univerRenderer) {
      this._univerRenderer.dispose();
      this._univerRenderer = null;
    }
  }
\\\

---

### 任务 2：更新 OfficeView，关闭时销毁 Univer

**文件：**
- 修改：src/views/OfficeView.ts

- [ ] **步骤 1：修改 onClose()**

将当前 onClose()（第 98-100 行）：
\\\	ypescript
  async onClose() {
    this.contentEl.empty();
  }
\\\
改为：
\\\	ypescript
  async onClose() {
    this.renderer.disposeUniver();
    this.contentEl.empty();
  }
\\\

---

### 任务 3：添加 Univer 容器 CSS

**文件：**
- 修改：styles.css

- [ ] **步骤 1：在文件末尾追加 Univer 容器样式**

\\\css
/* Univer xlsx 容器 */
.univer-xlsx-container {
  width: 100%;
  height: calc(100% - var(--office-action-bar-height, 40px));
  overflow: hidden;
}

/* 当 office-view-content 包含 Univer 容器时，移除默认内边距和滚动 */
.office-view-content:has(.univer-xlsx-container) {
  padding: 0;
  overflow: hidden;
}
\\\

---

### 任务 4：验证完整构建

- [ ] **步骤 1：TypeScript 类型检查**

\\\ash
cd D:\\app\\AI\\projects\\obsibian-document-management
npx tsc --noEmit --skipLibCheck
\\\
预期：无类型错误（Obsidian 模块类型警告可忽略）。

- [ ] **步骤 2：完整构建**

\\\ash
npm run build
\\\
预期：构建成功，生成 main.js。

- [ ] **步骤 3：运行测试**

\\\ash
npx jest --passWithNoTests --no-coverage
\\\
预期：所有测试通过（当前无测试文件，--passWithNoTests 会通过）。

- [ ] **步骤 4：检查包体积**

\\\ash
node -e "const fs=require('fs');const s=fs.statSync('main.js');console.log('main.js size:',(s.size/1024).toFixed(0),'KB');"
\\\
预期：约 600-900KB（Univer 被打包在内）。
