import { fetchSyncPost } from "siyuan";

export async function requestApi<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await fetchSyncPost(url, data);
  if (response.code !== 0) {
    throw new Error(response.msg || `Request failed: ${url}`);
  }

  return response.data as T;
}

export async function requestApiSilently<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await fetchSyncPost(url, data, undefined, false);
  if (response.code !== 0) {
    throw new Error(response.msg || `Request failed (${response.code}): ${url}`);
  }

  return response.data as T;
}

export async function uploadAsset(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("assetsDirPath", "/assets/");
  formData.append("file[]", file);

  const response = await requestApi<IResUpload>("/api/asset/upload", formData);
  const uploadedPath = Object.values(response.succMap)[0] || Object.keys(response.succMap)[0];

  if (!uploadedPath) {
    throw new Error("Asset upload returned an empty path.");
  }

  return uploadedPath;
}

export async function getBlockMarkdown(blockId: string): Promise<string> {
  const response = await requestApi<IResGetBlockKramdown>("/api/block/getBlockKramdown", {
    id: blockId,
  });

  return response.kramdown;
}

export async function insertMarkdownAfterBlock(blockId: string, markdown: string): Promise<void> {
  await requestApi("/api/block/insertBlock", {
    data: markdown,
    dataType: "markdown",
    previousID: blockId,
  });
}

export async function updateMarkdownBlock(blockId: string, markdown: string): Promise<void> {
  await requestApi("/api/block/updateBlock", {
    data: markdown,
    dataType: "markdown",
    id: blockId,
  });
}

export async function updateDomBlock(blockId: string, html: string): Promise<void> {
  await requestApi("/api/block/updateBlock", {
    data: html,
    dataType: "dom",
    id: blockId,
  });
}

export async function getDocAssets(documentId: string): Promise<unknown> {
  return requestApi("/api/asset/getDocAssets", {
    id: documentId,
  });
}

export async function statAsset(path: string): Promise<unknown> {
  return requestApi("/api/asset/statAsset", {
    path,
  });
}

export async function getBlockById(blockId: string): Promise<Pick<Block, "id" | "root_id"> | null> {
  const rows = await requestApi<Array<Pick<Block, "id" | "root_id">>>("/api/query/sql", {
    stmt: `select id, root_id from blocks where id = '${escapeSqlValue(blockId)}' limit 1`,
  });

  return rows[0] ?? null;
}

function escapeSqlValue(value: string): string {
  return value.replaceAll("'", "''");
}

function sanitizeAssetPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/")) {
    return null;
  }
  if (normalized.includes("..") || /[:*?"<>|]/.test(normalized.slice("assets/".length))) {
    return null;
  }
  return normalized;
}

export function extractAssetRelativePath(src: string): string | null {
  if (!src) {
    return null;
  }
  const trimmed = src.trim().replace(/^<|>$/g, "");

  if (/^(https?:)?\/\//i.test(trimmed)) {
    try {
      const defaultOrigin = typeof location !== "undefined" ? location.origin : "http://127.0.0.1:6806";
      const parsed = new URL(trimmed, defaultOrigin);
      if (parsed.origin !== defaultOrigin) {
        return null;
      }
      return sanitizeAssetPathname(parsed.pathname);
    }
    catch {
      return null;
    }
  }

  const purePath = trimmed.split(/[?#]/)[0];
  return sanitizeAssetPathname(purePath);
}

export const kernelApi = {
  findAssetReferences: async (pathOrPaths: string | string[]): Promise<IResAssetReferences> => {
    const payload = Array.isArray(pathOrPaths)
      ? { paths: pathOrPaths }
      : { path: pathOrPaths };
    return requestApiSilently<IResAssetReferences>("/api/asset/findAssetReferences", payload);
  },
  relinkAsset: async (oldPath: string, newPath: string, dryRun = false): Promise<IResAssetReferences> => {
    return requestApiSilently<IResAssetReferences>("/api/asset/relinkAsset", {
      dryRun,
      newPath,
      oldPath,
    });
  },
  relinkAssets: async (mappings: IAssetRelinkMapping[], dryRun = false): Promise<IResAssetReferences> => {
    return requestApiSilently<IResAssetReferences>("/api/asset/relinkAsset", {
      dryRun,
      mappings,
    });
  },
};

export async function findAssetReferences(pathOrPaths: string | string[]): Promise<IResAssetReferences> {
  return kernelApi.findAssetReferences(pathOrPaths);
}

export async function relinkAsset(oldPath: string, newPath: string, dryRun = false): Promise<IResAssetReferences> {
  return kernelApi.relinkAsset(oldPath, newPath, dryRun);
}

export async function relinkAssets(mappings: IAssetRelinkMapping[], dryRun = false): Promise<IResAssetReferences> {
  return kernelApi.relinkAssets(mappings, dryRun);
}

let isRelinkAssetSupported: boolean | null = null;

export function resetRelinkSupportStateForTesting(): void {
  isRelinkAssetSupported = null;
}

export function getRelinkSupportStateForTesting(): boolean | null {
  return isRelinkAssetSupported;
}

export function setRelinkSupportStateForTesting(state: boolean | null): void {
  isRelinkAssetSupported = state;
}

export interface SafeRelinkOptions {
  blockId: string;
  newAssetPath: string;
  oldSrc: string;
  onFallback?: () => Promise<void>;
}

export interface SafeRelinkResult {
  method: "relink" | "block-fallback";
  relinkedCount: number;
}

export async function safeRelinkAssetWithFallback(options: SafeRelinkOptions): Promise<SafeRelinkResult> {
  const oldCleanPath = extractAssetRelativePath(options.oldSrc);
  const newCleanPath = extractAssetRelativePath(options.newAssetPath);

  if (!oldCleanPath || !newCleanPath || isRelinkAssetSupported === false) {
    if (options.onFallback) {
      await options.onFallback();
    }
    return { method: "block-fallback", relinkedCount: 1 };
  }

  try {
    const data = await kernelApi.relinkAsset(oldCleanPath, newCleanPath);
    isRelinkAssetSupported = true;
    return {
      method: "relink",
      relinkedCount: data.updated || 1,
    };
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isUnsupported = errorMsg.includes("404")
      || errorMsg.toLowerCase().includes("not found")
      || errorMsg.includes("-1");

    if (isUnsupported) {
      isRelinkAssetSupported = false;
    }

    if (options.onFallback) {
      await options.onFallback();
    }
    return { method: "block-fallback", relinkedCount: 1 };
  }
}
