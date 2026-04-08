// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";

import {
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
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["merged"], { type: "image/webp" })));
  const getContext = vi.fn(() => ({ drawImage }));
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

  expect(result.width).toBe(200);
  expect(result.height).toBe(60);
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 120, 0, 80, 60);
  expect(result.blob.type).toBe("image/webp");
});
