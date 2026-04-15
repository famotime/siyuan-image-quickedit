import type { IProtyle } from "siyuan";

import { COMMAND_DEFINITIONS } from "@/core/command-meta.ts";
import {
  DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
  type CommandId,
  type SuperBlockMergeOptions,
} from "@/core/command-settings.ts";
import { buildImageInfoLabel, buildResultMarkdown } from "@/core/formatters.ts";
import { replaceImageSourceInMarkdown } from "@/core/image-markdown.ts";
import { loadDocumentEmbeddedAssetBytes } from "@/services/document-asset-stats.ts";
import {
  compareSatisfiedCandidates,
  type CompressionCandidate,
} from "@/services/compression-strategy.ts";
import { quantizeRgbaBufferToMaxColors } from "@/services/palette-quantization.ts";

export interface ImageTarget {
  alt: string;
  blockId: string;
  displayHeight: number;
  displayWidth: number;
  src: string;
}

export interface ImageMetadata {
  bytes: number;
  colorDepth: number;
  format: string;
  height: number;
  mimeType: string;
  width: number;
}

export interface PreparedImageResult {
  commandId: CommandId;
  commandLabel: string;
  fileName: string;
  original: ImageMetadata;
  output: {
    blob: Blob;
    bytes: number;
    format: string;
    height: number;
    width: number;
  };
}

export interface SuperBlockMergedImageResult {
  fileName: string;
  output: {
    blob: Blob;
    bytes: number;
    format: string;
    height: number;
    width: number;
  };
}

interface InspectedImageTarget {
  bitmap: ImageBitmap;
  displayScale: number;
  fileName: string;
  original: ImageMetadata;
}

interface RuntimeCompressionCandidate extends CompressionCandidate {
  blob: Blob;
}

const QUALITY_STEPS = [0.92, 0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3];
const PALETTE_COLOR_LIMITS = [256, 128, 64, 32, 16];
const MIN_COMPRESSION_QUALITY = 0.05;
const MAX_COMPRESSION_QUALITY = 0.98;
const QUALITY_SEARCH_ITERATIONS = 8;
const QUALITY_REFINEMENT_FACTORS = [0.25, 0.5, 0.75];

function clampScale(scale: number): number {
  return Math.min(1, Math.max(0.1, scale || 1));
}

function getImageElement(element: HTMLElement): HTMLImageElement | null {
  if (element instanceof HTMLImageElement) {
    return element;
  }

  return element.querySelector("img");
}

function getBlockElement(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>("[data-node-id]");
}

function normalizeUrl(src: string): URL {
  return new URL(src, location.origin);
}

function getFileNameFromSrc(src: string): string {
  const pathname = normalizeUrl(src).pathname;
  const fileName = decodeURIComponent(pathname.split("/").pop() || "image");
  return fileName || "image";
}

function getDisplayScale(target: ImageTarget, width: number, height: number): number {
  const widthRatio = target.displayWidth > 0 ? target.displayWidth / width : 1;
  const heightRatio = target.displayHeight > 0 ? target.displayHeight / height : 1;
  return clampScale(Math.min(widthRatio, heightRatio, 1));
}

async function fetchImageBlob(src: string): Promise<Blob> {
  const response = await fetch(normalizeUrl(src).href);
  if (!response.ok) {
    throw new Error(`无法读取图片资源：${response.status}`);
  }

  return response.blob();
}

