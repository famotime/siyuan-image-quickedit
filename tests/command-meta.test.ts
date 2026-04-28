import { expect, test } from "vitest";

import {
  COMMAND_DEFINITIONS,
  DOCUMENT_BATCH_COMMAND_DEFINITIONS,
} from "../src/core/command-meta.ts";
import {
  getEnabledCommandIds,
  getEnabledDocumentBatchCommandIds,
} from "../src/core/command-settings.ts";

test("single-image menu command labels are available synchronously", () => {
  const labels = getEnabledCommandIds({
    "convert-webp": true,
    "compress-75": true,
    "compress-50": true,
    "compress-30": false,
    "compress-10": true,
  }).map(commandId => COMMAND_DEFINITIONS[commandId].label);

  expect(labels).toEqual([
    "转为 WebP 格式",
    "压缩到 75%",
    "压缩到 50%",
    "压缩到 10%",
  ]);
});

test("document batch command labels distinguish insert and replace modes", () => {
  expect(COMMAND_DEFINITIONS["convert-webp"]).toMatchObject({
    insertBatchLabel: "全部转为 WebP 格式（新增）",
    replaceBatchLabel: "全部转为 WebP 格式（替换）",
  });
  expect(COMMAND_DEFINITIONS["compress-75"]).toMatchObject({
    insertBatchLabel: "全部压缩到 75%（新增）",
    replaceBatchLabel: "全部压缩到 75%（替换）",
    targetRatio: 0.75,
  });
  expect(COMMAND_DEFINITIONS["compress-30"]).toMatchObject({
    insertBatchLabel: "全部压缩到 30%（新增）",
    replaceBatchLabel: "全部压缩到 30%（替换）",
  });
  expect(DOCUMENT_BATCH_COMMAND_DEFINITIONS["add-border"]).toMatchObject({
    insertBatchLabel: "全部图片添加边框（新增）",
    replaceBatchLabel: "图片添加边框（替换）",
  });
});

test("document batch enabled ids include add-border only after opt-in", () => {
  const enabled = getEnabledDocumentBatchCommandIds({
    "add-border": true,
    "compress-10": true,
    "compress-30": false,
    "compress-50": false,
    "compress-75": true,
    "convert-webp": true,
  });

  expect(enabled).toEqual([
    "convert-webp",
    "compress-75",
    "compress-10",
    "add-border",
  ]);
});
