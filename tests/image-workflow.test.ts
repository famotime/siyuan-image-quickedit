import { expect, test } from "vitest";

import { buildCompressionScaleSteps } from "../src/services/image-workflow.ts";

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
