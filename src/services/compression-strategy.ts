export interface CompressionCandidate {
  bytes: number;
  format: string;
  height: number;
  maxColors?: number;
  quality: number;
  width: number;
}

interface CompressionScoreContext {
  originalHeight: number;
  originalWidth: number;
  targetBytes: number;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getResolutionScore(
  candidate: CompressionCandidate,
  context: CompressionScoreContext,
): number {
  const widthRatio = context.originalWidth > 0 ? candidate.width / context.originalWidth : 1;
  const heightRatio = context.originalHeight > 0 ? candidate.height / context.originalHeight : 1;
  return clampUnit(widthRatio) * clampUnit(heightRatio);
}

function getPaletteScore(candidate: CompressionCandidate): number {
  if (!candidate.maxColors) {
    return 1;
  }

  return clampUnit(Math.log2(Math.max(1, candidate.maxColors)) / 8);
}

function getQualityScore(candidate: CompressionCandidate): number {
  return clampUnit(candidate.quality);
}

function getSizeUtilizationScore(
  candidate: CompressionCandidate,
  context: CompressionScoreContext,
): number {
  if (context.targetBytes <= 0) {
    return 0;
  }

  return clampUnit(candidate.bytes / context.targetBytes);
}

export function scoreSatisfiedCandidate(
  candidate: CompressionCandidate,
  context: CompressionScoreContext,
): number {
  const resolutionScore = getResolutionScore(candidate, context);
  const paletteScore = getPaletteScore(candidate);
  const qualityScore = getQualityScore(candidate);
  const sizeUtilizationScore = getSizeUtilizationScore(candidate, context);

  return (
    resolutionScore * 0.55
    + paletteScore * 0.2
    + qualityScore * 0.2
    + sizeUtilizationScore * 0.05
  );
}

export function compareSatisfiedCandidates(
  left: CompressionCandidate,
  right: CompressionCandidate,
  context: CompressionScoreContext,
): number {
  return scoreSatisfiedCandidate(left, context) - scoreSatisfiedCandidate(right, context);
}