async function detectColorDepth(bitmap: ImageBitmap, mimeType: string): Promise<number> {
  if (mimeType === "image/gif") {
    return 8;
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return 24;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.min(64, bitmap.width));
  canvas.height = Math.max(1, Math.min(64, bitmap.height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return 24;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < imageData.length; index += 4) {
    if (imageData[index] < 255) {
      return 32;
    }
  }

  return 24;
}

async function inspectImageTarget(target: ImageTarget): Promise<InspectedImageTarget> {
  const blob = await fetchImageBlob(target.src);
  const bitmap = await createImageBitmap(blob);
  const mimeType = blob.type || "image/png";
  const format = mimeType.split("/")[1]?.toLowerCase() || "png";
  const colorDepth = await detectColorDepth(bitmap, mimeType);

  return {
    bitmap,
    displayScale: getDisplayScale(target, bitmap.width, bitmap.height),
    fileName: getFileNameFromSrc(target.src),
    original: {
      bytes: blob.size,
      colorDepth,
      format,
      height: bitmap.height,
      mimeType,
      width: bitmap.width,
    },
  };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("无法导出处理后的图片。"));
        return;
      }

      resolve(blob);
    }, "image/webp", quality);
  });
}

async function renderCandidate(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
  maxColors?: number,
): Promise<Blob> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建图片处理画布。");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  if (maxColors) {
    const imageData = context.getImageData(0, 0, width, height);
    imageData.data.set(quantizeRgbaBufferToMaxColors(imageData.data, maxColors));
    context.putImageData(imageData, 0, 0);
  }

  return canvasToBlob(canvas, quality);
}

function normalizeQuality(quality: number): number {
  return Number(Math.min(MAX_COMPRESSION_QUALITY, Math.max(MIN_COMPRESSION_QUALITY, quality)).toFixed(3));
}

function toRuntimeCandidate(
  blob: Blob,
  width: number,
  height: number,
  quality: number,
  maxColors?: number,
): RuntimeCompressionCandidate {
  return {
    blob,
    bytes: blob.size,
    format: "webp",
    height,
    maxColors,
    quality,
    width,
  };
}

function pickSmallerCandidate(
  currentBest: RuntimeCompressionCandidate | null,
  candidate: RuntimeCompressionCandidate,
): RuntimeCompressionCandidate {
  if (!currentBest || candidate.bytes < currentBest.bytes) {
    return candidate;
  }

  return currentBest;
}

function pickBetterSatisfiedCandidate(
  currentBest: RuntimeCompressionCandidate | null,
  candidate: RuntimeCompressionCandidate,
  inspected: InspectedImageTarget,
  targetBytes: number,
): RuntimeCompressionCandidate {
  if (!currentBest) {
    return candidate;
  }

  return compareSatisfiedCandidates(candidate, currentBest, {
    originalHeight: inspected.original.height,
    originalWidth: inspected.original.width,
    targetBytes,
  }) > 0
    ? candidate
    : currentBest;
}

async function findBestCandidateForVariant(
  inspected: InspectedImageTarget,
  width: number,
  height: number,
  targetBytes: number,
  maxColors?: number,
): Promise<{
  bestOverall: RuntimeCompressionCandidate;
  bestWithinTarget: RuntimeCompressionCandidate | null;
}> {
  let bestOverall: RuntimeCompressionCandidate | null = null;
  let bestWithinTarget: RuntimeCompressionCandidate | null = null;
  const cache = new Map<number, RuntimeCompressionCandidate>();

  const evaluate = async (quality: number): Promise<RuntimeCompressionCandidate> => {
    const normalizedQuality = normalizeQuality(quality);
    const cached = cache.get(normalizedQuality);
    if (cached) {
      return cached;
    }

    const blob = await renderCandidate(inspected.bitmap, width, height, normalizedQuality, maxColors);
    const candidate = toRuntimeCandidate(blob, width, height, normalizedQuality, maxColors);
    cache.set(normalizedQuality, candidate);
    bestOverall = pickSmallerCandidate(bestOverall, candidate);

    if (candidate.bytes <= targetBytes) {
      bestWithinTarget = pickBetterSatisfiedCandidate(bestWithinTarget, candidate, inspected, targetBytes);
    }

    return candidate;
  };

  const highestQualityCandidate = await evaluate(MAX_COMPRESSION_QUALITY);
  if (highestQualityCandidate.bytes <= targetBytes) {
    return {
      bestOverall: bestOverall!,
      bestWithinTarget,
    };
  }

  const lowestQualityCandidate = await evaluate(MIN_COMPRESSION_QUALITY);
  if (lowestQualityCandidate.bytes > targetBytes) {
    return {
      bestOverall: bestOverall!,
      bestWithinTarget: null,
    };
  }

  let lowerBound = MIN_COMPRESSION_QUALITY;
  let upperBound = MAX_COMPRESSION_QUALITY;

  for (let iteration = 0; iteration < QUALITY_SEARCH_ITERATIONS; iteration += 1) {
    const midpoint = normalizeQuality((lowerBound + upperBound) / 2);
    if (midpoint <= lowerBound || midpoint >= upperBound) {
      break;
    }

    const candidate = await evaluate(midpoint);
    if (candidate.bytes <= targetBytes) {
      lowerBound = midpoint;
    }
    else {
      upperBound = midpoint;
    }
  }

  for (const factor of QUALITY_REFINEMENT_FACTORS) {
    const quality = normalizeQuality(lowerBound + (upperBound - lowerBound) * factor);
    if (quality > lowerBound && quality < upperBound) {
      await evaluate(quality);
    }
  }

  return {
    bestOverall: bestOverall!,
    bestWithinTarget,
  };
}

