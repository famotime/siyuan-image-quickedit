interface ImageInfo {
  bytes: number;
  colorDepth?: number;
  height: number;
  width: number;
}

interface ResultMarkdownInput {
  commandLabel: string;
  original: ImageInfo;
  output: ImageInfo & {
    assetPath: string;
    format: string;
  };
}

interface BatchResultMessageInput {
  failureCount: number;
  mode: "insert" | "replace";
  processedCount: number;
  savedBytes: number;
  successCount: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) {
    return "0.00";
  }

  return (width / height).toFixed(2);
}

function formatReduction(originalValue: number, outputValue: number): string {
  if (!originalValue) {
    return "0.00%";
  }

  return `${((1 - outputValue / originalValue) * 100).toFixed(2)}%`;
}

function formatResolution(width: number, height: number): string {
  return `${width}×${height}`;
}

function buildDimensionSummary(original: ImageInfo, output: ImageInfo): string {
  if (original.width === output.width && original.height === output.height) {
    return "尺寸不变";
  }

  return `尺寸比原图（${formatResolution(original.width, original.height)}）减少${formatReduction(original.width, output.width)}`;
}

function buildStorageSummary(originalBytes: number, outputBytes: number): string {
  return `存储空间相比原图（${formatBytes(originalBytes)}）减少${formatReduction(originalBytes, outputBytes)}`;
}

export function buildImageInfoLine(imageInfo: ImageInfo): string {
  const colorDepth = imageInfo.colorDepth ?? 24;

  return `${formatBytes(imageInfo.bytes)}，${imageInfo.width}×${imageInfo.height}×${colorDepth} (${formatAspectRatio(imageInfo.width, imageInfo.height)})`;
}

export function buildResultMarkdown(input: ResultMarkdownInput): string {
  const summary = `${input.commandLabel}完成：压缩后图片分辨率${formatResolution(input.output.width, input.output.height)}，${buildDimensionSummary(input.original, input.output)}；大小${formatBytes(input.output.bytes)}，${buildStorageSummary(input.original.bytes, input.output.bytes)}，输出格式 ${input.output.format.toUpperCase()}。`;

  return [
    "---",
    "",
    `> **==${summary}==**`,
    "",
    `![processed image](${input.output.assetPath})`,
    "",
    "---",
  ].join("\n");
}

export function buildBatchResultMessage(input: BatchResultMessageInput): string {
  const completionSuffix = input.mode === "replace"
    ? "原图已直接替换，正文文本未改动，请审核。"
    : input.failureCount > 0
      ? "原图未删除，成功转换后的新图片已经插入正文，请审核。"
      : "原图未删除，转换后新图片已经插入正文，请审核。";

  if (input.failureCount > 0) {
    return `已处理本文档${input.processedCount}个图片，其中成功${input.successCount}个，失败${input.failureCount}个；总计减少存储空间${formatBytes(input.savedBytes)}。${completionSuffix}`;
  }

  return `已处理本文档${input.processedCount}个图片，总计减少存储空间${formatBytes(input.savedBytes)}，${completionSuffix}`;
}
