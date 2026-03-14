import { expect, test } from "vitest";

import { buildImageQuickEditSubmenuItems } from "../src/core/menu-items.ts";

test("buildImageQuickEditSubmenuItems prepends readonly image info before commands", () => {
  const items = buildImageQuickEditSubmenuItems({
    commandIds: ["convert-webp", "compress-50"],
    imageInfoLabel: "230.13 KB，1024×572×24 (1.79)",
    onCommandClick: () => undefined,
  });

  expect(items).toHaveLength(4);
  expect(items[0]).toMatchObject({
    label: "230.13 KB，1024×572×24 (1.79)",
    type: "readonly",
  });
  expect(items[1]).toMatchObject({
    type: "separator",
  });
  expect(items[2]).toMatchObject({
    label: "转为 WebP 格式",
  });
  expect(items[3]).toMatchObject({
    label: "压缩到 50%",
  });
});
