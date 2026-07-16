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
src/main.ts                     — Register CodeView, add openCodeFile()
src/views/VaultViewerView.ts    — Route code files to CodeView
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

### `src/utils/extensions.ts`
- Add a `CODE_EXTENSIONS` set (all extensions from the mapping table).
- Add `isCodeExtension(filename: string): boolean`.

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

File: `__tests__/CodeRenderer.test.ts`

- `extensionToLanguage` returns correct Prism ID for each extension.
- `highlight` produces expected token classes (`.token.keyword`, `.token.string` etc.).
- `highlight` with unsupported extension returns plain text.
- Large content truncation respects limit and appends notice.
- Empty content renders an empty code block.