export function buildCompressionScaleSteps(baseScale: number): number[] {
  const normalizedBaseScale = clampScale(baseScale);
  const steps = [
    1,
    normalizedBaseScale,
    normalizedBaseScale * 0.9,
    normalizedBaseScale * 0.8,
    normalizedBaseScale * 0.7,
    normalizedBaseScale * 0.6,
    normalizedBaseScale * 0.5,
    normalizedBaseScale * 0.4,
    normalizedBaseScale * 0.3,
    normalizedBaseScale * 0.2,
  ].map(clampScale);

  return [...new Set(steps)];
}

async function convertToWebp(inspected: InspectedImageTarget): Promise<PreparedImageResult["output"]> {
  let bestBlob: Blob | null = null;
  let bestQuality = QUALITY_STEPS[0];

  for (const quality of QUALITY_STEPS.slice(0, 4)) {
    const blob = await renderCandidate(
      inspected.bitmap,
      inspected.original.width,
      inspected.original.height,
      quality,
    );
    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
      bestQuality = quality;
    }

    if (blob.size <= inspected.original.bytes) {
      bestBlob = blob;
      bestQuality = quality;
      break;
    }
  }

  const blob = bestBlob || await renderCandidate(
    inspected.bitmap,
    inspected.original.width,
    inspected.original.height,
    bestQuality,
  );

  return {
    blob,
    bytes: blob.size,
    format: "webp",
    height: inspected.original.height,
    width: inspected.original.width,
  };
}

