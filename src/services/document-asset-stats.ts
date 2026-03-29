interface LoadDocumentEmbeddedAssetBytesOptions {
  getDocAssets?: (documentId: string) => Promise<unknown>;
  statAsset?: (path: string) => Promise<unknown>;
}

export async function loadDocumentEmbeddedAssetBytes(
  documentId: string,
  options: LoadDocumentEmbeddedAssetBytesOptions = {},
): Promise<number> {
  if (!documentId) {
    return 0;
  }

  const getDocAssets = options.getDocAssets ?? defaultGetDocAssets;
  const statAsset = options.statAsset ?? defaultStatAsset;
  const assetPaths = normalizeAssetPaths(await safeCall(() => getDocAssets(documentId)));
  if (!assetPaths.length) {
    return 0;
  }

  const assetBytesByPath = new Map<string, number>();
  await Promise.all(assetPaths.map(async (assetPath) => {
    const assetStat = await safeCall(() => statAsset(assetPath));
    assetBytesByPath.set(assetPath, resolveAssetSize(assetStat));
  }));

  return assetPaths.reduce((total, assetPath) => total + (assetBytesByPath.get(assetPath) ?? 0), 0);
}

function normalizeAssetPaths(payload: unknown): string[] {
  const values = extractArrayPayload(payload);

  return [...new Set(values
    .map(resolveAssetPath)
    .filter((value): value is string => Boolean(value)))];
}

function extractArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["assets", "files", "data"]) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }

  return [];
}

function resolveAssetPath(entry: unknown): string | null {
  if (typeof entry === "string") {
    return normalizeAssetPath(entry);
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  for (const key of ["path", "assetPath", "src", "url"]) {
    if (typeof record[key] === "string") {
      return normalizeAssetPath(record[key] as string);
    }
  }

  return null;
}

function normalizeAssetPath(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("file://")) {
    return normalized;
  }
  if (normalized.startsWith("/data/assets/")) {
    return `assets/${normalized.slice("/data/assets/".length)}`;
  }
  if (normalized.startsWith("/assets/")) {
    return `assets/${normalized.slice("/assets/".length)}`;
  }
  if (normalized.startsWith("assets/")) {
    return normalized;
  }

  return null;
}

function resolveAssetSize(payload: unknown): number {
  if (typeof payload === "number") {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.size === "number") {
    return record.size;
  }
  if ("data" in record) {
    return resolveAssetSize(record.data);
  }

  return 0;
}

async function safeCall<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  }
  catch {
    return null;
  }
}

async function defaultGetDocAssets(documentId: string): Promise<unknown> {
  const api = await import("@/services/kernel.ts");
  return api.getDocAssets(documentId);
}

async function defaultStatAsset(path: string): Promise<unknown> {
  const api = await import("@/services/kernel.ts");
  return api.statAsset(path);
}
