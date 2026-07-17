# CodeView 文本选择与复制功能设计文档

## 1. 问题背景

用户反馈：在 CodeView 中打开 JSON、CSS 等代码文件时，**无法选中文本进行复制**，只能查看。这是核心问题。

次要需求：在动作栏添加「全部复制」按钮，一键复制整个文件内容。

OfficeView（.docx/.xlsx/.pptx）不需要复制功能，用户已确认。

## 2. 根因分析

CodeView 使用 `highlight()` 将代码渲染为带语法高亮的 HTML（`<span class="token keyword">` 等），放入 `<pre><code>` 中。

可能导致无法选中的原因：
- CSS `user-select: none` 应用在代码容器或父元素上
- 事件处理器阻止了选择行为（如 `pointer-events: none`、mousedown 阻止默认行为）
- 语法高亮生成的嵌套 span 结构干扰了选择

## 3. 设计方案

### 3.1 核心修复：启用文本选择

**文件：`src/views/CodeView.ts`**

在 `renderContent()` 中，确保代码容器支持文本选择：

```typescript
const codeWrapper = container.createDiv({ cls: "code-view-wrapper" });
codeWrapper.style.userSelect = "text";           // 显式启用
codeWrapper.style.webkitUserSelect = "text";     // WebKit 兼容
```

同时检查并移除任何可能阻止选择的 CSS 规则。

### 3.2 增强功能：「全部复制」按钮

**文件：`src/views/CodeView.ts`**

在动作栏添加按钮：

```
[← Back] [📋 Copy All] [📄 filename] [📎 Open Externally]
```

点击行为：
1. 读取文件原始内容（`await this.app.vault.read(this.file)`）
2. 写入剪贴板：`await navigator.clipboard.writeText(content)`
3. 显示临时提示："Copied!" / "已复制！"

### 3.3 国际化支持

**文件：`src/i18n/en.ts`, `zh-CN.ts`, `zh-TW.ts`**

新增翻译键：
```typescript
code: {
  copyAll: "Copy All",
  copied: "Copied!",
  // ...
}
```

## 4. 影响范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/views/CodeView.ts` | 修改 | 修复选择、添加复制按钮、集成 i18n |
| `src/i18n/*.ts` | 修改 | 新增翻译键 |
| 样式（内联或 CSS） | 检查/修复 | 确保无 `user-select: none` |

## 5. 验收标准

1. **文本选择**：在 CodeView 中打开任意代码文件，鼠标拖拽可选中任意部分文本，右键菜单显示"复制"，Ctrl+C 可复制
2. **全部复制**：点击动作栏「全部复制」按钮，整个文件原始内容写入剪贴板，提示"已复制！"
3. **OfficeView 无变化**：打开 .docx/.xlsx/.pptx 无新增按钮，行为不变

## 6. 测试用例

- JSON 文件：选中部分键值对复制
- CSS 文件：选中部分规则复制
- 大文件（>1000 行）：选中中间段落、点击「全部复制」
- 无语言高亮文件（.txt）：基础选择复制

## 7. 实现顺序

1. 修复 CodeView 文本选择（核心）
2. 添加「全部复制」按钮及逻辑
3. 补充 i18n 翻译
4. 手动测试验证