import { describe, expect, it, vi } from "vitest";

import { loadDocumentEmbeddedAssetBytes } from "../src/services/document-asset-stats.ts";

describe("loadDocumentEmbeddedAssetBytes", () => {
  it("aggregates current document embedded asset bytes and deduplicates repeated asset stats", async () => {
    const getDocAssets = vi.fn(async (documentId: string) => {
      if (documentId === "doc-alpha") {
        return [
          "assets/shared.png",
          "/assets/alpha-only.png",
          { path: "/data/assets/shared.png" },
          { src: "https://example.com/not-local.png" },
        ];
      }

      return [];
    });
    const statAsset = vi.fn(async (assetPath: string) => {
      if (assetPath === "assets/shared.png") {
        return { size: 20 };
      }
      if (assetPath === "assets/alpha-only.png") {
        return { size: 6 };
      }

      return { size: 0 };
    });

    const totalBytes = await loadDocumentEmbeddedAssetBytes("doc-alpha", {
      getDocAssets,
      statAsset,
    });

    expect(totalBytes).toBe(26);
    expect(statAsset).toHaveBeenCalledTimes(2);
    expect(statAsset).toHaveBeenCalledWith("assets/shared.png");
    expect(statAsset).toHaveBeenCalledWith("assets/alpha-only.png");
  });

  it("returns zero when asset listing fails", async () => {
    const totalBytes = await loadDocumentEmbeddedAssetBytes("doc-alpha", {
      getDocAssets: vi.fn(async () => {
        throw new Error("boom");
      }),
      statAsset: vi.fn(),
    });

    expect(totalBytes).toBe(0);
  });
});
