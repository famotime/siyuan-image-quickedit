import { expect, test } from "vitest";

import {
  buildImageInfoLine,
  buildResultMarkdown,
} from "../src/core/formatters.ts";

test("buildImageInfoLine matches the PRD info format", () => {
  const line = buildImageInfoLine({
    bytes: 235653,
    colorDepth: 24,
    height: 572,
    width: 1024,
  });

  expect(line).toBe("230.13 KB，1024×572×24 (1.79)");
});

test("buildResultMarkdown includes summary text and processed image", () => {
  const markdown = buildResultMarkdown({
    original: {
      bytes: 200_000,
      height: 1144,
      width: 2048,
    },
    output: {
      assetPath: "/assets/demo.webp",
      bytes: 100_000,
      format: "webp",
      height: 572,
      width: 1024,
    },
    commandLabel: "压缩到50%",
  });

  expect(markdown).toBe([
    "压缩到50%完成：压缩后图片分辨率1024×572，尺寸减少50.00%；大小97.66 KB，存储空间减少50.00%，输出格式 WEBP。",
    "",
    "![processed image](/assets/demo.webp)",
  ].join("\n"));
});
