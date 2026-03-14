function normalizeComparableImageSource(src: string): string {
  const trimmed = src.replace(/^<|>$/g, "");

  try {
    const normalized = new URL(trimmed, "https://example.invalid");
    return `${normalized.pathname}${normalized.search}${normalized.hash}`;
  }
  catch {
    return trimmed;
  }
}

function matchesSource(candidate: string, target: string): boolean {
  return normalizeComparableImageSource(candidate) === normalizeComparableImageSource(target);
}

export function replaceImageSourceInMarkdown(markdown: string, currentSrc: string, nextSrc: string): string {
  let replaced = false;

  const replacedMarkdownImage = markdown.replace(
    /!\[([^\]]*)\]\((<[^>]+>|[^)\s]+)([^)]*)\)/g,
    (match, altText: string, imageSource: string, suffix: string) => {
      if (!matchesSource(imageSource, currentSrc)) {
        return match;
      }

      replaced = true;
      return `![${altText}](${nextSrc}${suffix})`;
    },
  );

  if (replaced) {
    return replacedMarkdownImage;
  }

  const replacedHtmlImage = markdown.replace(
    /(<img\b[^>]*?\ssrc=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix: string, imageSource: string, suffix: string) => {
      if (!matchesSource(imageSource, currentSrc)) {
        return match;
      }

      replaced = true;
      return `${prefix}${nextSrc}${suffix}`;
    },
  );

  if (replaced) {
    return replacedHtmlImage;
  }

  throw new Error("未找到需要替换的图片链接。");
}
