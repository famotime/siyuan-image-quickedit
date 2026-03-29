# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the plugin code. Use `src/index.ts` for the SiYuan plugin lifecycle and menu registration, `src/core/` for command metadata and UI menu builders, and `src/services/` for kernel API access, image processing, local editor integration, and document asset stats. `src/i18n/` holds command labels used by `langKey`.

`tests/` mirrors the runtime modules with Vitest specs such as `image-workflow.test.ts` and `plugin-lifecycle.test.ts`. `assets/` stores README/supporting images. `developer_docs/` is a local SiYuan API and plugin reference set; treat it as background documentation, not runtime code. `plugin-sample-vite-vue/` is an upstream template snapshot kept for comparison and reference; do not patch it unless you are intentionally updating the local template copy. Top-level release artifacts are `plugin.json`, `README.md`, `icon.png`, `preview.png`, and generated `package.zip`. `dist/` is build output and should not be edited manually.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: build in watch mode to the SiYuan workspace from `VITE_SIYUAN_WORKSPACE_PATH`.
- `npm test`: run the full Vitest suite.
- `npm test -- tests/plugin-lifecycle.test.ts`: run a single spec while iterating.
- `npm run build`: create `dist/` and refresh `package.zip`.

Before a release, rebuild after changing `plugin.json`, `README.md`, screenshots, or icons.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, spaces, 2-space indentation, final newline. ESLint uses `@antfu/eslint-config`; prefer TypeScript, single quotes, and trailing commas in multiline objects/arrays. Keep file names descriptive and lower-kebab-case for tests, e.g. `document-asset-stats.test.ts`.

Prefer small focused modules: metadata in `core`, side effects and I/O in `services`. Reuse constants like `SETTINGS_STORAGE` instead of hard-coded strings.

## Testing Guidelines

Vitest is the test runner. Add or update a test for every behavior change, especially plugin lifecycle, menu generation, markdown rewriting, and compression logic. Name tests by observable behavior, for example `test("uninstall removes persisted settings data", ...)`.

Use targeted runs during development, then finish with `npm test`.

## Commit & Pull Request Guidelines

Recent history mixes short imperative summaries and `feat:` prefixes. Prefer concise imperative subjects such as `Add local editor cleanup on uninstall` or `feat: improve compression candidate selection`. Keep one logical change per commit.

PRs should summarize user-visible behavior, list validation steps, and mention whether `package.zip` was rebuilt. Include screenshots when changing menus, icons, or README visuals, and call out any platform limitations such as Electron-only features.

## Release Notes

Bazaar submissions are sensitive to metadata quality. Keep `plugin.json`, `README.md`, `icon.png`, `preview.png`, and `LICENSE` synchronized, and verify raw image links and icon size before publishing.
