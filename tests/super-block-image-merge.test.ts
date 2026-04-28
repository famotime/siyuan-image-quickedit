// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";

import {
  addBorderToBitmap,
  collectSuperBlockImageTargets,
  mergeBitmapsHorizontallyTopAligned,
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
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 2, 2, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 126, 2, 80, 60);
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
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 2, 2, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 132, 2, 80, 60);
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
  expect(drawImage).toHaveBeenCalledWith(bitmap, 3, 3, 80, 60);
  expect(result.blob.type).toBe("image/webp");
});
