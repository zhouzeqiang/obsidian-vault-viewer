# In-Vault Code Viewer with Syntax Highlighting

## Summary

Add a read-only code viewer to Vault Viewer that displays code/text files
directly in Obsidian with Prism.js syntax highlighting, instead of opening them
in the system's external application.

## Architecture

```
src/services/CodeRenderer.ts   — Prism.js-based syntax highlighting
src/views/CodeView.ts           — ItemView for the code preview tab
src/utils/extensions.ts         — Add isCodeExtension() helper
src/utils/file-icons.ts         — Devicon-based language icon map (SVG + color)
src/main.ts                     — Register CodeView, add openCodeFile()
src/views/VaultViewerView.ts    — Route code files, apply language icons/colours
src/i18n/*.ts                   — Add code view translations
styles.css                      — Code view layout + Prism theme colours
```

**Data flow**: click file → `plugin.openCodeFile(file)` → find-or-create CodeView
leaf → `vault.read(file)` → `CodeRenderer.highlight(content, ext)` → insert HTML.

## CodeRenderer

### Language mapping (extension → Prism language ID)

| Extension(s) | Prism ID |
|---|---|
| `java` | `java` |
| `py` | `python` |
| `js` `mjs` `cjs` | `javascript` |
| `ts` `tsx` | `typescript` |
| `jsx` | `jsx` |
| `json` | `json` |
| `xml` `html` `htm` `vue` | `markup` |
| `yaml` `yml` | `yaml` |
| `css` | `css` |
| `scss` `sass` | `scss` |
| `less` | `less` |
| `styl` | `stylus` |
| `sql` | `sql` |
| `sh` `bash` `zsh` | `bash` |
| `ps1` `psm1` `psd1` | `powershell` |
| `bat` `cmd` | `batch` |
| `php` `php3` `php4` `php5` `phtml` | `php` |
| `rb` | `ruby` |
| `go` | `go` |
| `rs` | `rust` |
| `c` `h` | `c` |
| `cpp` `cc` `cxx` `hpp` `hxx` | `cpp` |
| `cs` | `csharp` |
| `swift` | `swift` |
| `kt` `kts` | `kotlin` |
| `scala` | `scala` |
| `groovy` `gradle` | `groovy` |
| `pl` `pm` `t` | `perl` |
| `lua` | `lua` |
| `r` `R` `rmd` | `r` |
| `m` | `objectivec` |
| `mm` | `objectivec` |
| `dart` | `dart` |
| `erl` | `erlang` |
| `ex` `exs` | `elixir` |
| `coffee` | `coffeescript` |
| `tex` `sty` `cls` `ltx` | `latex` |
| `rst` | `rest` |
| `toml` | `toml` |
| `ini` `cfg` `conf` `env` | `ini` |
| `properties` | `properties` |
| `makefile` `Makefile` | `makefile` |
| `dockerfile` `Dockerfile` | — plain text fallback |
| `gitignore` | — plain text fallback |
| `txt` | — plain text fallback |

Unmapped extensions fall back to `<pre><code>` with no highlighting.

### Behaviour

- Large files (≥500 kB): read first 2000 lines, append truncation notice.
- Non-UTF-8 content: catch decode error, show error message.
- Prism rendering failure: try/catch fallback to plain text.
- Input: `(content: string, extension: string) → string` (returns rendered HTML).

## CodeView

Mirrors the OfficeView pattern:

```
┌─ Action Bar ─────────────────────────────┐
│  ← Back    python    app.py    [Open Ext] │
├───────────────────────────────────────────┤
│  1 │ import os                           │
│  2 │ import sys                          │
│  3 │                                     │
│  4 │ def main():                         │
│  5 │     print("hello")                  │
└───────────────────────────────────────────┘
```

- **Action bar**: back button, language badge, filename, open-external button.
- **Code area**: `<pre><code class="language-xxx">` — Prism applies CSS tokens.
- **Line numbers**: pure CSS `counter-increment` on `<code>` lines, no extra DOM.
- **Lifecycle**: matches OfficeView — `constructor → onOpen → setState`.

Registered as `VIEW_TYPE_CODE = "vault-viewer-code"`.

## File Icons & Colours

