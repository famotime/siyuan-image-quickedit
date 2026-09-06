// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import {
  addBorderToImageTarget,
  buildCompressionScaleSteps,
  collectImageTargetsByDocId,
  prepareProcessedImage,
} from "../src/services/image-workflow.ts";

vi.mock("../src/services/kernel-query.ts", () => ({
  getDocBlockMarkdowns: vi.fn(async (docId: string) => {
    if (docId === "long-doc-123") {
      return [
        { id: "block-1", markdown: "Header\n\n![img1](assets/pic1.png)" },
        { id: "block-2", markdown: "Paragraph text without images" },
        { id: "block-3", markdown: "HTML tag: <img src=\"/assets/pic2.png\"> and markdown: ![img3](https://example.com/pic3.jpg)" },
        { id: "block-4", markdown: "Data URI: <img src=\"data:image/png;base64,12345\">" },
      ];
    }
    return [];
  }),
}));

test("buildCompressionScaleSteps tries original resolution before display-scale reductions", () => {
  expect(buildCompressionScaleSteps(0.5)).toEqual([
    1,
    0.5,
    0.45,
    0.4,
    0.35,
    0.3,
    0.25,
    0.2,
    0.15,
    0.1,
  ]);
});

test("buildCompressionScaleSteps de-duplicates scales when display scale is already full size", () => {
  expect(buildCompressionScaleSteps(1)).toEqual([
    1,
    0.9,
    0.8,
    0.7,
    0.6,
    0.5,
    0.4,
    0.3,
    0.2,
  ]);
});

test("buildCompressionScaleSteps caps starting scale when original width exceeds 1920px", () => {
  const steps = buildCompressionScaleSteps(1, 3840);
  expect(steps[0]).toBeCloseTo(0.5, 5);
  expect(steps).toContain(0.45);
  expect(steps).toContain(0.2);
  expect(steps).not.toContain(1);
});

test("buildCompressionScaleSteps does not cap when original width is at most 1920px", () => {
  expect(buildCompressionScaleSteps(1, 1920)).toEqual([
    1,
    0.9,
    0.8,
    0.7,
    0.6,
    0.5,
    0.4,
    0.3,
    0.2,
  ]);
});

test("buildCompressionScaleSteps does not cap when original width is not provided", () => {
  expect(buildCompressionScaleSteps(1)[0]).toBe(1);
});

test("buildCompressionScaleSteps clamps base scale below natural scale when original width exceeds 1920px", () => {
  const steps = buildCompressionScaleSteps(0.8, 2560);
  expect(steps[0]).toBeCloseTo(0.75, 5);
  expect(steps[1]).toBeCloseTo(0.675, 5);
  expect(steps.length).toBe(9);
  expect(steps[steps.length - 1]).toBeCloseTo(0.15, 5);
});

test("collectImageTargetsByDocId extracts both markdown and HTML img tags across multiple document blocks", async () => {
  const targets = await collectImageTargetsByDocId("long-doc-123");
  expect(targets).toHaveLength(3);
  expect(targets).toEqual(expect.arrayContaining([
    expect.objectContaining({ blockId: "block-1", src: "/assets/pic1.png" }),
    expect.objectContaining({ blockId: "block-3", src: "/assets/pic2.png" }),
    expect.objectContaining({ blockId: "block-3", src: "https://example.com/pic3.jpg" }),
  ]));
});

test("prepareProcessedImage returns skipped result when image meets skip conditions", async () => {
  const fakeBlob = new Blob(["small image data"], { type: "image/png" });
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    blob: async () => fakeBlob,
  })));
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
    width: 60,
    height: 60,
    close: vi.fn(),
  })));

  const result = await prepareProcessedImage(
    { alt: "demo", blockId: "b1", displayHeight: 60, displayWidth: 60, src: "/assets/demo.png" },
    "convert-webp",
    "comprehensive",
    undefined,
    { enabled: true, minSizeKb: 500, minDimensionPx: 100 },
  );

  expect("skipped" in result && result.skipped).toBe(true);
  expect(result.commandLabel).toBe("转为 WebP 格式");
  expect(result.original.width).toBe(60);
  expect(result.original.height).toBe(60);
});

test("addBorderToImageTarget returns skipped result when image meets skip conditions", async () => {
  const fakeBlob = new Blob(["small image data"], { type: "image/png" });
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    blob: async () => fakeBlob,
  })));
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
    width: 80,
    height: 80,
    close: vi.fn(),
  })));

  const result = await addBorderToImageTarget(
    { alt: "demo", blockId: "b1", displayHeight: 80, displayWidth: 80, src: "/assets/demo.png" },
    undefined,
    { enabled: true, minSizeKb: 500, minDimensionPx: 100 },
  );

  expect("skipped" in result && result.skipped).toBe(true);
  expect(result.commandLabel).toBe("添加图像边框");
});
