// @vitest-environment jsdom
import { expect, test } from "vitest";

import {
  resolveImageTarget,
  resolveImageTargetFromBlockElements,
} from "../src/services/image-workflow.ts";

test("resolveImageTargetFromBlockElements finds an image inside block menu elements", () => {
  document.body.innerHTML = `
    <div data-node-id="20260314-image-block">
      <div class="protyle-action"></div>
      <div class="protyle-wysiwyg__embed">
        <img src="/assets/demo.png" alt="demo" width="320" height="180">
      </div>
    </div>
  `;

  const blockElement = document.querySelector("[data-node-id]") as HTMLElement;
  const imageTarget = resolveImageTargetFromBlockElements([blockElement]);

  expect(imageTarget).not.toBeNull();
  expect(imageTarget?.blockId).toBe("20260314-image-block");
  expect(imageTarget?.src).toContain("/assets/demo.png");
});

test("resolveImageTarget still works when invoked with the image element itself", () => {
  document.body.innerHTML = `
    <div data-node-id="20260314-inline-image">
      <img src="/assets/inline.png" alt="inline" width="200" height="100">
    </div>
  `;

  const imageElement = document.querySelector("img") as HTMLElement;
  const imageTarget = resolveImageTarget(imageElement);

  expect(imageTarget).not.toBeNull();
  expect(imageTarget?.blockId).toBe("20260314-inline-image");
});
