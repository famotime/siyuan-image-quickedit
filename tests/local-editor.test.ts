import { expect, test } from "vitest";

import {
  buildCacheBustedImageSrc,
  removeCacheBustingSearchParam,
  resolveLocalEditorImagePath,
} from "../src/services/local-editor.ts";

test("resolveLocalEditorImagePath resolves workspace asset urls against Siyuan data dir", () => {
  const imagePath = resolveLocalEditorImagePath("/assets/demo/image.png?t=100", {
    dataDir: "D:\\SiYuan\\workspace\\data",
    origin: "http://127.0.0.1:6806",
  });

  expect(imagePath).toBe("D:\\SiYuan\\workspace\\data\\assets\\demo\\image.png");
});

test("resolveLocalEditorImagePath accepts file protocol paths directly", () => {
  const imagePath = resolveLocalEditorImagePath("file:///D:/Images/demo.png", {
    dataDir: "D:\\SiYuan\\workspace\\data",
    origin: "http://127.0.0.1:6806",
  });

  expect(imagePath).toBe("D:\\Images\\demo.png");
});

test("buildCacheBustedImageSrc replaces an existing timestamp query", () => {
  expect(buildCacheBustedImageSrc("/assets/demo.png?t=100&foo=bar", 200)).toBe(
    "/assets/demo.png?foo=bar&t=200",
  );
});

test("removeCacheBustingSearchParam keeps the persisted image path stable", () => {
  expect(removeCacheBustingSearchParam("/assets/demo.png?t=100&foo=bar")).toBe(
    "/assets/demo.png?foo=bar",
  );
});
