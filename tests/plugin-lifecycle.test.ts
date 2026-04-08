// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  document.body.innerHTML = "";
});

test("uninstall removes persisted settings data", async () => {
  const removeData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");

  await SiyuanImageQuickEditPlugin.prototype.uninstall.call({
    name: "siyuan-image-quickedit",
    removeData,
  });

  expect(removeData).toHaveBeenCalledWith("settings.json");
});

test("click-blockicon adds image merge menu item for super block with multiple images", async () => {
  const addItem = vi.fn();
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  const blockElement = document.createElement("div");
  blockElement.dataset.nodeId = "super-1";
  blockElement.dataset.type = "NodeSuperBlock";
  blockElement.innerHTML = `
    <div data-node-id="img-1"><img src="/assets/1.png"></div>
    <div data-node-id="img-2"><img src="/assets/2.png"></div>
  `;

  (plugin as any).decorateBlockIconMenu({
    blockElements: [blockElement],
    menu: { addItem },
  });

  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片合并",
  }));
});

test("click-blockicon does not add image merge menu item when super block has fewer than two images", async () => {
  const addItem = vi.fn();
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  const blockElement = document.createElement("div");
  blockElement.dataset.nodeId = "super-1";
  blockElement.dataset.type = "NodeSuperBlock";
  blockElement.innerHTML = `<div data-node-id="img-1"><img src="/assets/1.png"></div>`;

  (plugin as any).decorateBlockIconMenu({
    blockElements: [blockElement],
    menu: { addItem },
  });

  expect(addItem).not.toHaveBeenCalledWith(expect.objectContaining({
    label: "图片合并",
  }));
});

test("mergeImagesForSuperBlock uploads merged image and inserts it after the super block", async () => {
  const kernel = await import("../src/services/kernel.ts");
  const workflow = await import("../src/services/image-workflow.ts");

  vi.spyOn(workflow, "collectSuperBlockImageTargets").mockReturnValue([
    { alt: "one", blockId: "img-1", displayHeight: 10, displayWidth: 10, src: "/assets/1.png" },
    { alt: "two", blockId: "img-2", displayHeight: 10, displayWidth: 10, src: "/assets/2.png" },
  ]);
  vi.spyOn(workflow, "mergeSuperBlockImages").mockResolvedValue({
    fileName: "superblock-merge-1.webp",
    output: {
      blob: new Blob(["merged"], { type: "image/webp" }),
      bytes: 6,
      height: 10,
      width: 20,
    },
  });
  vi.spyOn(kernel, "uploadAsset").mockResolvedValue("/assets/superblock-merge-1.webp");
  const insertMarkdownAfterBlock = vi.spyOn(kernel, "insertMarkdownAfterBlock").mockResolvedValue(undefined);

  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  const superBlockElement = document.createElement("div");
  superBlockElement.dataset.nodeId = "super-1";

  await (plugin as any).mergeImagesForSuperBlock(superBlockElement);

  expect(insertMarkdownAfterBlock).toHaveBeenCalledWith(
    "super-1",
    expect.stringContaining("/assets/superblock-merge-1.webp"),
  );
});
