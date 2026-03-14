import { fetchSyncPost } from "siyuan";

export async function requestApi<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await fetchSyncPost(url, data);
  if (response.code !== 0) {
    throw new Error(response.msg || `Request failed: ${url}`);
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
