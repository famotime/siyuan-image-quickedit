import { expect, test } from "vitest";

import {
  DEFAULT_SETTINGS,
  getEnabledCommandIds,
  mergeSettings,
} from "../src/core/command-settings.ts";

test("mergeSettings fills missing menu toggles with defaults", () => {
  const settings = mergeSettings({
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
  expect(settings.documentMenuCommands).toEqual(DEFAULT_SETTINGS.documentMenuCommands);
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
