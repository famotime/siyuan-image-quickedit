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
    imageMenuCommands: {
      "compress-10": false,
    },
  });

  expect(settings.imageMenuCommands).toEqual({
    "convert-webp": true,
    "compress-50": true,
    "compress-30": true,
    "compress-10": false,
  });
  expect(settings.documentInsertMenuCommands).toEqual({
    "convert-webp": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.documentReplaceMenuCommands).toEqual(DEFAULT_SETTINGS.documentReplaceMenuCommands);
  expect(settings.localEditorPath).toBe("C:\\Program Files\\paint.net\\PaintDotNet.exe");
});

test("mergeSettings migrates legacy document menu toggles to both document menu groups", () => {
  const settings = mergeSettings({
    documentMenuCommands: {
      "convert-webp": false,
      "compress-50": true,
      "compress-30": false,
      "compress-10": true,
    },
  });

  expect(settings.documentInsertMenuCommands).toEqual({
    "convert-webp": false,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.documentReplaceMenuCommands).toEqual({
    "convert-webp": false,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  });
  expect(settings.localEditorPath).toBe("");
});

test("getEnabledCommandIds keeps PRD command order and filters disabled items", () => {
  const enabled = getEnabledCommandIds({
    "convert-webp": true,
    "compress-50": false,
    "compress-30": true,
    "compress-10": true,
  });

  expect(enabled).toEqual([
    "convert-webp",
    "compress-30",
    "compress-10",
  ]);
});
