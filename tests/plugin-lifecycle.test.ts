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

test("click-blockicon keeps add-border hidden by default and still nests image merge for super block with multiple images", async () => {
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
    submenu: expect.not.arrayContaining([
      expect.objectContaining({
        label: "添加图像边框",
      }),
    ]),
  }));
  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
    submenu: expect.arrayContaining([
      expect.objectContaining({
        label: "图片合并",
      }),
    ]),
  }));
});

test("click-blockicon shows add-border after the image menu setting is enabled", async () => {
  const addItem = vi.fn();
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).settings = mergeSettings({
    showAddImageBorderMenuItem: true,
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

  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
    submenu: expect.arrayContaining([
      expect.objectContaining({
        label: "添加图像边框",
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

test("createImageMenuToggleGroup includes add-border and super block merge toggles and persists updates", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const wrapper = (plugin as any).createImageMenuToggleGroup();
  const labels = Array.from(wrapper.querySelectorAll("label"));
  const addBorderOption = labels.find(label => label.textContent?.includes("添加图像边框"));
  const mergeOption = labels.find(label => label.textContent?.includes("超级块图片合并"));

  expect(addBorderOption).toBeTruthy();
  expect(mergeOption).toBeTruthy();

  const addBorderCheckbox = addBorderOption?.querySelector("input") as HTMLInputElement;
  const checkbox = mergeOption?.querySelector("input") as HTMLInputElement;
  expect(addBorderCheckbox.checked).toBe(false);
  expect(checkbox.checked).toBe(true);

  addBorderCheckbox.checked = true;
  addBorderCheckbox.dispatchEvent(new Event("change"));
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change"));

  expect((plugin as any).settings.showAddImageBorderMenuItem).toBe(true);
  expect((plugin as any).settings.showSuperBlockMergeMenuItem).toBe(false);
  expect(saveData).toHaveBeenLastCalledWith("settings.json", expect.objectContaining({
    showAddImageBorderMenuItem: true,
    showSuperBlockMergeMenuItem: false,
  }));
});

test("document batch add-border toggles are hidden by default and can be enabled from settings", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const insertWrapper = (plugin as any).createCommandToggleGroup("documentInsertMenuCommands");
  const replaceWrapper = (plugin as any).createCommandToggleGroup("documentReplaceMenuCommands");
  const insertLabels = Array.from(insertWrapper.querySelectorAll("label"));
  const replaceLabels = Array.from(replaceWrapper.querySelectorAll("label"));
  const insertOption = insertLabels.find(label => label.textContent?.includes("全部图片添加边框（新增）"));
  const replaceOption = replaceLabels.find(label => label.textContent?.includes("图片添加边框（替换）"));

  expect(insertOption).toBeTruthy();
  expect(replaceOption).toBeTruthy();

  const insertCheckbox = insertOption?.querySelector("input") as HTMLInputElement;
  const replaceCheckbox = replaceOption?.querySelector("input") as HTMLInputElement;
  expect(insertCheckbox.checked).toBe(false);
  expect(replaceCheckbox.checked).toBe(false);

  insertCheckbox.checked = true;
  insertCheckbox.dispatchEvent(new Event("change"));
  replaceCheckbox.checked = true;
  replaceCheckbox.dispatchEvent(new Event("change"));

  expect((plugin as any).settings.documentInsertMenuCommands["add-border"]).toBe(true);
  expect((plugin as any).settings.documentReplaceMenuCommands["add-border"]).toBe(true);
  expect(saveData).toHaveBeenLastCalledWith("settings.json", expect.objectContaining({
    documentReplaceMenuCommands: expect.objectContaining({
      "add-border": true,
    }),
  }));
});

test("decorateDocumentMenu shows document add-border commands only after opt-in", async () => {
  const addItem = vi.fn();
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  const contentElement = document.createElement("div");
  contentElement.innerHTML = `<div data-node-id="img-1"><img src="/assets/1.png"></div>`;
  const protyle = {
    contentElement,
    element: contentElement,
  };

  (plugin as any).decorateDocumentMenu(protyle, { addItem });

  const firstSubmenu = addItem.mock.calls[0]?.[0]?.submenu ?? [];
  expect(firstSubmenu).not.toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: "全部图片添加边框（新增）",
    }),
    expect.objectContaining({
      label: "图片添加边框（替换）",
    }),
  ]));

  addItem.mockClear();
  (plugin as any).settings = mergeSettings({
    documentInsertMenuCommands: {
      "add-border": true,
    },
    documentReplaceMenuCommands: {
      "add-border": true,
    },
  });

  (plugin as any).decorateDocumentMenu(protyle, { addItem });

  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
    submenu: expect.arrayContaining([
      expect.objectContaining({
        label: "全部图片添加边框（新增）",
      }),
      expect.objectContaining({
        label: "图片添加边框（替换）",
      }),
    ]),
  }));
});

