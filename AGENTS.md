# Repository Guidelines

## Project Structure & Module Organization

The source code lives in `src/`, organized by concern:

| Directory       | Purpose                                                    |
|-----------------|------------------------------------------------------------|
| `src/services/` | Business logic (FileService, LinkService, OfficeRenderer)  |
| `src/views/`    | Obsidian leaf views (VaultViewerView, OfficeView)          |
| `src/ui/`       | Reusable UI components (ConfirmModal, InputModal)          |
| `src/utils/`    | Utility functions (extension helpers, Lucide icon theme)   |
| `src/i18n/`     | Locale files (en, zh-CN, zh-TW)                            |
| `__tests__/`    | Jest test suites (mirrors src layout)                      |

- Entry point: `src/main.ts` — the plugin class bootstraps all services and views.
- Built output goes to `main.js` at the project root (bundled by esbuild).
- Place design specs in `docs/superpowers/specs/` and implementation plans in `docs/superpowers/plans/`.

## Build, Test, and Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode — rebuilds on file changes
npm run build        # Production build (type-check then bundle)
npm test             # Run all Jest tests
npm test -- --watch  # Run tests in watch mode
```

- The build pipeline uses **esbuild** for bundling and **TypeScript** for type checking.
- Obsidian APIs (`obsidian`, `electron`, CodeMirror packages) are treated as externals and not bundled.
- A post-build script replaces `createElement("script")` with `createElement("div")` to pass Obsidian plugin review.

## Coding Style & Naming Conventions

- **Language**: TypeScript with strict mode (`noImplicitAny`, `strictNullChecks`) targeting ES2018.
- **Indentation**: 2 spaces. No tabs.
- **Naming**:
  - Classes: `PascalCase` (e.g., `VaultViewerPlugin`, `FileService`)
  - Functions & variables: `camelCase` (e.g., `isTreeExtension`, `setIconTheme`)
  - Files: `PascalCase` for classes (e.g., `OfficeRenderer.ts`), `kebab-case` for utilities (e.g., `lucide-icons.ts`)
- **Imports**: ES module style; use relative imports for local modules.
- No auto-formatter is configured — keep new code consistent with the surrounding style.

## Testing Guidelines

- **Framework**: Jest with `ts-jest` preset (Node environment).
- **Test location**: All test files go in `__tests__/` at the project root.
- **Naming**: Test files mirror their source (e.g., `src/utils/extensions.ts` → `__tests__/extensions.test.ts`).
- **Coverage**: No mandatory threshold, but aim to cover utility functions and service logic.
- Use `describe` / `test` blocks; keep each test focused on a single behavior.

## Commit & Pull Request Guidelines

- **Commit messages**: Short imperative mood, no prefixes (e.g., "Add XLSX import/export support", "Remove node_modules from gitignore").
- **PRs**: Include a clear description, link the relevant design spec from `docs/superpowers/specs/`, and attach screenshots for UI changes. Branch from `main` and keep PRs focused on a single feature or fix.

## Agent-Specific Instructions

When contributing via Codex or other AI coding agents:

- Review existing specs in `docs/superpowers/specs/` and plans in `docs/superpowers/plans/` before starting new work to avoid duplication.
- Follow any design spec as the source of truth for implementation.
- Keep changes minimal and consistent with existing patterns — do not reformat unrelated code.
