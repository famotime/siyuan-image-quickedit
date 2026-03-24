interface ResolveLocalEditorImagePathOptions {
  dataDir: string;
  origin?: string;
}

interface LaunchLocalEditorOptions {
  editorPath: string;
  imagePath: string;
  platform?: NodeJS.Platform;
}

export function resolveLocalEditorImagePath(
  imageSrc: string,
  options: ResolveLocalEditorImagePathOptions,
): string {
  const baseOrigin = options.origin || getCurrentOrigin();
  const parsedUrl = new URL(imageSrc, baseOrigin);

  if (parsedUrl.protocol === "file:") {
    return normalizePlatformPath(decodeURIComponent(parsedUrl.pathname));
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("仅支持本地 assets 或 file 协议的图片。");
  }

  if (parsedUrl.host !== new URL(baseOrigin).host) {
    throw new Error("仅支持编辑当前思源工作空间中的本地图片。");
  }

  return joinPlatformPath(options.dataDir, decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, ""));
}

export function buildCacheBustedImageSrc(imageSrc: string, timestamp = Date.now()): string {
  const parsedUrl = createUrlWithCurrentOrigin(imageSrc);
  parsedUrl.searchParams.delete("t");
  parsedUrl.searchParams.set("t", String(timestamp));

  return serializeUrlForCurrentOrigin(parsedUrl);
}

export function removeCacheBustingSearchParam(imageSrc: string): string {
  const parsedUrl = createUrlWithCurrentOrigin(imageSrc);
  parsedUrl.searchParams.delete("t");

  return serializeUrlForCurrentOrigin(parsedUrl);
}

export async function createEditedImagePreviewUrl(imageSrc: string): Promise<string> {
  const previewSrc = buildCacheBustedImageSrc(removeCacheBustingSearchParam(imageSrc));
  const response = await fetch(previewSrc, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`无法刷新已编辑图片：${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function openLocalEditorAndWait(options: LaunchLocalEditorOptions): Promise<void> {
  const nodeRequire = getNodeRequire();
  if (!nodeRequire) {
    throw new Error("当前环境无法调用本地编辑器。");
  }

  const { spawn } = nodeRequire("child_process") as typeof import("child_process");
  const launch = buildLocalEditorLaunchCommand(options);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(launch.command, launch.args, {
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code && code !== 0) {
        reject(new Error(`本地编辑器退出异常，退出码：${code}`));
        return;
      }

      resolve();
    });
  });
}

function createUrlWithCurrentOrigin(imageSrc: string): URL {
  const currentOrigin = getCurrentOrigin();
  return new URL(imageSrc, currentOrigin);
}

function serializeUrlForCurrentOrigin(parsedUrl: URL): string {
  const currentOrigin = getCurrentOrigin();
  if (parsedUrl.origin === currentOrigin) {
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  }

  return parsedUrl.toString();
}

function buildLocalEditorLaunchCommand(options: LaunchLocalEditorOptions): {
  args: string[];
  command: string;
} {
  const platform = options.platform || process.platform;
  if (platform === "darwin" && options.editorPath.toLowerCase().endsWith(".app")) {
    return {
      args: ["-a", options.editorPath, options.imagePath],
      command: "open",
    };
  }

  return {
    args: [options.imagePath],
    command: options.editorPath,
  };
}

function getCurrentOrigin(): string {
  return globalThis.location?.origin || "http://127.0.0.1:6806";
}

function joinPlatformPath(basePath: string, relativePath: string): string {
  const separator = detectPathSeparator(basePath);
  const normalizedBase = basePath.replace(/[\\/]+$/, "");
  const normalizedRelative = normalizePlatformPath(relativePath, separator).replace(/^[\\/]+/, "");
  return `${normalizedBase}${separator}${normalizedRelative}`;
}

function normalizePlatformPath(
  filePath: string,
  separator = detectPathSeparator(filePath),
): string {
  const shouldUseWindowsSeparator = separator === "\\" || /^\/?[a-zA-Z]:\//.test(filePath);
  if (shouldUseWindowsSeparator) {
    return filePath.replace(/^\/([a-zA-Z]:\/)/, "$1").replace(/\//g, "\\");
  }

  return filePath;
}

function detectPathSeparator(filePath: string): "\\" | "/" {
  return /^(?:\/?[a-zA-Z]:[\\/]|\\\\)/.test(filePath) || filePath.includes("\\") ? "\\" : "/";
}

function getNodeRequire(): NodeRequire | null {
  const maybeRequire = (globalThis as typeof globalThis & {
    require?: NodeRequire;
  }).require;
  if (typeof maybeRequire === "function") {
    return maybeRequire;
  }

  return Function("return typeof require !== 'undefined' ? require : null;")() as NodeRequire | null;
}
