# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SiYuan note-taking plugin that provides quick image conversion and compression actions. Users can right-click images in documents to convert to WebP format or compress to target file sizes (50%, 30%, 10%). The plugin also supports batch operations on all images in a document.

## Development Commands

```bash
# Development mode with hot reload
npm run dev

# Build for production (outputs to ./dist and creates package.zip)
npm run build

# Run tests
npm test

# Lint code
npx eslint .

# Release commands
npm run release              # Interactive release
npm run release:patch        # Patch version bump
npm run release:minor        # Minor version bump
npm run release:major        # Major version bump
```

## Development Setup

1. Copy `.env.example` to `.env` and set `VITE_SIYUAN_WORKSPACE_PATH` to your SiYuan workspace path
2. Run `npm run dev` - the plugin will build to `{workspace}/data/plugins/siyuan-image-quickedit`
3. Enable the plugin in SiYuan's settings

## Architecture

### Plugin Entry Point
- `src/index.ts` - Main plugin class extending `Plugin` from `siyuan` package
- Listens to two key events:
  - `open-menu-image` - Decorates right-click menu on images
  - `click-editortitleicon` - Decorates document title menu for batch operations

### Core Modules

**Command System** (`src/core/`)
- `command-meta.ts` - Defines 4 commands: convert-webp, compress-50, compress-30, compress-10
- `command-settings.ts` - User settings for which commands appear in menus
- `task-runner.ts` - Sequential batch processing with progress reporting

**Image Processing** (`src/services/`)
- `image-workflow.ts` - Core image processing logic:
  - Fetches image from DOM/network
  - Detects metadata (size, resolution, color depth)
  - Applies display scale from user's drag-resize
  - Iteratively compresses using quality steps until target ratio met
  - Always outputs WebP format
- `kernel.ts` - SiYuan API calls (upload assets, insert blocks)

**UI Components** (`src/components/SiyuanTheme/`)
- Vue 3 components styled to match SiYuan's native UI

### Processing Flow

1. User triggers command from image menu or document menu
2. Plugin resolves `ImageTarget` (blockId, src, displayWidth/Height)
3. `prepareProcessedImage()` fetches, processes, and compresses image
4. Result uploaded via `uploadAsset()`
5. Markdown result inserted after original block via `insertMarkdownAfterBlock()`
6. Original image preserved, new block shows comparison stats

### Build System

- Vite + Vue 3 + TypeScript
- In dev mode: builds to SiYuan workspace with livereload
- In prod mode: builds to `./dist` and creates `package.zip`
- Externalizes `siyuan` package (provided by SiYuan runtime)
- Copies static assets: README, icons, i18n files, plugin.json

## Key Constraints

- Plugin must work within SiYuan's plugin API (v2.10.14+)
- All image processing happens client-side using Canvas API
- Must preserve original images (non-destructive workflow)
- Progress messages shown during long operations
- Only one operation allowed at a time (mutex via `isProcessing` flag)

## Testing

Tests use Vitest with jsdom environment. Run single test file:
```bash
npx vitest run path/to/test.spec.ts
```

## Plugin Distribution

The `package.zip` created by build contains everything needed for SiYuan's plugin marketplace. Before submitting to official Bazaar, use the `siyuan-plugin-preflight` skill to validate.
