import type { IProtyle } from "siyuan";

import { COMMAND_DEFINITIONS } from "@/core/command-meta.ts";
import {
  DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
  type CommandId,
  type CompressionStrategy,
  type SuperBlockMergeOptions,
} from "@/core/command-settings.ts";
import { buildImageInfoLabel, buildResultMarkdown } from "@/core/formatters.ts";
import { replaceImageSourceInMarkdown } from "@/core/image-markdown.ts";
import { loadDocumentEmbeddedAssetBytes } from "@/services/document-asset-stats.ts";
import {
  compareSatisfiedCandidates,
  type CompressionCandidate,
} from "@/services/compression-strategy.ts";
import { getBlockById } from "@/services/kernel.ts";
import { getDocBlockMarkdowns } from "@/services/kernel-query.ts";
import { quantizeRgbaBufferToMaxColors } from "@/services/palette-quantization.ts";

export interface ImageTarget {
  alt: string;
  blockId: string;
  displayHeight: number;
  displayWidth: number;
  src: string;
  targetWidth?: number;
}

export interface MergeBitmapInput {
  bitmap: ImageBitmap;
  targetWidth?: number;
}

export interface ImageMetadata {
  bytes: number;
  colorDepth: number;
  format: string;
  height: number;
  mimeType: string;
  width: number;
}

export interface ProcessedImageOutput {
  blob: Blob;
  bytes: number;
  format: string;
  height: number;
  width: number;
}

export interface GeneratedImageResult {
  commandLabel: string;
  fileName: string;
  original: ImageMetadata;
  output: ProcessedImageOutput;
}

export interface PreparedImageResult extends GeneratedImageResult {
  commandId: CommandId;
}

export interface SuperBlockMergedImageResult {
  fileName: string;
  output: ProcessedImageOutput;
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
const QUALITY_CONVERGENCE_THRESHOLD = 0.02;
const QUALITY_SEARCH_SAFETY_LIMIT = 8;
const QUALITY_REFINEMENT_FACTORS = [0.25, 0.5, 0.75];
const ADD_BORDER_COMMAND_LABEL = "添加图像边框";
const MAX_NATURAL_WIDTH = 1920;

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

function prepareVariantCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  maxColors?: number,
): HTMLCanvasElement {
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

  return canvas;
}

function encodeCanvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
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

function getInitialQualityGuess(targetRatio: number): number {
  if (targetRatio <= 0.15) {
    return 0.3;
  }

  if (targetRatio <= 0.35) {
    return 0.5;
  }

  if (targetRatio <= 0.55) {
    return 0.7;
  }

  return 0.85;
}

