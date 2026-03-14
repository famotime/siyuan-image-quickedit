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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
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

export function buildImageInfoLine(imageInfo: ImageInfo): string {
  const colorDepth = imageInfo.colorDepth ?? 24;

  return `${formatBytes(imageInfo.bytes)}，${imageInfo.width}×${imageInfo.height}×${colorDepth} (${formatAspectRatio(imageInfo.width, imageInfo.height)})`;
}

export function buildResultMarkdown(input: ResultMarkdownInput): string {
  return [
    `${input.commandLabel}完成：压缩后图片分辨率${input.output.width}×${input.output.height}，尺寸减少${formatReduction(input.original.width, input.output.width)}；大小${formatBytes(input.output.bytes)}，存储空间减少${formatReduction(input.original.bytes, input.output.bytes)}，输出格式 ${input.output.format.toUpperCase()}。`,
    "",
    `![processed image](${input.output.assetPath})`,
  ].join("\n");
}
