import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  extractAssetRelativePath,
  findAssetReferences,
  getRelinkSupportStateForTesting,
  relinkAsset,
  relinkAssets,
  requestApiSilently,
  resetRelinkSupportStateForTesting,
  safeRelinkAssetWithFallback,
  setRelinkSupportStateForTesting,
} from "../src/services/kernel.ts";

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

import { fetchSyncPost } from "siyuan";

describe("kernel asset relink service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRelinkSupportStateForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractAssetRelativePath", () => {
    test("extracts clean relative asset path from various formats", () => {
      expect(extractAssetRelativePath("assets/image-1.png")).toBe("assets/image-1.png");
      expect(extractAssetRelativePath("/assets/image-1.png")).toBe("assets/image-1.png");
      expect(extractAssetRelativePath("<assets/image-1.png>")).toBe("assets/image-1.png");
      expect(extractAssetRelativePath("assets/sub/image-1.png")).toBe("assets/sub/image-1.png");
      expect(extractAssetRelativePath("assets/image-1.png?v=123456")).toBe("assets/image-1.png");
      expect(extractAssetRelativePath("/assets/image-1.png#anchor")).toBe("assets/image-1.png");
      expect(extractAssetRelativePath("http://127.0.0.1:6806/assets/image-1.png?t=1")).toBe("assets/image-1.png");
    });

    test("returns null for non-local or invalid asset paths", () => {
      expect(extractAssetRelativePath("")).toBeNull();
      expect(extractAssetRelativePath("https://example.com/assets/pic.png")).toBeNull();
      expect(extractAssetRelativePath("http://other-host.com/assets/pic.png")).toBeNull();
      expect(extractAssetRelativePath("file:///C:/path/to/image.png")).toBeNull();
      expect(extractAssetRelativePath("assets/../escaped.png")).toBeNull();
      expect(extractAssetRelativePath("assets/invalid:name.png")).toBeNull();
      expect(extractAssetRelativePath("data:image/png;base64,...")).toBeNull();
    });
  });

  describe("requestApiSilently", () => {
    test("passes process=false to fetchSyncPost to suppress error dialogs", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValueOnce({
        code: 0,
        data: { ok: true },
        msg: "",
      } as any);

      const result = await requestApiSilently("/api/test", { a: 1 });
      expect(result).toEqual({ ok: true });
      expect(fetchSyncPost).toHaveBeenCalledWith("/api/test", { a: 1 }, undefined, false);
    });

    test("throws an error when response code is non-zero", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValueOnce({
        code: 404,
        data: null,
        msg: "404 page not found",
      } as any);

      await expect(requestApiSilently("/api/test")).rejects.toThrow("404 page not found");
    });
  });

  describe("findAssetReferences and relinkAsset", () => {
    test("calls /api/asset/findAssetReferences with single path and multiple paths", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValue({
        code: 0,
        data: { references: [], updated: 0 },
        msg: "",
      } as any);

      await findAssetReferences("assets/a.png");
      expect(fetchSyncPost).toHaveBeenCalledWith(
        "/api/asset/findAssetReferences",
        { path: "assets/a.png" },
        undefined,
        false,
      );

      await findAssetReferences(["assets/a.png", "assets/b.png"]);
      expect(fetchSyncPost).toHaveBeenCalledWith(
        "/api/asset/findAssetReferences",
        { paths: ["assets/a.png", "assets/b.png"] },
        undefined,
        false,
      );
    });

    test("calls /api/asset/relinkAsset with oldPath and newPath", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValueOnce({
        code: 0,
        data: { references: [], updated: 2 },
        msg: "",
      } as any);

      const res = await relinkAsset("assets/old.png", "assets/new.webp");
      expect(res.updated).toBe(2);
      expect(fetchSyncPost).toHaveBeenCalledWith(
        "/api/asset/relinkAsset",
        { dryRun: false, newPath: "assets/new.webp", oldPath: "assets/old.png" },
        undefined,
        false,
      );
    });

    test("calls /api/asset/relinkAsset with batch mappings", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValueOnce({
        code: 0,
        data: { items: [], updated: 3 },
        msg: "",
      } as any);

      const res = await relinkAssets([
        { newPath: "assets/new1.webp", oldPath: "assets/old1.png" },
        { newPath: "assets/new2.webp", oldPath: "assets/old2.png" },
      ]);
      expect(res.updated).toBe(3);
      expect(fetchSyncPost).toHaveBeenCalledWith(
        "/api/asset/relinkAsset",
        {
          dryRun: false,
          mappings: [
            { newPath: "assets/new1.webp", oldPath: "assets/old1.png" },
            { newPath: "assets/new2.webp", oldPath: "assets/old2.png" },
          ],
        },
        undefined,
        false,
      );
    });
  });

  describe("safeRelinkAssetWithFallback", () => {
    test("relinks asset and marks support true when kernel supports relinkAsset", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValueOnce({
        code: 0,
        data: { references: [], updated: 3 },
        msg: "",
      } as any);

      const fallbackFn = vi.fn();
      const result = await safeRelinkAssetWithFallback({
        blockId: "b-1",
        newAssetPath: "assets/new.webp",
        oldSrc: "assets/old.png",
        onFallback: fallbackFn,
      });

      expect(result).toEqual({ method: "relink", relinkedCount: 3 });
      expect(fallbackFn).not.toHaveBeenCalled();
      expect(getRelinkSupportStateForTesting()).toBe(true);
    });

    test("falls back immediately when path is an external url", async () => {
      const fallbackFn = vi.fn().mockResolvedValue(undefined);
      const result = await safeRelinkAssetWithFallback({
        blockId: "b-1",
        newAssetPath: "assets/new.webp",
        oldSrc: "https://external.domain.com/photo.png",
        onFallback: fallbackFn,
      });

      expect(result).toEqual({ method: "block-fallback", relinkedCount: 1 });
      expect(fallbackFn).toHaveBeenCalledTimes(1);
      expect(fetchSyncPost).not.toHaveBeenCalled();
    });

    test("catches 404, marks support false, and executes fallback", async () => {
      vi.mocked(fetchSyncPost).mockResolvedValueOnce({
        code: 404,
        data: null,
        msg: "404 page not found",
      } as any);

      const fallbackFn = vi.fn().mockResolvedValue(undefined);
      const result = await safeRelinkAssetWithFallback({
        blockId: "b-1",
        newAssetPath: "assets/new.webp",
        oldSrc: "/assets/old.png?v=1",
        onFallback: fallbackFn,
      });

      expect(result).toEqual({ method: "block-fallback", relinkedCount: 1 });
      expect(fallbackFn).toHaveBeenCalledTimes(1);
      expect(getRelinkSupportStateForTesting()).toBe(false);

      // Second call should bypass API immediately and go straight to fallback
      fallbackFn.mockClear();
      vi.mocked(fetchSyncPost).mockClear();

      const secondResult = await safeRelinkAssetWithFallback({
        blockId: "b-2",
        newAssetPath: "assets/new2.webp",
        oldSrc: "assets/old2.png",
        onFallback: fallbackFn,
      });

      expect(secondResult).toEqual({ method: "block-fallback", relinkedCount: 1 });
      expect(fallbackFn).toHaveBeenCalledTimes(1);
      expect(fetchSyncPost).not.toHaveBeenCalled();
    });
  });
});