async function findBestCandidateForVariant(
  inspected: InspectedImageTarget,
  width: number,
  height: number,
  targetBytes: number,
  canvasCache: Map<string, HTMLCanvasElement>,
  targetRatio: number,
  maxColors?: number,
): Promise<{
  bestOverall: RuntimeCompressionCandidate;
  bestWithinTarget: RuntimeCompressionCandidate | null;
}> {
  let bestOverall: RuntimeCompressionCandidate | null = null;
  let bestWithinTarget: RuntimeCompressionCandidate | null = null;
  const candidateCache = new Map<number, RuntimeCompressionCandidate>();

  const evaluate = async (quality: number): Promise<RuntimeCompressionCandidate> => {
    const normalizedQuality = normalizeQuality(quality);
    const cached = candidateCache.get(normalizedQuality);
    if (cached) {
      return cached;
    }

    const cacheKey = `${width}x${height}x${maxColors ?? 0}`;
    let canvas = canvasCache.get(cacheKey);
    if (!canvas) {
      canvas = prepareVariantCanvas(inspected.bitmap, width, height, maxColors);
      canvasCache.set(cacheKey, canvas);
    }

    const blob = await encodeCanvasToBlob(canvas, normalizedQuality);
    const candidate = toRuntimeCandidate(blob, width, height, normalizedQuality, maxColors);
    candidateCache.set(normalizedQuality, candidate);
    bestOverall = pickSmallerCandidate(bestOverall, candidate);

    if (candidate.bytes <= targetBytes) {
      bestWithinTarget = pickBetterSatisfiedCandidate(bestWithinTarget, candidate, inspected, targetBytes);
    }

    return candidate;
  };

  const initialGuess = getInitialQualityGuess(targetRatio);
  const smartGuessCandidate = await evaluate(initialGuess);

  if (smartGuessCandidate.bytes <= targetBytes) {
    let lowerBound = initialGuess;
    let upperBound = MAX_COMPRESSION_QUALITY;

    for (let iteration = 0; iteration < QUALITY_SEARCH_SAFETY_LIMIT; iteration += 1) {
      if (upperBound - lowerBound < QUALITY_CONVERGENCE_THRESHOLD) {
        break;
      }

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
  }
  else {
    let lowerBound = MIN_COMPRESSION_QUALITY;
    let upperBound = initialGuess;

    for (let iteration = 0; iteration < QUALITY_SEARCH_SAFETY_LIMIT; iteration += 1) {
      if (upperBound - lowerBound < QUALITY_CONVERGENCE_THRESHOLD) {
        break;
      }

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
  }

  return {
    bestOverall: bestOverall!,
    bestWithinTarget,
  };
}

export function buildCompressionScaleSteps(baseScale: number, originalWidth?: number): number[] {
  const normalizedBaseScale = clampScale(baseScale);
  const naturalScale = originalWidth && originalWidth > MAX_NATURAL_WIDTH
    ? clampScale(MAX_NATURAL_WIDTH / originalWidth)
    : 1;
  const effectiveBaseScale = Math.min(normalizedBaseScale, naturalScale);
  const steps = [
    naturalScale,
    effectiveBaseScale,
    effectiveBaseScale * 0.9,
    effectiveBaseScale * 0.8,
    effectiveBaseScale * 0.7,
    effectiveBaseScale * 0.6,
    effectiveBaseScale * 0.5,
    effectiveBaseScale * 0.4,
    effectiveBaseScale * 0.3,
    effectiveBaseScale * 0.2,
  ].map(clampScale);

  return [...new Set(steps)];
}

async function convertToWebp(inspected: InspectedImageTarget): Promise<PreparedImageResult["output"]> {
  const naturalScale = inspected.original.width > MAX_NATURAL_WIDTH
    ? clampScale(MAX_NATURAL_WIDTH / inspected.original.width)
    : 1;
  const width = Math.round(inspected.original.width * naturalScale);
  const height = Math.round(inspected.original.height * naturalScale);
  const canvas = prepareVariantCanvas(inspected.bitmap, width, height);

  let bestBlob: Blob | null = null;
  let bestQuality = QUALITY_STEPS[0];

  for (const quality of QUALITY_STEPS.slice(0, 4)) {
    const blob = await encodeCanvasToBlob(canvas, quality);
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

  const blob = bestBlob || await encodeCanvasToBlob(canvas, bestQuality);

  return {
    blob,
    bytes: blob.size,
    format: "webp",
    height,
    width,
  };
}

function candidateToOutput(candidate: RuntimeCompressionCandidate): PreparedImageResult["output"] {
  return {
    blob: candidate.blob,
    bytes: candidate.bytes,
    format: candidate.format,
    height: candidate.height,
    width: candidate.width,
  };
}

async function compressComprehensive(
  inspected: InspectedImageTarget,
  targetBytes: number,
  targetRatio: number,
  canvasCache: Map<string, HTMLCanvasElement>,
  onProgress?: (message: string) => void,
): Promise<PreparedImageResult["output"]> {
  let bestOverallCandidate: RuntimeCompressionCandidate | null = null;
  let bestWithinTargetCandidate: RuntimeCompressionCandidate | null = null;

  for (const scale of buildCompressionScaleSteps(inspected.displayScale, inspected.original.width)) {
    const width = Math.max(1, Math.round(inspected.original.width * scale));
    const height = Math.max(1, Math.round(inspected.original.height * scale));
    onProgress?.(`正在尝试 ${width}×${height}`);

    const fullColorResult = await findBestCandidateForVariant(
      inspected,
      width,
      height,
      targetBytes,
      canvasCache,
      targetRatio,
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
        canvasCache,
        targetRatio,
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
    return candidateToOutput(bestWithinTargetCandidate);
  }

  if (!bestOverallCandidate) {
    throw new Error("无法生成压缩结果。");
  }

  return candidateToOutput(bestOverallCandidate);
}

async function compressResolutionFirst(
  inspected: InspectedImageTarget,
  targetBytes: number,
  targetRatio: number,
  canvasCache: Map<string, HTMLCanvasElement>,
  onProgress?: (message: string) => void,
): Promise<RuntimeCompressionCandidate | null> {
  for (const scale of buildCompressionScaleSteps(inspected.displayScale, inspected.original.width)) {
    const width = Math.max(1, Math.round(inspected.original.width * scale));
    const height = Math.max(1, Math.round(inspected.original.height * scale));
    onProgress?.(`正在尝试 ${width}×${height}（保持原色）`);

    const result = await findBestCandidateForVariant(
      inspected,
      width,
      height,
      targetBytes,
      canvasCache,
      targetRatio,
    );

    if (result.bestWithinTarget) {
      return result.bestWithinTarget;
    }
  }

  return null;
}

async function compressColorFirst(
  inspected: InspectedImageTarget,
  targetBytes: number,
  targetRatio: number,
  canvasCache: Map<string, HTMLCanvasElement>,
  onProgress?: (message: string) => void,
): Promise<RuntimeCompressionCandidate | null> {
  const scales = buildCompressionScaleSteps(inspected.displayScale, inspected.original.width);
  const bestScale = scales[0];
  const width = Math.max(1, Math.round(inspected.original.width * bestScale));
  const height = Math.max(1, Math.round(inspected.original.height * bestScale));

  for (const maxColors of PALETTE_COLOR_LIMITS) {
    onProgress?.(`正在尝试 ${width}×${height} / ${maxColors} 色`);
    const result = await findBestCandidateForVariant(
      inspected,
      width,
      height,
      targetBytes,
      canvasCache,
      targetRatio,
      maxColors,
    );
    if (result.bestWithinTarget) {
      return result.bestWithinTarget;
    }
  }

  for (const scale of scales.slice(1)) {
    const w = Math.max(1, Math.round(inspected.original.width * scale));
    const h = Math.max(1, Math.round(inspected.original.height * scale));
    onProgress?.(`正在尝试 ${w}×${h}（保持原色）`);
    const result = await findBestCandidateForVariant(
      inspected,
      w,
      h,
      targetBytes,
      canvasCache,
      targetRatio,
    );
    if (result.bestWithinTarget) {
      return result.bestWithinTarget;
    }
  }

  return null;
}

async function compressToTargetRatio(
  inspected: InspectedImageTarget,
  commandId: CommandId,
  strategy: CompressionStrategy,
  onProgress?: (message: string) => void,
): Promise<PreparedImageResult["output"]> {
  const command = COMMAND_DEFINITIONS[commandId];
  const targetRatio = command.targetRatio;
  if (!targetRatio) {
    throw new Error(`命令 ${commandId} 没有目标压缩比例。`);
  }

  const targetBytes = Math.max(1, Math.floor(inspected.original.bytes * targetRatio));
  const canvasCache = new Map<string, HTMLCanvasElement>();

  if (strategy === "resolution-first") {
    const fastResult = await compressResolutionFirst(inspected, targetBytes, targetRatio, canvasCache, onProgress);
    if (fastResult) {
      return candidateToOutput(fastResult);
    }

    onProgress?.("分辨率优先未满足要求，尝试综合压缩…");
  }
  else if (strategy === "color-first") {
    const fastResult = await compressColorFirst(inspected, targetBytes, targetRatio, canvasCache, onProgress);
    if (fastResult) {
      return candidateToOutput(fastResult);
    }

    onProgress?.("颜色优先未满足要求，尝试综合压缩…");
  }

  return compressComprehensive(inspected, targetBytes, targetRatio, canvasCache, onProgress);
}

export function parseExplicitWidthPx(imageElement: HTMLElement): number | undefined {
  const checkWidthString = (styleStr: string | null | undefined): number | undefined => {
    if (!styleStr) return undefined;
    const match = styleStr.match(/(?:^|;|\s)width\s*:\s*([\d.]+)px/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) {
        return Math.round(val);
      }
    }
    return undefined;
  };

  const imgStyleAttr = imageElement.getAttribute("style") || imageElement.style?.cssText;
  const imgWidth = checkWidthString(imgStyleAttr);
  if (imgWidth) return imgWidth;

  const parent = imageElement.parentElement;
  if (parent) {
    const parentStyleAttr = parent.getAttribute("style") || parent.style?.cssText;
    const parentWidth = checkWidthString(parentStyleAttr);
    if (parentWidth) return parentWidth;
  }

  const imgSpan = imageElement.closest('span[data-type="img"]') || imageElement.closest(".img");
  if (imgSpan) {
    const innerSpans = Array.from(imgSpan.querySelectorAll("span[style]"));
    for (const span of innerSpans) {
      const w = checkWidthString(span.getAttribute("style") || (span as HTMLElement).style?.cssText);
      if (w) return w;
    }
    const spanWidth = checkWidthString(imgSpan.getAttribute("style") || (imgSpan as HTMLElement).style?.cssText);
    if (spanWidth) return spanWidth;
  }

  return undefined;
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
  const targetWidth = parseExplicitWidthPx(imageElement);

  return {
    alt: imageElement.getAttribute("alt") || "processed image",
    blockId,
    displayHeight: rect.height || imageElement.clientHeight || imageElement.naturalHeight || 0,
    displayWidth: rect.width || imageElement.clientWidth || imageElement.naturalWidth || 0,
    src: imageElement.dataset.src || imageElement.getAttribute("src") || imageElement.currentSrc || imageElement.src,
    targetWidth,
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

function extractImageSrcsFromMarkdown(markdown: string): string[] {
  const sources: string[] = [];

  const mdRegex = /!\[[^\]]*\]\((<[^>]+>|[^)\s]+)([^)]*)\)/g;
  let match = mdRegex.exec(markdown);
  while (match) {
    sources.push(match[1].replace(/^<|>$/g, ""));
    match = mdRegex.exec(markdown);
  }

  if (sources.length > 0) {
    return sources;
  }

  const htmlRegex = /<img\b[^>]*?\ssrc=["']([^"']+)["'][^>]*>/gi;
  match = htmlRegex.exec(markdown);
  while (match) {
    sources.push(match[1]);
    match = htmlRegex.exec(markdown);
  }

  return sources;
}

export async function collectImageTargetsByDocId(docId: string): Promise<ImageTarget[]> {
  const blocks = await getDocBlockMarkdowns(docId);
  console.log(`[image-quickedit] collectImageTargetsByDocId: docId=${docId}, blocks=${blocks.length}`);
  const seen = new Set<string>();
  const targets: ImageTarget[] = [];

  let blocksWithMarkdown = 0;
  let totalSrcs = 0;
  let nonAssetSrcs = 0;

  for (const block of blocks) {
    if (!block.markdown) continue;
    blocksWithMarkdown++;
    const srcs = extractImageSrcsFromMarkdown(block.markdown);
    totalSrcs += srcs.length;
    for (const src of srcs) {
      const normalizedSrc = src.startsWith("/") ? src : `/${src}`;
      if (!normalizedSrc.startsWith("/assets/")) {
        nonAssetSrcs++;
        console.log(`[image-quickedit] skipping non-asset src: ${src}`);
        continue;
      }
      const key = `${block.id}|${normalizedSrc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({
        alt: "processed image",
        blockId: block.id,
        displayHeight: 0,
        displayWidth: 0,
        src: normalizedSrc,
      });
    }
  }

  console.log(`[image-quickedit] collectImageTargetsByDocId result: blocksWithMarkdown=${blocksWithMarkdown}, totalSrcs=${totalSrcs}, nonAssetSrcs=${nonAssetSrcs}, targets=${targets.length}`);
  return targets;
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
  bitmaps: (ImageBitmap | MergeBitmapInput)[],
  options: SuperBlockMergeOptions = DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
): Promise<{ blob: Blob; height: number; width: number }> {
  const resolvedOptions = {
    ...DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
    ...options,
  };

  const items = bitmaps.map((item) => {
    if ("bitmap" in item && item.bitmap) {
      const bitmap = item.bitmap;
      const targetWidth = item.targetWidth;
      const hasTargetWidth = Boolean(targetWidth && targetWidth > 0 && targetWidth !== bitmap.width);
      const renderWidth = hasTargetWidth ? (targetWidth as number) : bitmap.width;
      const renderHeight = hasTargetWidth
        ? Math.round(bitmap.height * ((targetWidth as number) / bitmap.width))
        : bitmap.height;

      return {
        bitmap,
        renderHeight,
        renderWidth,
      };
    }

    const bitmap = item as ImageBitmap;
    return {
      bitmap,
      renderHeight: bitmap.height,
      renderWidth: bitmap.width,
    };
  });

  const width = items.reduce((total, item, index) => {
    return total
      + item.renderWidth
      + resolvedOptions.borderWidthPx * 2
      + (index > 0 ? resolvedOptions.gapPx : 0);
  }, 0);

  const minHeight = items.length > 0
    ? Math.min(...items.map(item => item.renderHeight))
    : 0;

  const height = resolvedOptions.cropToSameHeight
    ? minHeight + resolvedOptions.borderWidthPx * 2
    : items.reduce((max, item) => {
        return Math.max(max, item.renderHeight + resolvedOptions.borderWidthPx * 2);
      }, 0);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建图片处理画布。");
  }

  let offsetX = 0;
  for (const item of items) {
    const { bitmap, renderHeight, renderWidth } = item;
    const outerWidth = renderWidth + resolvedOptions.borderWidthPx * 2;
    const outerHeight = resolvedOptions.cropToSameHeight
      ? minHeight + resolvedOptions.borderWidthPx * 2
      : renderHeight + resolvedOptions.borderWidthPx * 2;

    if (resolvedOptions.borderWidthPx > 0) {
      context.fillStyle = resolvedOptions.borderColor;
      context.fillRect(offsetX, 0, outerWidth, outerHeight);
    }

    if (resolvedOptions.cropToSameHeight) {
      const sourceCropHeight = Math.round(minHeight * (bitmap.height / renderHeight));
      context.drawImage(
        bitmap,
        0,
        0,
        bitmap.width,
        sourceCropHeight,
        offsetX + resolvedOptions.borderWidthPx,
        resolvedOptions.borderWidthPx,
        renderWidth,
        minHeight,
      );
    } else {
      context.drawImage(
        bitmap,
        0,
        0,
        bitmap.width,
        bitmap.height,
        offsetX + resolvedOptions.borderWidthPx,
        resolvedOptions.borderWidthPx,
        renderWidth,
        renderHeight,
      );
    }
    offsetX += outerWidth + resolvedOptions.gapPx;
  }

  return {
    blob: await canvasToBlob(canvas, QUALITY_STEPS[0]),
    height,
    width,
  };
}

export async function addBorderToBitmap(
  bitmap: ImageBitmap,
  options: SuperBlockMergeOptions = DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
): Promise<{ blob: Blob; height: number; width: number }> {
  return mergeBitmapsHorizontallyTopAligned([bitmap], options);
}

export async function mergeSuperBlockImages(
  targets: ImageTarget[],
  options: SuperBlockMergeOptions = DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
): Promise<SuperBlockMergedImageResult> {
  if (targets.length < 2) {
    throw new Error("超级块中至少需要两张图片才能合并。");
  }

  const items: MergeBitmapInput[] = [];
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const target of targets) {
      const blob = await fetchImageBlob(target.src);
      const bitmap = await createImageBitmap(blob);
      bitmaps.push(bitmap);
      items.push({
        bitmap,
        targetWidth: target.targetWidth,
      });
    }

    const merged = await mergeBitmapsHorizontallyTopAligned(items, options);

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

export async function addBorderToImageTarget(
  target: ImageTarget,
  options: SuperBlockMergeOptions = DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
): Promise<GeneratedImageResult> {
  const inspected = await inspectImageTarget(target);

  try {
    const output = await addBorderToBitmap(inspected.bitmap, options);
    const sourceBaseName = inspected.fileName.replace(/\.[^.]+$/, "") || inspected.fileName;

    return {
      commandLabel: ADD_BORDER_COMMAND_LABEL,
      fileName: `${sourceBaseName}.quickedit-add-border-${Date.now()}.webp`,
      original: inspected.original,
      output: {
        blob: output.blob,
        bytes: output.blob.size,
        format: "webp",
        height: output.height,
        width: output.width,
      },
    };
  }
  finally {
    inspected.bitmap.close();
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
  return getBlockById(blockId);
}

export async function prepareProcessedImage(
  target: ImageTarget,
  commandId: CommandId,
  strategy: CompressionStrategy,
  onProgress?: (message: string) => void,
): Promise<PreparedImageResult> {
  const inspected = await inspectImageTarget(target);

  try {
    const output = commandId === "convert-webp"
      ? await convertToWebp(inspected)
      : await compressToTargetRatio(inspected, commandId, strategy, onProgress);
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

export function buildProcessedResultMarkdown(prepared: GeneratedImageResult, assetPath: string): string {
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
