import { expect, test } from "vitest";

import {
  compareSatisfiedCandidates,
  scoreSatisfiedCandidate,
  type CompressionCandidate,
} from "../src/services/compression-strategy.ts";

const CONTEXT = {
  originalHeight: 1000,
  originalWidth: 1000,
  targetBytes: 750_000,
};

function buildCandidate(input: Partial<CompressionCandidate>): CompressionCandidate {
  return {
    bytes: 700_000,
    format: "webp",
    height: 1000,
    maxColors: undefined,
    quality: 0.7,
    width: 1000,
    ...input,
  };
}

test("scoreSatisfiedCandidate prefers preserving original resolution when both candidates fit", () => {
  const originalResolution = buildCandidate({
    bytes: 680_000,
    quality: 0.66,
  });
  const downscaled = buildCandidate({
    bytes: 735_000,
    height: 700,
    quality: 0.9,
    width: 700,
  });

  expect(scoreSatisfiedCandidate(originalResolution, CONTEXT)).toBeGreaterThan(scoreSatisfiedCandidate(downscaled, CONTEXT));
  expect(compareSatisfiedCandidates(originalResolution, downscaled, CONTEXT)).toBeGreaterThan(0);
});

test("scoreSatisfiedCandidate prefers richer colors over aggressive palette reduction at same size tier", () => {
  const fullColor = buildCandidate({
    bytes: 710_000,
    quality: 0.68,
  });
  const paletteReduced = buildCandidate({
    bytes: 725_000,
    maxColors: 32,
    quality: 0.82,
  });

  expect(scoreSatisfiedCandidate(fullColor, CONTEXT)).toBeGreaterThan(scoreSatisfiedCandidate(paletteReduced, CONTEXT));
  expect(compareSatisfiedCandidates(fullColor, paletteReduced, CONTEXT)).toBeGreaterThan(0);
});

test("scoreSatisfiedCandidate prefers higher encoding quality when resolution and palette are equal", () => {
  const higherQuality = buildCandidate({
    bytes: 740_000,
    quality: 0.82,
  });
  const lowerQuality = buildCandidate({
    bytes: 690_000,
    quality: 0.58,
  });

  expect(scoreSatisfiedCandidate(higherQuality, CONTEXT)).toBeGreaterThan(scoreSatisfiedCandidate(lowerQuality, CONTEXT));
  expect(compareSatisfiedCandidates(higherQuality, lowerQuality, CONTEXT)).toBeGreaterThan(0);
});
