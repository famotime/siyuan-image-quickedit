import { expect, test } from "vitest";

import { COMMAND_DEFINITIONS } from "../src/core/command-meta.ts";
import { getEnabledCommandIds } from "../src/core/command-settings.ts";

test("single-image menu command labels are available synchronously", () => {
  const labels = getEnabledCommandIds({
    "convert-webp": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  }).map(commandId => COMMAND_DEFINITIONS[commandId].label);

  expect(labels).toEqual([
    "转为 WebP 格式",
    "压缩到 50%",
    "压缩到 10%",
  ]);
});

test("document batch command labels distinguish insert and replace modes", () => {
  expect(COMMAND_DEFINITIONS["convert-webp"]).toMatchObject({
    insertBatchLabel: "全部转为 WebP 格式（新增）",
    replaceBatchLabel: "全部转为 WebP 格式（替换）",
  });
  expect(COMMAND_DEFINITIONS["compress-30"]).toMatchObject({
    insertBatchLabel: "全部压缩到 30%（新增）",
    replaceBatchLabel: "全部压缩到 30%（替换）",
  });
});
