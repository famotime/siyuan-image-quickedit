// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";

import {
  addBorderToBitmap,
  collectSuperBlockImageTargets,
  mergeBitmapsHorizontallyTopAligned,
  parseExplicitWidthPx,
} from "../src/services/image-workflow.ts";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

test("collectSuperBlockImageTargets returns images in DOM order", () => {
  document.body.innerHTML = `
    <div data-node-id="super-1" data-type="NodeSuperBlock">
      <div data-node-id="img-1"><img src="/assets/1.png" alt="one"></div>
      <div data-node-id="text-1"><span>text</span></div>
      <div data-node-id="img-2"><img src="/assets/2.png" alt="two"></div>
    </div>
  `;

  const superBlock = document.querySelector('[data-node-id="super-1"]') as HTMLElement;
  const targets = collectSuperBlockImageTargets(superBlock);

  expect(targets.map(target => target.blockId)).toEqual(["img-1", "img-2"]);
  expect(targets.map(target => target.src)).toEqual(["/assets/1.png", "/assets/2.png"]);
});

test("mergeBitmapsHorizontallyTopAligned uses summed width and max height", async () => {
  const firstBitmap = { height: 40, width: 120 } as ImageBitmap;
  const secondBitmap = { height: 60, width: 80 } as ImageBitmap;
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["merged"], { type: "image/webp" })));
  const getContext = vi.fn(() => ({ drawImage, fillRect, fillStyle: "" }));
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "canvas") {
      return {
        height: 0,
        width: 0,
        getContext,
        toBlob,
      } as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName);
  }) as typeof document.createElement);

  const result = await mergeBitmapsHorizontallyTopAligned([firstBitmap, secondBitmap]);

  expect(result.width).toBe(208);
  expect(result.height).toBe(64);
  expect(fillRect).toHaveBeenNthCalledWith(1, 0, 0, 124, 44);
  expect(fillRect).toHaveBeenNthCalledWith(2, 124, 0, 84, 64);
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 120, 40, 2, 2, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 0, 0, 80, 60, 126, 2, 80, 60);
  expect(result.blob.type).toBe("image/webp");
});

test("mergeBitmapsHorizontallyTopAligned applies spacing and per-image borders", async () => {
  const firstBitmap = { height: 40, width: 120 } as ImageBitmap;
  const secondBitmap = { height: 60, width: 80 } as ImageBitmap;
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["merged"], { type: "image/webp" })));
  const context = {
    drawImage,
    fillRect,
    fillStyle: "",
  };
  const getContext = vi.fn(() => context);
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "canvas") {
      return {
        height: 0,
        width: 0,
        getContext,
        toBlob,
      } as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName);
  }) as typeof document.createElement);

  const result = await mergeBitmapsHorizontallyTopAligned([firstBitmap, secondBitmap], {
    borderColor: "#ff6600",
    borderWidthPx: 2,
    gapPx: 6,
  });

  expect(result.width).toBe(214);
  expect(result.height).toBe(64);
  expect(context.fillStyle).toBe("#ff6600");
  expect(fillRect).toHaveBeenNthCalledWith(1, 0, 0, 124, 44);
  expect(fillRect).toHaveBeenNthCalledWith(2, 130, 0, 84, 64);
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 120, 40, 2, 2, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 0, 0, 80, 60, 132, 2, 80, 60);
  expect(result.blob.type).toBe("image/webp");
});

test("addBorderToBitmap expands image size and uses the configured border color", async () => {
  const bitmap = { height: 60, width: 80 } as ImageBitmap;
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["bordered"], { type: "image/webp" })));
  const context = {
    drawImage,
    fillRect,
    fillStyle: "",
  };
  const getContext = vi.fn(() => context);
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "canvas") {
      return {
        height: 0,
        width: 0,
        getContext,
        toBlob,
      } as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName);
  }) as typeof document.createElement);

  const result = await addBorderToBitmap(bitmap, {
    borderColor: "#00ff88",
    borderWidthPx: 3,
    gapPx: 12,
  });

  expect(result.width).toBe(86);
  expect(result.height).toBe(66);
  expect(context.fillStyle).toBe("#00ff88");
  expect(fillRect).toHaveBeenCalledWith(0, 0, 86, 66);
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 80, 60, 3, 3, 80, 60);
  expect(result.blob.type).toBe("image/webp");
});

