// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";

import { mergeSettings } from "../src/core/command-settings.ts";

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

test("click-blockicon nests image merge under the image quick edit submenu for super block with multiple images", async () => {
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

  expect(addItem).toHaveBeenCalledTimes(1);
  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
    submenu: expect.arrayContaining([
      expect.objectContaining({
        label: "图片合并",
      }),
    ]),
  }));
});

test("click-blockicon hides image merge inside the image quick edit submenu when the setting is disabled", async () => {
  const addItem = vi.fn();
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).settings = mergeSettings({
    showSuperBlockMergeMenuItem: false,
  });
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

  expect(addItem).toHaveBeenCalledTimes(1);
  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
    submenu: expect.not.arrayContaining([
      expect.objectContaining({
        label: "图片合并",
      }),
    ]),
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

  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
    submenu: expect.not.arrayContaining([
      expect.objectContaining({
        label: "图片合并",
      }),
    ]),
  }));
});

test("createImageMenuToggleGroup includes the super block merge toggle and persists updates", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const wrapper = (plugin as any).createImageMenuToggleGroup();
  const labels = Array.from(wrapper.querySelectorAll("label"));
  const mergeOption = labels.find(label => label.textContent?.includes("超级块图片合并"));

  expect(mergeOption).toBeTruthy();

  const checkbox = mergeOption?.querySelector("input") as HTMLInputElement;
  expect(checkbox.checked).toBe(true);

  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change"));

  expect((plugin as any).settings.showSuperBlockMergeMenuItem).toBe(false);
  expect(saveData).toHaveBeenCalledWith("settings.json", expect.objectContaining({
    showSuperBlockMergeMenuItem: false,
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

test("refreshEditedImages cache-busts rendered src without changing stable data-src", async () => {
  const localEditor = await import("../src/services/local-editor.ts");
  vi.spyOn(localEditor, "resolveLocalEditorImagePath").mockReturnValue("D:\\SiYuan\\workspace\\data\\assets\\demo.png");
  vi.spyOn(localEditor, "createEditedImagePreviewUrl").mockResolvedValue("assets/demo.png");

  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  document.body.innerHTML = `
    <div class="protyle-wysiwyg">
      <div data-node-id="img-1"><img src="/assets/demo.png" data-src="/assets/demo.png"></div>
    </div>
  `;

  const refreshedCount = await (plugin as any).refreshEditedImages(
    "D:\\SiYuan\\workspace\\data\\assets\\demo.png",
    "D:\\SiYuan\\workspace\\data",
  );

  const imageElement = document.querySelector("img") as HTMLImageElement;
  expect(refreshedCount).toBe(1);
  expect(imageElement.getAttribute("src")).toBe("assets/demo.png");
  expect(imageElement.dataset.src).toBe("assets/demo.png");
});
