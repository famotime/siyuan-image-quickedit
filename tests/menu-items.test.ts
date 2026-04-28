// @vitest-environment jsdom
import { expect, test, vi } from "vitest";

import {
  buildDocumentBatchSubmenuItems,
  buildImageQuickEditSubmenuItems,
  buildSuperBlockMergeMenuItem,
  syncReadonlyMenuItemLabelElement,
} from "../src/core/menu-items.ts";

test("buildImageQuickEditSubmenuItems prepends readonly image info before commands", () => {
  const items = buildImageQuickEditSubmenuItems({
    commandIds: ["convert-webp", "compress-75", "compress-50"],
    onAddImageBorder: () => undefined,
    imageInfoLabel: "230.13 KB，1024×572×24 (1.79)",
    onMergeSuperBlockImages: () => undefined,
    onOpenLocalEditor: () => undefined,
    onCommandClick: () => undefined,
  });

  expect(items).toHaveLength(9);
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
    label: "添加图像边框",
  });
  expect(items[4]).toMatchObject({
    label: "图片合并",
  });
  expect(items[5]).toMatchObject({
    type: "separator",
  });
  expect(items[6]).toMatchObject({
    label: "转为 WebP 格式",
  });
  expect(items[7]).toMatchObject({
    label: "压缩到 75%",
  });
  expect(items[8]).toMatchObject({
    label: "压缩到 50%",
  });
});

test("syncReadonlyMenuItemLabelElement preserves line breaks for multiline readonly labels", () => {
  const labelElement = document.createElement("div");

  syncReadonlyMenuItemLabelElement(
    labelElement,
    [
      "230.13 KB，1024×572×24 (1.79)",
      "当前文档内嵌资源总大小：1.50 MB",
    ].join("\n"),
  );

  expect(labelElement.textContent).toBe([
    "230.13 KB，1024×572×24 (1.79)",
    "当前文档内嵌资源总大小：1.50 MB",
  ].join("\n"));
  expect(labelElement.style.whiteSpace).toBe("pre-line");
});

test("buildDocumentBatchSubmenuItems creates a flat document menu for insert and replace actions", () => {
  const items = buildDocumentBatchSubmenuItems({
    insertCommandIds: ["convert-webp", "compress-75", "add-border"],
    onCommandClick: () => undefined,
    replaceCommandIds: ["convert-webp", "compress-75", "add-border"],
  });

  expect(items).toHaveLength(7);
  expect(items[0]).toMatchObject({
    label: "全部转为 WebP 格式（新增）",
  });
  expect(items[1]).toMatchObject({
    label: "全部压缩到 75%（新增）",
  });
  expect(items[2]).toMatchObject({
    label: "全部图片添加边框（新增）",
  });
  expect(items[3]).toMatchObject({
    type: "separator",
  });
  expect(items[4]).toMatchObject({
    label: "全部转为 WebP 格式（替换）",
  });
  expect(items[5]).toMatchObject({
    label: "全部压缩到 75%（替换）",
  });
  expect(items[6]).toMatchObject({
    label: "图片添加边框（替换）",
  });
});

test("buildSuperBlockMergeMenuItem creates the image merge command", () => {
  const onClick = vi.fn();

  const item = buildSuperBlockMergeMenuItem({
    onClick,
  });

  expect(item).toMatchObject({
    label: "图片合并",
  });

  item.click?.();
  expect(onClick).toHaveBeenCalledTimes(1);
});