test("createSuperBlockMergeOptionsGroup persists gap, border width, and border color", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const wrapper = (plugin as any).createSuperBlockMergeOptionsGroup();
  const inputs = Array.from(wrapper.querySelectorAll("input")) as HTMLInputElement[];
  const gapInput = inputs.find(input => input.type === "number" && input.value === "0") as HTMLInputElement;
  const colorInput = inputs.find(input => input.type === "color") as HTMLInputElement;
  const borderWidthInput = inputs.find(input => input !== gapInput && input.type === "number") as HTMLInputElement;

  expect(gapInput).toBeTruthy();
  expect(borderWidthInput).toBeTruthy();
  expect(colorInput).toBeTruthy();
  expect(borderWidthInput.value).toBe("2");
  expect(colorInput.value).toBe("#808080");

  gapInput.value = "6";
  gapInput.dispatchEvent(new Event("change"));
  borderWidthInput.value = "2";
  borderWidthInput.dispatchEvent(new Event("change"));
  colorInput.value = "#00ff88";
  colorInput.dispatchEvent(new Event("change"));

  expect((plugin as any).settings.superBlockMergeOptions).toEqual({
    borderColor: "#00ff88",
    borderWidthPx: 2,
    gapPx: 6,
  });
  expect(saveData).toHaveBeenLastCalledWith("settings.json", expect.objectContaining({
    superBlockMergeOptions: {
      borderColor: "#00ff88",
      borderWidthPx: 2,
      gapPx: 6,
    },
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

  expect(workflow.mergeSuperBlockImages).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({
      borderColor: "#808080",
      borderWidthPx: 2,
      gapPx: 0,
    }),
  );

  expect(insertMarkdownAfterBlock).toHaveBeenCalledWith(
    "super-1",
    expect.stringContaining("/assets/superblock-merge-1.webp"),
  );
});

test("addBorderToImageTarget uploads bordered image and inserts it after the selected block", async () => {
  const kernel = await import("../src/services/kernel.ts");
  const workflow = await import("../src/services/image-workflow.ts");

  vi.spyOn(workflow, "addBorderToImageTarget").mockResolvedValue({
    commandLabel: "添加图像边框",
    fileName: "demo.quickedit-add-border-1.webp",
    original: {
      bytes: 100,
      colorDepth: 24,
      format: "png",
      height: 10,
      mimeType: "image/png",
      width: 10,
    },
    output: {
      blob: new Blob(["bordered"], { type: "image/webp" }),
      bytes: 8,
      format: "webp",
      height: 14,
      width: 14,
    },
  });
  vi.spyOn(kernel, "uploadAsset").mockResolvedValue("/assets/demo.quickedit-add-border-1.webp");
  const insertMarkdownAfterBlock = vi.spyOn(kernel, "insertMarkdownAfterBlock").mockResolvedValue(undefined);

  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).settings = mergeSettings({
    superBlockMergeOptions: {
      borderColor: "#00ff88",
      borderWidthPx: 2,
      gapPx: 6,
    },
  });

  await (plugin as any).addBorderToImageTarget({
    alt: "demo",
    blockId: "img-1",
    displayHeight: 10,
    displayWidth: 10,
    src: "/assets/demo.png",
  });

  expect(workflow.addBorderToImageTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      blockId: "img-1",
      src: "/assets/demo.png",
    }),
    expect.objectContaining({
      borderColor: "#00ff88",
      borderWidthPx: 2,
      gapPx: 6,
    }),
  );

  expect(insertMarkdownAfterBlock).toHaveBeenCalledWith(
    "img-1",
    expect.stringContaining("/assets/demo.quickedit-add-border-1.webp"),
  );
});