async function compressToTargetRatio(
  inspected: InspectedImageTarget,
  commandId: CommandId,
  onProgress?: (message: string) => void,
): Promise<PreparedImageResult["output"]> {
  const command = COMMAND_DEFINITIONS[commandId];
  const targetRatio = command.targetRatio;
  if (!targetRatio) {
    throw new Error(`命令 ${commandId} 没有目标压缩比例。`);
  }

  const targetBytes = Math.max(1, Math.floor(inspected.original.bytes * targetRatio));
  let bestOverallCandidate: RuntimeCompressionCandidate | null = null;
  let bestWithinTargetCandidate: RuntimeCompressionCandidate | null = null;

  for (const scale of buildCompressionScaleSteps(inspected.displayScale)) {
    const width = Math.max(1, Math.round(inspected.original.width * scale));
    const height = Math.max(1, Math.round(inspected.original.height * scale));
    onProgress?.(`正在尝试 ${width}×${height}`);

    const fullColorResult = await findBestCandidateForVariant(
      inspected,
      width,
      height,
      targetBytes,
    );
    bestOverallCandidate = pickSmallerCandidate(bestOverallCandidate, fullColorResult.bestOverall);
    if (fullColorResult.bestWithinTarget) {
      bestWithinTargetCandidate = pickBetterSatisfiedCandidate(
        bestWithinTargetCandidate,
        fullColorResult.bestWithinTarget,
        inspected,
        targetBytes,
      );
    }

    for (const maxColors of PALETTE_COLOR_LIMITS) {
      onProgress?.(`正在尝试 ${width}×${height} / ${maxColors} 色`);
      const paletteResult = await findBestCandidateForVariant(
        inspected,
        width,
        height,
        targetBytes,
        maxColors,
      );
      bestOverallCandidate = pickSmallerCandidate(bestOverallCandidate, paletteResult.bestOverall);
      if (paletteResult.bestWithinTarget) {
        bestWithinTargetCandidate = pickBetterSatisfiedCandidate(
          bestWithinTargetCandidate,
          paletteResult.bestWithinTarget,
          inspected,
          targetBytes,
        );
      }
    }
  }

  if (bestWithinTargetCandidate) {
    return {
      blob: bestWithinTargetCandidate.blob,
      bytes: bestWithinTargetCandidate.bytes,
      format: bestWithinTargetCandidate.format,
      height: bestWithinTargetCandidate.height,
      width: bestWithinTargetCandidate.width,
    };
  }

  if (!bestOverallCandidate) {
    throw new Error("无法生成压缩结果。");
  }

  return {
    blob: bestOverallCandidate.blob,
    bytes: bestOverallCandidate.bytes,
    format: bestOverallCandidate.format,
    height: bestOverallCandidate.height,
    width: bestOverallCandidate.width,
  };
}

export function resolveImageTarget(element: HTMLElement): ImageTarget | null {
  const imageElement = getImageElement(element);
  if (!imageElement) {
    return null;
  }

  const blockElement = getBlockElement(imageElement);
  const blockId = blockElement?.dataset.nodeId;
  if (!blockId) {
    return null;
  }

  const rect = imageElement.getBoundingClientRect();

  return {
    alt: imageElement.getAttribute("alt") || "processed image",
    blockId,
    displayHeight: rect.height || imageElement.clientHeight || imageElement.naturalHeight || 0,
    displayWidth: rect.width || imageElement.clientWidth || imageElement.naturalWidth || 0,
    src: imageElement.dataset.src || imageElement.getAttribute("src") || imageElement.currentSrc || imageElement.src,
  };
}

export function resolveImageTargetFromBlockElements(blockElements: HTMLElement[]): ImageTarget | null {
  for (const blockElement of blockElements) {
    const imageElement = blockElement.querySelector("img");
    if (imageElement) {
      return resolveImageTarget(imageElement);
    }
  }

  return null;
}

