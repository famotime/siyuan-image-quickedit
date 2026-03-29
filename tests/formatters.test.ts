import { expect, test } from "vitest";

import {
  buildDocumentEmbeddedAssetInfoLine,
  buildImageInfoLabel,
  buildImageInfoLine,
  buildBatchResultMessage,
  buildResultMarkdown,
  formatBytes,
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

test("buildDocumentEmbeddedAssetInfoLine formats the current document embedded asset total", () => {
  expect(buildDocumentEmbeddedAssetInfoLine(1_572_864)).toBe("当前文档内嵌资源总大小：1.50 MB");
});

test("buildImageInfoLabel appends the current document embedded asset total on a new line", () => {
  const label = buildImageInfoLabel({
    documentEmbeddedAssetBytes: 1_572_864,
    imageInfo: {
      bytes: 235653,
      colorDepth: 24,
      height: 572,
      width: 1024,
    },
  });

  expect(label).toBe([
    "230.13 KB，1024×572×24 (1.79)",
    "当前文档内嵌资源总大小：1.50 MB",
  ].join("\n"));
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
    "---",
    "",
    "> **==压缩到50%完成：压缩后图片分辨率1024×572，尺寸比原图（2048×1144）减少50.00%；大小97.66 KB，存储空间相比原图（195.31 KB）减少50.00%，输出格式 WEBP。==**",
    "",
    "![processed image](/assets/demo.webp)",
    "",
    "---",
  ].join("\n"));
});

test("buildResultMarkdown uses unchanged copy when image dimensions stay the same", () => {
  const markdown = buildResultMarkdown({
    original: {
      bytes: 145_408,
      height: 572,
      width: 1024,
    },
    output: {
      assetPath: "/assets/demo.webp",
      bytes: 102_400,
      format: "webp",
      height: 572,
      width: 1024,
    },
    commandLabel: "压缩到70%",
  });

  expect(markdown).toBe([
    "---",
    "",
    "> **==压缩到70%完成：压缩后图片分辨率1024×572，尺寸不变；大小100.00 KB，存储空间相比原图（142.00 KB）减少29.58%，输出格式 WEBP。==**",
    "",
    "![processed image](/assets/demo.webp)",
    "",
    "---",
  ].join("\n"));
});

test("formatBytes uses MB for larger values", () => {
  expect(formatBytes(1_572_864)).toBe("1.50 MB");
});

test("buildBatchResultMessage summarizes total saved storage", () => {
  const message = buildBatchResultMessage({
    failureCount: 0,
    mode: "insert",
    processedCount: 3,
    savedBytes: 1_572_864,
    successCount: 3,
  });

  expect(message).toBe("已处理本文档3个图片，总计减少存储空间1.50 MB，原图未删除，转换后新图片已经插入正文，请审核。");
});

test("buildBatchResultMessage reports failures when some images are not processed", () => {
  const message = buildBatchResultMessage({
    failureCount: 1,
    mode: "insert",
    processedCount: 3,
    savedBytes: 102_400,
    successCount: 2,
  });

  expect(message).toBe("已处理本文档3个图片，其中成功2个，失败1个；总计减少存储空间100.00 KB。原图未删除，成功转换后的新图片已经插入正文，请审核。");
});

test("buildBatchResultMessage uses replacement copy for replace mode", () => {
  const message = buildBatchResultMessage({
    failureCount: 0,
    mode: "replace",
    processedCount: 4,
    savedBytes: 262_144,
    successCount: 4,
  });

  expect(message).toBe("已处理本文档4个图片，总计减少存储空间256.00 KB，原图已直接替换，正文文本未改动，请审核。");
});
