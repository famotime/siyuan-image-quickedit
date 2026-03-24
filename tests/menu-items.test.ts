import { expect, test } from "vitest";

import {
  buildDocumentBatchSubmenuItems,
  buildImageQuickEditSubmenuItems,
} from "../src/core/menu-items.ts";

test("buildImageQuickEditSubmenuItems prepends readonly image info before commands", () => {
  const items = buildImageQuickEditSubmenuItems({
    commandIds: ["convert-webp", "compress-50"],
    imageInfoLabel: "230.13 KB，1024×572×24 (1.79)",
    onOpenLocalEditor: () => undefined,
    onCommandClick: () => undefined,
  });

  expect(items).toHaveLength(6);
  expect(items[0]).toMatchObject({
    label: "230.13 KB，1024×572×24 (1.79)",
    type: "readonly",
  });
  expect(items[1]).toMatchObject({
    type: "separator",
  });
  expect(items[2]).toMatchObject({
    label: "使用本地编辑器编辑",
  });
  expect(items[3]).toMatchObject({
    type: "separator",
  });
  expect(items[4]).toMatchObject({
    label: "转为 WebP 格式",
  });
  expect(items[5]).toMatchObject({
    label: "压缩到 50%",
  });
});

test("buildDocumentBatchSubmenuItems creates a flat document menu for insert and replace actions", () => {
  const items = buildDocumentBatchSubmenuItems({
    insertCommandIds: ["convert-webp", "compress-50"],
    onCommandClick: () => undefined,
    replaceCommandIds: ["convert-webp", "compress-50"],
  });

  expect(items).toHaveLength(5);
  expect(items[0]).toMatchObject({
    label: "全部转为 WebP 格式（新增）",
  });
  expect(items[1]).toMatchObject({
    label: "全部压缩到 50%（新增）",
  });
  expect(items[2]).toMatchObject({
    type: "separator",
  });
  expect(items[3]).toMatchObject({
    label: "全部转为 WebP 格式（替换）",
  });
  expect(items[4]).toMatchObject({
    label: "全部压缩到 50%（替换）",
  });
});