export function collectImageTargets(protyle: IProtyle): ImageTarget[] {
  const container = protyle.contentElement || protyle.element;
  const imageElements = Array.from(container.querySelectorAll("img"));
  const seen = new Set<string>();

  return imageElements
    .map(imageElement => resolveImageTarget(imageElement))
    .filter((target): target is ImageTarget => Boolean(target))
    .filter((target) => {
      const key = `${target.blockId}|${target.src}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export function collectSuperBlockImageTargets(superBlockElement: HTMLElement): ImageTarget[] {
  const imageElements = Array.from(superBlockElement.querySelectorAll("img"));
  const seen = new Set<string>();

  return imageElements
    .map(imageElement => resolveImageTarget(imageElement))
    .filter((target): target is ImageTarget => Boolean(target))
    .filter((target) => {
      const key = `${target.blockId}|${target.src}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export async function mergeBitmapsHorizontallyTopAligned(
  bitmaps: ImageBitmap[],
  options: SuperBlockMergeOptions = DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
): Promise<{ blob: Blob; height: number; width: number }> {
  const resolvedOptions = {
    ...DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
    ...options,
  };
  const width = bitmaps.reduce((total, bitmap, index) => {
    return total
      + bitmap.width
      + resolvedOptions.borderWidthPx * 2
      + (index > 0 ? resolvedOptions.gapPx : 0);
  }, 0);
  const height = bitmaps.reduce((max, bitmap) => {
    return Math.max(max, bitmap.height + resolvedOptions.borderWidthPx * 2);
  }, 0);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建图片处理画布。");
  }

  let offsetX = 0;
  for (const bitmap of bitmaps) {
    const outerWidth = bitmap.width + resolvedOptions.borderWidthPx * 2;
    const outerHeight = bitmap.height + resolvedOptions.borderWidthPx * 2;

    if (resolvedOptions.borderWidthPx > 0) {
      context.fillStyle = resolvedOptions.borderColor;
      context.fillRect(offsetX, 0, outerWidth, outerHeight);
    }

    context.drawImage(
      bitmap,
      offsetX + resolvedOptions.borderWidthPx,
      resolvedOptions.borderWidthPx,
      bitmap.width,
      bitmap.height,
    );
    offsetX += outerWidth + resolvedOptions.gapPx;
  }

  return {
    blob: await canvasToBlob(canvas, QUALITY_STEPS[0]),
    height,
    width,
  };
}

export async function mergeSuperBlockImages(
  targets: ImageTarget[],
  options: SuperBlockMergeOptions = DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
): Promise<SuperBlockMergedImageResult> {
  if (targets.length < 2) {
    throw new Error("超级块中至少需要两张图片才能合并。");
  }

  const bitmaps: ImageBitmap[] = [];
  try {
    for (const target of targets) {
      const blob = await fetchImageBlob(target.src);
      const bitmap = await createImageBitmap(blob);
      bitmaps.push(bitmap);
    }

    const merged = await mergeBitmapsHorizontallyTopAligned(bitmaps, options);

    return {
      fileName: `superblock-merge-${Date.now()}.webp`,
      output: {
        blob: merged.blob,
        bytes: merged.blob.size,
        format: "webp",
        height: merged.height,
        width: merged.width,
      },
    };
  }
  finally {
    for (const bitmap of bitmaps) {
      bitmap.close();
    }
  }
}

export async function buildImageInfoForTarget(target: ImageTarget): Promise<string> {
  const inspected = await inspectImageTarget(target);
  try {
    const block = await resolveBlockForTarget(target.blockId);
    const documentEmbeddedAssetBytes = await loadDocumentEmbeddedAssetBytes(block?.root_id || target.blockId);

    return buildImageInfoLabel({
      documentEmbeddedAssetBytes,
      imageInfo: inspected.original,
    });
  }
  finally {
    inspected.bitmap.close();
  }
}

async function resolveBlockForTarget(blockId: string): Promise<Pick<Block, "id" | "root_id"> | null> {
  const kernel = await import("@/services/kernel.ts");
  return kernel.getBlockById(blockId);
}

export async function prepareProcessedImage(
  target: ImageTarget,
  commandId: CommandId,
  onProgress?: (message: string) => void,
): Promise<PreparedImageResult> {
  const inspected = await inspectImageTarget(target);

  try {
    const output = commandId === "convert-webp"
      ? await convertToWebp(inspected)
      : await compressToTargetRatio(inspected, commandId, onProgress);
    const sourceBaseName = inspected.fileName.replace(/\.[^.]+$/, "") || inspected.fileName;

    return {
      commandId,
      commandLabel: COMMAND_DEFINITIONS[commandId].label,
      fileName: `${sourceBaseName}.quickedit-${commandId}-${Date.now()}.webp`,
      original: inspected.original,
      output,
    };
  }
  finally {
    inspected.bitmap.close();
  }
}

export function buildProcessedResultMarkdown(prepared: PreparedImageResult, assetPath: string): string {
  return buildResultMarkdown({
    commandLabel: prepared.commandLabel,
    original: prepared.original,
    output: {
      assetPath,
      bytes: prepared.output.bytes,
      format: prepared.output.format,
      height: prepared.output.height,
      width: prepared.output.width,
    },
  });
}

export function buildReplacedBlockMarkdown(blockMarkdown: string, target: ImageTarget, assetPath: string): string {
  return replaceImageSourceInMarkdown(blockMarkdown, target.src, assetPath);
}
