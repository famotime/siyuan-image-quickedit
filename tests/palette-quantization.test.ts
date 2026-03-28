import { expect, test } from "vitest";

import { quantizeRgbaBufferToMaxColors } from "../src/services/palette-quantization.ts";

function collectRgbColors(buffer: Uint8ClampedArray): Set<string> {
  const colors = new Set<string>();
  for (let index = 0; index < buffer.length; index += 4) {
    colors.add(`${buffer[index]},${buffer[index + 1]},${buffer[index + 2]}`);
  }

  return colors;
}

test("quantizeRgbaBufferToMaxColors reduces rgb variants to the requested palette budget", () => {
  const source = new Uint8ClampedArray([
    255, 0, 0, 255,
    240, 16, 16, 255,
    0, 255, 0, 255,
    16, 240, 16, 255,
    0, 0, 255, 255,
    16, 16, 240, 255,
    255, 255, 0, 255,
    240, 240, 16, 255,
  ]);

  const quantized = quantizeRgbaBufferToMaxColors(source, 4);

  expect(collectRgbColors(quantized).size).toBeLessThanOrEqual(4);
});

test("quantizeRgbaBufferToMaxColors preserves alpha values", () => {
  const source = new Uint8ClampedArray([
    255, 30, 30, 0,
    30, 255, 30, 64,
    30, 30, 255, 128,
    255, 255, 255, 255,
  ]);

  const quantized = quantizeRgbaBufferToMaxColors(source, 16);

  expect(Array.from(quantized.filter((_, index) => index % 4 === 3))).toEqual([0, 64, 128, 255]);
});