Add language-specific file icons with brand colours (inspired by VSCode icon
themes) using SVGs from the [devicon](https://devicon.dev) set.

### `src/utils/file-icons.ts`

Each supported language stores an inline SVG path and its brand colour:

```typescript
interface FileIcon {
  svg: string;   // SVG path data (devicon-derived)
  color: string; // brand colour (e.g. "#3178C6")
}

const FILE_ICONS: Record<string, FileIcon> = {
  py:   { svg: "<path d='...'/>", color: "#3776AB" },
  js:   { svg: "<path d='...'/>", color: "#F7DF1E" },
  ts:   { svg: "<path d='...'/>", color: "#3178C6" },
  java: { svg: "<path d='...'/>", color: "#ED8B00" },
  rs:   { svg: "<path d='...'/>", color: "#DEA584" },
  go:   { svg: "<path d='...'/>", color: "#00ADD8" },
  rb:   { svg: "<path d='...'/>", color: "#CC342D" },
  php:  { svg: "<path d='...'/>", color: "#777BB4" },
  // ... all supported languages
};
```

Functions:
- `getFileIcon(extension: string): FileIcon | null` — lookup by extension key.
- **Fallback**: unknown extensions → `null` (caller uses existing Lucide icon).

### How it renders

In tree rows and list rows, the existing icon `<span>` gets:
1. The devicon SVG inserted as inner HTML.
2. CSS `color` set to the brand colour (via `style.color`).
3. SVG width/height set to 16×16 for tree/list, 20×20 for CodeView.

### Integration in VaultViewerView

- Existing `getFileIcon(file)` is augmented: code files with a devicon entry use
  the devicon SVG + brand colour. All other files (Office, images, unknown)
  continue using Lucide icons as before.
- The rendered icon `<span>` gets a CSS class `vv-file-icon--devicon` for
  consistent sizing.

### Integration in CodeView

- The action bar language badge shows the devicon icon + language name.
- The tab icon (optional) uses the devicon colour.

### Files NOT affected

- Office files (.docx .xlsx .pptx) — keep Lucide icons.
- Image files — keep Lucide icons.
- Markdown files — keep Lucide icons.

## Changes to existing files

### `src/main.ts`
- Import `CodeView` and `CodeRenderer`.
- Register `VIEW_TYPE_CODE` with a factory lambda.
- Add `openCodeFile(file: TFile)` — same logic as `openOfficeFile`.
- Instantiate `CodeRenderer` (lives alongside `OfficeRenderer`).

### `src/views/VaultViewerView.ts`
- In `onListFileClick()` and `onReferenceClick()`: add extension check via
  `isCodeExtension()`. Route matching files to `plugin.openCodeFile()`.
- Order of checks: office extensions first, then code extensions, then default.
- `getFileIcon()` extended: code files with a devicon entry use devicon SVG +
  brand colour; others keep Lucide icons.
- Icon rendering applies SVG color via `style.color`.
- New CSS class `vv-file-icon--devicon` for consistent sizing.

### `src/utils/extensions.ts`
- Add a `CODE_EXTENSIONS` set (all extensions from the mapping table).
- Add `isCodeExtension(filename: string): boolean`.

### `src/utils/file-icons.ts`
- New file: devicon-derived SVG icons + brand colours for each language.
- Export `getFileIcon(extension): FileIcon | null`.

### `src/i18n/*.ts`
Add keys: `code.back`, `code.tooLarge`, `code.lines`, `code.openExternal`,
`code.parseError`, `code.lang`.

### `styles.css`
- Layout classes: `.code-view-container`, `.code-view-actions`, `.code-view-content`.
- Code block: monospace font, horizontal scroll, max-height with overflow.
- Line numbers (CSS counters).
- Prism colour tokens adapted for Obsidian light/dark theme.

## Error handling

| Scenario | Behaviour |
|---|---|
| File deleted between click and open | Gracefully show error message |
| File ≥500 kB | Truncate to 2000 lines, show notice |
| Non-UTF-8 content | Show "unable to read" notice |
| Prism tokenization error | Fallback to plain `<pre><code>` |
| CodeView tab re-used for new file | Full re-render via setState |

## Testing

### `__tests__/CodeRenderer.test.ts`
- `extensionToLanguage` returns correct Prism ID for each extension.
- `highlight` produces expected token classes (`.token.keyword`, `.token.string` etc.).
- `highlight` with unsupported extension returns plain text.
- Large content truncation respects limit and appends notice.
- Empty content renders an empty code block.

### `__tests__/file-icons.test.ts`
- `getFileIcon` returns correct `FileIcon` for each code extension.
- `getFileIcon` returns `null` for unsupported extensions (`.docx`, `.md`, etc.).
- All returned icons have a non-empty SVG path and a valid hex colour.
- Brand colours match expected values for key languages.
