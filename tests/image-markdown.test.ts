import { expect, test } from "vitest";

import { replaceImageSourceInMarkdown } from "../src/core/image-markdown.ts";

test("replaceImageSourceInMarkdown updates markdown image links without changing surrounding text", () => {
  const markdown = "处理前文本 ![demo](/assets/old.png) 处理后文本";

  expect(replaceImageSourceInMarkdown(markdown, "/assets/old.png", "/assets/new.webp")).toBe(
    "处理前文本 ![demo](/assets/new.webp) 处理后文本",
  );
});

test("replaceImageSourceInMarkdown preserves image titles", () => {
  const markdown = "![demo](/assets/old.png \"说明\")";

  expect(replaceImageSourceInMarkdown(markdown, "/assets/old.png", "/assets/new.webp")).toBe(
    "![demo](/assets/new.webp \"说明\")",
  );
});

test("replaceImageSourceInMarkdown updates html img tags", () => {
  const markdown = "<img alt=\"demo\" src=\"/assets/old.png\" data-src=\"keep\">";

  expect(replaceImageSourceInMarkdown(markdown, "/assets/old.png", "/assets/new.webp")).toBe(
    "<img alt=\"demo\" src=\"/assets/new.webp\" data-src=\"keep\">",
  );
});

test("replaceImageSourceInMarkdown throws when the target image is not found", () => {
  expect(() => replaceImageSourceInMarkdown("![demo](/assets/other.png)", "/assets/old.png", "/assets/new.webp")).toThrow(
    "未找到需要替换的图片链接",
  );
});
