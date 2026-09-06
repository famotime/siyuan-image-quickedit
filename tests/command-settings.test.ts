import { expect, test } from "vitest";

import {
  DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS,
  DEFAULT_SETTINGS,
  getEnabledCommandIds,
  getEnabledDocumentBatchCommandIds,
  mergeSettings,
  shouldSkipImageTarget,
} from "../src/core/command-settings.ts";

test("mergeSettings fills missing menu toggles with defaults", () => {
  const settings = mergeSettings({
    documentInsertMenuCommands: {
      "compress-30": false,
    },
    localEditorPath: "C:\\Program Files\\paint.net\\PaintDotNet.exe",
    showAddImageBorderMenuItem: true,
    showSuperBlockMergeMenuItem: false,
    showImageInfoNotification: true,
    superBlockMergeOptions: {
      borderColor: "#ff0000",
      borderWidthPx: 2,
      gapPx: 12,
    },
    imageMenuCommands: {
      "compress-10": false,
    },
  });

  expect(settings.imageMenuCommands).toEqual({
    "convert-webp": true,
    "compress-75": false,
    "compress-50": true,
    "compress-30": false,
    "compress-10": false,
  });
  expect(settings.documentInsertMenuCommands).toEqual({
    "add-border": false,
    "convert-webp": true,
    "compress-75": false,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.documentReplaceMenuCommands).toEqual(DEFAULT_SETTINGS.documentReplaceMenuCommands);
  expect(settings.localEditorPath).toBe("C:\\Program Files\\paint.net\\PaintDotNet.exe");
  expect(settings.showAddImageBorderMenuItem).toBe(true);
  expect(settings.showSuperBlockMergeMenuItem).toBe(false);
  expect(settings.showImageInfoNotification).toBe(true);
  expect(settings.superBlockMergeOptions).toEqual({
    borderColor: "#ff0000",
    borderWidthPx: 2,
    gapPx: 12,
    cropToSameHeight: false,
  });
});

test("mergeSettings migrates legacy document menu toggles to both document menu groups", () => {
  const settings = mergeSettings({
    documentMenuCommands: {
      "convert-webp": false,
      "compress-75": true,
      "compress-50": true,
      "compress-30": false,
      "compress-10": true,
    },
  });

  expect(settings.documentInsertMenuCommands).toEqual({
    "add-border": false,
    "convert-webp": false,
    "compress-75": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.documentReplaceMenuCommands).toEqual({
    "add-border": false,
    "convert-webp": false,
    "compress-75": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.localEditorPath).toBe("");
  expect(settings.showAddImageBorderMenuItem).toBe(false);
  expect(settings.showSuperBlockMergeMenuItem).toBe(true);
  expect(settings.showImageInfoNotification).toBe(false);
  expect(settings.superBlockMergeOptions).toEqual(DEFAULT_SETTINGS.superBlockMergeOptions);
});

test("mergeSettings fills missing super block merge options with defaults", () => {
  const settings = mergeSettings({
    superBlockMergeOptions: {
      gapPx: 8,
    },
  });

  expect(settings.superBlockMergeOptions).toEqual({
    borderColor: "#808080",
    borderWidthPx: 2,
    gapPx: 8,
    cropToSameHeight: false,
  });
});

test("getEnabledCommandIds keeps PRD command order and filters disabled items", () => {
  const enabled = getEnabledCommandIds({
    "convert-webp": true,
    "compress-75": true,
    "compress-50": false,
    "compress-30": true,
    "compress-10": true,
  });

  expect(enabled).toEqual([
    "convert-webp",
    "compress-75",
    "compress-30",
    "compress-10",
  ]);
});

test("mergeSettings defaults compressionStrategy to comprehensive", () => {
  const settings = mergeSettings({});
  expect(settings.compressionStrategy).toBe("comprehensive");
});

test("mergeSettings preserves explicit compressionStrategy", () => {
  const settings = mergeSettings({
    compressionStrategy: "resolution-first",
  });
  expect(settings.compressionStrategy).toBe("resolution-first");
});

test("mergeSettings rejects invalid compressionStrategy values", () => {
  const settings = mergeSettings({
    compressionStrategy: "invalid" as "comprehensive",
  });
  expect(settings.compressionStrategy).toBe("comprehensive");
});

test("getEnabledDocumentBatchCommandIds keeps add-border disabled by default", () => {
  const enabled = getEnabledDocumentBatchCommandIds(DEFAULT_SETTINGS.documentInsertMenuCommands);

  expect(enabled).toEqual([
    "convert-webp",
    "compress-50",
    "compress-10",
  ]);
});

test("DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS defaults to enabled with 300KB and 100px", () => {
  expect(DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS).toEqual({
    enabled: true,
    minSizeKb: 300,
    minDimensionPx: 100,
  });
});

test("mergeSettings fills missing documentBatchSkipOptions with defaults", () => {
  const settings = mergeSettings({});
  expect(settings.documentBatchSkipOptions).toEqual({
    enabled: true,
    minSizeKb: 300,
    minDimensionPx: 100,
  });
});

test("mergeSettings preserves and normalizes documentBatchSkipOptions", () => {
  const settings = mergeSettings({
    documentBatchSkipOptions: {
      enabled: false,
      minSizeKb: 250,
      minDimensionPx: 80,
    },
  });
  expect(settings.documentBatchSkipOptions).toEqual({
    enabled: false,
    minSizeKb: 250,
    minDimensionPx: 80,
  });
});

test("mergeSettings handles legacy or fallback dimension properties", () => {
  const settings = mergeSettings({
    documentBatchSkipOptions: {
      minWidthPx: 120,
    } as any,
  });
  expect(settings.documentBatchSkipOptions.minDimensionPx).toBe(120);
});

test("shouldSkipImageTarget skips when file size is below threshold", () => {
  const options = { enabled: true, minSizeKb: 500, minDimensionPx: 100 };
  // 400KB < 500KB (400 * 1024 < 500 * 1024), 800x600 >= 100
  expect(shouldSkipImageTarget({ bytes: 400 * 1024, width: 800, height: 600 }, options)).toBe(true);
});

test("shouldSkipImageTarget skips when width is below dimension threshold", () => {
  const options = { enabled: true, minSizeKb: 500, minDimensionPx: 100 };
  // 600KB >= 500KB, width 99 < 100
  expect(shouldSkipImageTarget({ bytes: 600 * 1024, width: 99, height: 600 }, options)).toBe(true);
});

test("shouldSkipImageTarget skips when height is below dimension threshold", () => {
  const options = { enabled: true, minSizeKb: 500, minDimensionPx: 100 };
  // 600KB >= 500KB, height 99 < 100
  expect(shouldSkipImageTarget({ bytes: 600 * 1024, width: 800, height: 99 }, options)).toBe(true);
});

test("shouldSkipImageTarget does not skip when both size and dimensions satisfy thresholds", () => {
  const options = { enabled: true, minSizeKb: 500, minDimensionPx: 100 };
  // 500KB >= 500KB, 100x100 >= 100
  expect(shouldSkipImageTarget({ bytes: 500 * 1024, width: 100, height: 100 }, options)).toBe(false);
  expect(shouldSkipImageTarget({ bytes: 1024 * 1024, width: 1920, height: 1080 }, options)).toBe(false);
});

test("shouldSkipImageTarget does not skip when enabled is false", () => {
  const options = { enabled: false, minSizeKb: 500, minDimensionPx: 100 };
  expect(shouldSkipImageTarget({ bytes: 100, width: 10, height: 10 }, options)).toBe(false);
});

test("shouldSkipImageTarget ignores checks when threshold is 0", () => {
  // size threshold 0 -> do not skip by size
  const optionsNoSize = { enabled: true, minSizeKb: 0, minDimensionPx: 100 };
  expect(shouldSkipImageTarget({ bytes: 100, width: 200, height: 200 }, optionsNoSize)).toBe(false);

  // dimension threshold 0 -> do not skip by dimension
  const optionsNoDim = { enabled: true, minSizeKb: 500, minDimensionPx: 0 };
  expect(shouldSkipImageTarget({ bytes: 600 * 1024, width: 10, height: 10 }, optionsNoDim)).toBe(false);
});

test("shouldSkipImageTarget returns false when options is null or undefined", () => {
  expect(shouldSkipImageTarget({ bytes: 100, width: 10, height: 10 }, null)).toBe(false);
  expect(shouldSkipImageTarget({ bytes: 100, width: 10, height: 10 }, undefined)).toBe(false);
});
