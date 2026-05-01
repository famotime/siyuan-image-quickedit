# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SiYuan note-taking plugin (图片快剪) for quick image viewing, conversion, compression, and batch processing. Users right-click images to convert to WebP or compress to target sizes (75%, 50%, 30%, 10%). Supports batch operations on all images in a document, super block image merging, image border addition, and opening images in a local editor.

## Architecture

### Path Alias

`@/` maps to `src/` (configured in `vite.config.ts` and inherited by Vitest).

### Plugin Entry Point

`src/index.ts` — Single plugin class extending `Plugin` from `siyuan`. Three event hooks:
- `open-menu-image` — right-click menu on images
- `click-blockicon` — block icon menu (super block merge)
- `click-editortitleicon` — document title menu for batch operations

The plugin exposes a `PowerButtonsCommandProvider` via `getPowerButtonsIntegration()` for external automation (e.g., the Power Buttons plugin).

### Core Modules (`src/core/`)

- `command-meta.ts` — Command definitions (convert-webp, compress-75/50/30/10, add-border) with labels and target ratios
- `command-settings.ts` — `PluginSettings` type and merge/defaults logic; supports legacy settings migration from `documentMenuCommands` key
- `menu-items.ts` — Builds SiYuan `IMenu[]` structures for image and document batch menus
- `task-runner.ts` — Sequential batch processing with progress callbacks; collects successes/failures
- `formatters.ts` — Builds markdown result blocks and batch summary messages
- `image-markdown.ts` — Replaces image sources in block markdown (used by replace mode)
- `power-buttons-provider.ts` — Power Buttons integration: parses command IDs, delegates to plugin methods
- `plugin-setting.ts` — Ensures `Setting` UI is initialized with all toggle groups

### Services (`src/services/`)

- `image-workflow.ts` — Core processing: fetches images via Canvas API, detects metadata, runs compression search across resolution/quality/palette variants, always outputs WebP. Key exports: `prepareProcessedImage()`, `resolveImageTarget()`, `collectImageTargets()`, `mergeSuperBlockImages()`, `addBorderToImageTarget()`
- `compression-strategy.ts` — Scoring/selection of compression candidates. Four weighted dimensions: resolution (55%), palette (20%), quality (20%), size utilization (5%)
- `palette-quantization.ts` — Fast RGB bit-depth quantization; skips alpha=0 pixels
- `kernel.ts` — SiYuan kernel API calls (upload assets, insert/update markdown blocks, get block by ID)
- `local-editor.ts` — Opens images in a configured external editor (Electron desktop only), waits for edit completion, refreshes images in the editor
- `document-asset-stats.ts` — Calculates total embedded asset bytes for a document
- `image-info-notification.ts` — Optional image info toast on right-click
- `message-display.ts` — Message display helpers

### UI Components (`src/components/SiyuanTheme/`)

Vue 3 components styled to match SiYuan's native UI. Not used for the main menu — menus are built with SiYuan's `IMenu` API.

### Processing Flow

1. User triggers command from image menu, document menu, or Power Buttons
2. Plugin resolves `ImageTarget` (blockId, src, displayWidth/Height)
3. `prepareProcessedImage()` fetches image, runs compression search, returns WebP blob
4. Result uploaded via `uploadAsset()`
5. In insert mode: markdown block inserted after original via `insertMarkdownAfterBlock()`
6. In replace mode: original block markdown updated via `updateMarkdownBlock()`
7. Original image preserved in insert mode; replaced in replace mode

### Concurrency

Only one operation at a time via `runExclusive()` mutex (`isProcessing` flag). Concurrent triggers show an error message.

## Key Constraints

- Plugin must work within SiYuan's plugin API (v2.10.14+)
- All image processing happens client-side using Canvas API (no server, no Node.js)
- Must preserve original images in insert mode (non-destructive workflow)
- Progress messages shown via SiYuan's `showMessage()` API
- Only one operation allowed at a time (mutex via `isProcessing` flag)
- `siyuan` package is externalized — provided by SiYuan runtime, not bundled

## Testing

Tests use Vitest with jsdom environment. Test files are `tests/*.test.ts`. The `siyuan` package is stubbed at `tests/stubs/siyuan.ts` (aliased in `vite.config.ts` test config).

```bash
npm test                                          # all tests
npx vitest run tests/compression-strategy.test.ts # single file
```
