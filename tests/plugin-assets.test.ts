import { statSync } from "node:fs";

import { expect, test } from "vitest";

test("icon.png stays within the recommended plugin icon size budget", () => {
  const iconPath = new URL("../icon.png", import.meta.url);
  const iconSize = statSync(iconPath).size;

  expect(iconSize).toBeLessThanOrEqual(20 * 1024);
});

test("preview.png stays within the Bazaar preview size budget", () => {
  const previewPath = new URL("../preview.png", import.meta.url);
  const previewSize = statSync(previewPath).size;

  expect(previewSize).toBeLessThanOrEqual(200 * 1024);
});
