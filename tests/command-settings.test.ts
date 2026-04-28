import { expect, test } from "vitest";

import {
  DEFAULT_SETTINGS,
  getEnabledCommandIds,
  getEnabledDocumentBatchCommandIds,
  mergeSettings,
} from "../src/core/command-settings.ts";

test("mergeSettings fills missing menu toggles with defaults", () => {
  const settings = mergeSettings({
    documentInsertMenuCommands: {
      "compress-30": false,
    },
    localEditorPath: "C:\\Program Files\\paint.net\\PaintDotNet.exe",
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
  expect(settings.showSuperBlockMergeMenuItem).toBe(false);
  expect(settings.showImageInfoNotification).toBe(true);
  expect(settings.superBlockMergeOptions).toEqual({
    borderColor: "#ff0000",
    borderWidthPx: 2,
    gapPx: 12,
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

test("getEnabledDocumentBatchCommandIds keeps add-border disabled by default", () => {
  const enabled = getEnabledDocumentBatchCommandIds(DEFAULT_SETTINGS.documentInsertMenuCommands);

  expect(enabled).toEqual([
    "convert-webp",
    "compress-50",
    "compress-10",
  ]);
});
