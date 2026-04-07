import { expect, test } from "vitest";

import {
  DEFAULT_SETTINGS,
  getEnabledCommandIds,
  mergeSettings,
} from "../src/core/command-settings.ts";

test("mergeSettings fills missing menu toggles with defaults", () => {
  const settings = mergeSettings({
    documentInsertMenuCommands: {
      "compress-30": false,
    },
    localEditorPath: "C:\\Program Files\\paint.net\\PaintDotNet.exe",
    showImageInfoNotification: true,
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
    "convert-webp": true,
    "compress-75": false,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.documentReplaceMenuCommands).toEqual(DEFAULT_SETTINGS.documentReplaceMenuCommands);
  expect(settings.localEditorPath).toBe("C:\\Program Files\\paint.net\\PaintDotNet.exe");
  expect(settings.showImageInfoNotification).toBe(true);
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
    "convert-webp": false,
    "compress-75": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.documentReplaceMenuCommands).toEqual({
    "convert-webp": false,
    "compress-75": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.localEditorPath).toBe("");
  expect(settings.showImageInfoNotification).toBe(false);
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