test("processDocumentTargets inserts bordered images for add-border document commands", async () => {
  const kernel = await import("../src/services/kernel.ts");
  const workflow = await import("../src/services/image-workflow.ts");

  vi.spyOn(workflow, "addBorderToImageTarget").mockResolvedValue({
    commandLabel: "添加图像边框",
    fileName: "demo.quickedit-add-border-1.webp",
    original: {
      bytes: 100,
      colorDepth: 24,
      format: "png",
      height: 10,
      mimeType: "image/png",
      width: 10,
    },
    output: {
      blob: new Blob(["bordered"], { type: "image/webp" }),
      bytes: 120,
      format: "webp",
      height: 14,
      width: 14,
    },
  });
  vi.spyOn(kernel, "uploadAsset").mockResolvedValue("/assets/demo.quickedit-add-border-1.webp");
  const insertMarkdownAfterBlock = vi.spyOn(kernel, "insertMarkdownAfterBlock").mockResolvedValue(undefined);

  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).settings = mergeSettings();

  await (plugin as any).processDocumentTargets([
    {
      alt: "demo",
      blockId: "img-1",
      displayHeight: 10,
      displayWidth: 10,
      src: "/assets/demo.png",
    },
  ], "add-border", "insert");

  expect(workflow.addBorderToImageTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      blockId: "img-1",
    }),
    expect.objectContaining({
      borderColor: "#808080",
      borderWidthPx: 2,
      gapPx: 0,
    }),
  );
  expect(insertMarkdownAfterBlock).toHaveBeenCalledWith(
    "img-1",
    expect.stringContaining("/assets/demo.quickedit-add-border-1.webp"),
  );
});

test("processDocumentTargets replaces original images for add-border replace commands", async () => {
  const kernel = await import("../src/services/kernel.ts");
  const workflow = await import("../src/services/image-workflow.ts");

  vi.spyOn(workflow, "addBorderToImageTarget").mockResolvedValue({
    commandLabel: "添加图像边框",
    fileName: "demo.quickedit-add-border-1.webp",
    original: {
      bytes: 100,
      colorDepth: 24,
      format: "png",
      height: 10,
      mimeType: "image/png",
      width: 10,
    },
    output: {
      blob: new Blob(["bordered"], { type: "image/webp" }),
      bytes: 120,
      format: "webp",
      height: 14,
      width: 14,
    },
  });
  vi.spyOn(kernel, "uploadAsset").mockResolvedValue("/assets/demo.quickedit-add-border-1.webp");
  vi.spyOn(kernel, "getBlockMarkdown").mockResolvedValue("![demo](/assets/demo.png)");
  const updateMarkdownBlock = vi.spyOn(kernel, "updateMarkdownBlock").mockResolvedValue(undefined);

  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).settings = mergeSettings();

  await (plugin as any).processDocumentTargets([
    {
      alt: "demo",
      blockId: "img-1",
      displayHeight: 10,
      displayWidth: 10,
      src: "/assets/demo.png",
    },
  ], "add-border", "replace");

  expect(updateMarkdownBlock).toHaveBeenCalledWith(
    "img-1",
    "![demo](/assets/demo.quickedit-add-border-1.webp)",
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
