interface ResolveLocalEditorImagePathOptions {
  dataDir: string;
  origin?: string;
}

export interface LocalEditorImageSource {
  filePath: string;
  kind: "external-file" | "workspace-asset";
  workspaceRelativePath?: string;
}

export interface LocalEditorEditSession {
  imagePath: string;
  kind: "external-file" | "workspace-asset";
  originalPath: string;
  tempDirPath?: string;
  tempPath?: string;
}

interface LaunchLocalEditorOptions {
  editorPath: string;
  imagePath: string;
  platform?: NodeJS.Platform;
}

interface PrepareLocalEditorEditSessionOptions {
  tempDir?: string;
}

export function resolveLocalEditorImagePath(
  imageSrc: string,
  options: ResolveLocalEditorImagePathOptions,
): string {
  return resolveLocalEditorImageSource(imageSrc, options).filePath;
}

export function resolveLocalEditorImageSource(
  imageSrc: string,
  options: ResolveLocalEditorImagePathOptions,
): LocalEditorImageSource {
  const baseOrigin = options.origin || getCurrentOrigin();
  const parsedUrl = new URL(imageSrc, baseOrigin);

  if (parsedUrl.protocol === "file:") {
    return {
      filePath: normalizePlatformPath(decodeURIComponent(parsedUrl.pathname)),
      kind: "external-file",
    };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("仅支持本地 assets 或 file 协议的图片。");
  }

  if (parsedUrl.host !== new URL(baseOrigin).host) {
    throw new Error("仅支持编辑当前思源工作空间中的本地图片。");
  }

  const workspaceRelativePath = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "");
  return {
    filePath: joinPlatformPath(options.dataDir, workspaceRelativePath),
    kind: "workspace-asset",
    workspaceRelativePath,
  };
}

export async function prepareLocalEditorEditSession(
  source: LocalEditorImageSource,
  options: PrepareLocalEditorEditSessionOptions = {},
): Promise<LocalEditorEditSession> {
  if (source.kind === "external-file") {
    return {
      imagePath: source.filePath,
      kind: source.kind,
      originalPath: source.filePath,
    };
  }

  const { mkdir, mkdtemp, copyFile } = await getFsPromises();
  const { basename, join } = await getNodePath();
  const tempRoot = options.tempDir || join((await getNodeOs()).tmpdir(), "siyuan-image-quickedit");
  await mkdir(tempRoot, { recursive: true });

  const tempDirPath = await mkdtemp(join(tempRoot, "edit-"));
  const tempPath = join(tempDirPath, basename(source.filePath));
  await copyFile(source.filePath, tempPath);

  return {
    imagePath: tempPath,
    kind: source.kind,
    originalPath: source.filePath,
    tempDirPath,
    tempPath,
  };
}

export async function commitLocalEditorEditSession(session: LocalEditorEditSession): Promise<void> {
  if (session.kind === "workspace-asset" && session.tempPath) {
    const { copyFile } = await getFsPromises();
    await copyFile(session.tempPath, session.originalPath);
  }

  await cleanupLocalEditorEditSession(session);
}

export async function cleanupLocalEditorEditSession(session: LocalEditorEditSession): Promise<void> {
  if (!session.tempDirPath) {
    return;
  }

  const { rm } = await getFsPromises();
  await rm(session.tempDirPath, {
    force: true,
    recursive: true,
  });

  delete session.tempDirPath;
  delete session.tempPath;
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
  return buildCacheBustedImageSrc(removeCacheBustingSearchParam(imageSrc));
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

async function getFsPromises(): Promise<typeof import("node:fs/promises")> {
  const nodeRequire = getNodeRequire();
  if (nodeRequire) {
    return nodeRequire("node:fs/promises") as typeof import("node:fs/promises");
  }

  return import("node:fs/promises");
}

async function getNodeOs(): Promise<typeof import("node:os")> {
  const nodeRequire = getNodeRequire();
  if (nodeRequire) {
    return nodeRequire("node:os") as typeof import("node:os");
  }

  return import("node:os");
}

async function getNodePath(): Promise<typeof import("node:path")> {
  const nodeRequire = getNodeRequire();
  if (nodeRequire) {
    return nodeRequire("node:path") as typeof import("node:path");
  }

  return import("node:path");
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