test("mergeBitmapsHorizontallyTopAligned crops images to minimum height when cropToSameHeight is true", async () => {
  const firstBitmap = { height: 40, width: 120 } as ImageBitmap;
  const secondBitmap = { height: 60, width: 80 } as ImageBitmap;
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["merged"], { type: "image/webp" })));
  const context = {
    drawImage,
    fillRect,
    fillStyle: "",
  };
  const getContext = vi.fn(() => context);
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "canvas") {
      return {
        height: 0,
        width: 0,
        getContext,
        toBlob,
      } as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName);
  }) as typeof document.createElement);

  const result = await mergeBitmapsHorizontallyTopAligned([firstBitmap, secondBitmap], {
    borderColor: "#ff6600",
    borderWidthPx: 2,
    gapPx: 6,
    cropToSameHeight: true,
  });

  expect(result.width).toBe(214);
  expect(result.height).toBe(44);
  expect(context.fillStyle).toBe("#ff6600");
  expect(fillRect).toHaveBeenNthCalledWith(1, 0, 0, 124, 44);
  expect(fillRect).toHaveBeenNthCalledWith(2, 130, 0, 84, 44);
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 120, 40, 2, 2, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 0, 0, 80, 40, 132, 2, 80, 40);
  expect(result.blob.type).toBe("image/webp");
});

test("parseExplicitWidthPx correctly extracts width from wrapper span or img style", () => {
  document.body.innerHTML = `
    <div data-node-id="block-1">
      <span data-type="img" class="img">
        <span style="width: 229px;">
          <img id="img1" src="/assets/1.png">
        </span>
      </span>
      <img id="img2" src="/assets/2.png" style="width: 350px;">
    </div>
  `;

  const img1 = document.getElementById("img1") as HTMLImageElement;
  const img2 = document.getElementById("img2") as HTMLImageElement;

  expect(parseExplicitWidthPx(img1)).toBe(229);
  expect(parseExplicitWidthPx(img2)).toBe(350);
});

test("mergeBitmapsHorizontallyTopAligned resizes images with targetWidth proportionally", async () => {
  // 原图 1000x500 (2:1)，设定宽度 200 => 渲染 200x100
  const firstBitmap = { height: 500, width: 1000 } as ImageBitmap;
  // 原图 400x400 (1:1)，无设定宽度 => 渲染 400x400
  const secondBitmap = { height: 400, width: 400 } as ImageBitmap;

  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["merged"], { type: "image/webp" })));
  const context = { drawImage, fillRect, fillStyle: "" };
  const getContext = vi.fn(() => context);
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "canvas") {
      return { height: 0, width: 0, getContext, toBlob } as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tagName);
  }) as typeof document.createElement);

  const result = await mergeBitmapsHorizontallyTopAligned(
    [
      { bitmap: firstBitmap, targetWidth: 200 },
      { bitmap: secondBitmap },
    ],
    {
      borderColor: "#000000",
      borderWidthPx: 0,
      cropToSameHeight: true,
      gapPx: 10,
    },
  );

  // 第一张渲染为 200x100，第二张 400x400
  // minHeight = min(100, 400) = 100
  // 总宽度 = 200 + 10 + 400 = 610
  expect(result.width).toBe(610);
  expect(result.height).toBe(100);

  // 第一张图片完整绘制在 (0, 0, 200, 100)
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 1000, 500, 0, 0, 200, 100);
  // 第二张图片原高度 400，在 minHeight=100 时需要截取源图高 100*(400/400)=100，即 (0, 0, 400, 100) 绘制到 (210, 0, 400, 100)
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 0, 0, 400, 100, 210, 0, 400, 100);
});
