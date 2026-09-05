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

  // 验证合入的图片信息通知开关
  const notificationRow = wrapper.querySelector(".image-quickedit-notification-row");
  expect(notificationRow).toBeTruthy();
  const notificationCheckbox = notificationRow?.querySelector("input") as HTMLInputElement;
  expect(notificationCheckbox).toBeTruthy();
  expect(notificationCheckbox.checked).toBe(false);

  notificationCheckbox.checked = true;
  notificationCheckbox.dispatchEvent(new Event("change"));
  expect((plugin as any).settings.showImageInfoNotification).toBe(true);
  expect(saveData).toHaveBeenLastCalledWith("settings.json", expect.objectContaining({
    showImageInfoNotification: true,
  }));
});

test("createSettingColorPaletteRow allows selecting preset swatches, custom hex input, and opening color palette via color preview", async () => {
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  const onChange = vi.fn();

  const row = (plugin as any).createSettingColorPaletteRow({
    initialValue: "#D5D5D8",
    label: "边框颜色",
    onChange,
  });

  const preview = row.querySelector(".image-quickedit-color-preview") as HTMLElement;
  const hexInput = row.querySelector(".image-quickedit-color-hex-input") as HTMLInputElement;
  const colorInput = row.querySelector(".image-quickedit-hidden-color-input") as HTMLInputElement;
  const paletteBtn = row.querySelector(".image-quickedit-palette-btn") as HTMLButtonElement;
  const swatches = Array.from(row.querySelectorAll(".image-quickedit-color-swatch")) as HTMLElement[];

  expect(preview).toBeTruthy();
  expect(hexInput.value).toBe("#D5D5D8");
  expect(colorInput.value).toBe("#d5d5d8");
  expect(paletteBtn).toBeTruthy();
  expect(paletteBtn.querySelector("svg.lucide-palette")).toBeTruthy();
  expect(paletteBtn.textContent?.trim()).toBe("");
  expect(swatches.length).toBe(5);

  // 点击预设色块
  swatches[1]?.click(); // #4285f4
  expect(onChange).toHaveBeenLastCalledWith("#4285f4");
  expect(hexInput.value).toBe("#4285F4");
  expect(colorInput.value).toBe("#4285f4");

  // 直接编辑 HEX 代码
  hexInput.value = "#ff5500";
  hexInput.dispatchEvent(new Event("change"));
  expect(onChange).toHaveBeenLastCalledWith("#ff5500");
  expect(colorInput.value).toBe("#ff5500");
  expect(preview.style.backgroundColor).toBe("rgb(255, 85, 0)");

  // 测试点击颜色预览圆环与调色板按钮唤起调色板
  const clickSpy = vi.spyOn(colorInput, "click");
  preview.click();
  expect(clickSpy).toHaveBeenCalledTimes(1);

  paletteBtn.click();
  expect(clickSpy).toHaveBeenCalledTimes(2);
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

test("createDocumentBatchMenuToggleGroup renders merged cards with insert and replace toggles and toolbar actions", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const wrapper = (plugin as any).createDocumentBatchMenuToggleGroup();
  const cards = Array.from(wrapper.querySelectorAll(".image-quickedit-batch-card")) as HTMLElement[];
  expect(cards).toHaveLength(6);

  // 验证每个卡片是否包含命令标题以及“新增”与“替换”两个复选框
  const borderCard = cards.find(card => card.querySelector(".image-quickedit-batch-title")?.textContent?.includes("全部图片添加边框"));
  expect(borderCard).toBeTruthy();

  const insertCheckbox = borderCard?.querySelector('input[data-mode="insert"]') as HTMLInputElement;
  const replaceCheckbox = borderCard?.querySelector('input[data-mode="replace"]') as HTMLInputElement;
  expect(insertCheckbox).toBeTruthy();
  expect(replaceCheckbox).toBeTruthy();
  expect(insertCheckbox.checked).toBe(false);
  expect(replaceCheckbox.checked).toBe(false);

  // 触发勾选并测试保存
  insertCheckbox.checked = true;
  insertCheckbox.dispatchEvent(new Event("change"));
  expect((plugin as any).settings.documentInsertMenuCommands["add-border"]).toBe(true);

  replaceCheckbox.checked = true;
  replaceCheckbox.dispatchEvent(new Event("change"));
  expect((plugin as any).settings.documentReplaceMenuCommands["add-border"]).toBe(true);

  // 测试快捷工具栏按钮
  const buttons = Array.from(wrapper.querySelectorAll(".image-quickedit-tool-btn")) as HTMLButtonElement[];
  const selectAllInsertBtn = buttons.find(b => b.textContent === "全选新增");
  const unselectAllInsertBtn = buttons.find(b => b.textContent === "清空新增");
  const selectAllReplaceBtn = buttons.find(b => b.textContent === "全选替换");
  const unselectAllReplaceBtn = buttons.find(b => b.textContent === "清空替换");
  const resetBtn = buttons.find(b => b.textContent === "恢复默认");

  expect(selectAllInsertBtn).toBeTruthy();
  expect(unselectAllInsertBtn).toBeTruthy();
  expect(selectAllReplaceBtn).toBeTruthy();
  expect(unselectAllReplaceBtn).toBeTruthy();
  expect(resetBtn).toBeTruthy();

  // 点击全选新增
  selectAllInsertBtn?.click();
  for (const card of cards) {
    const cb = card.querySelector('input[data-mode="insert"]') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  }

  // 点击清空新增
  unselectAllInsertBtn?.click();
  for (const card of cards) {
    const cb = card.querySelector('input[data-mode="insert"]') as HTMLInputElement;
    expect(cb.checked).toBe(false);
  }

  // 点击恢复默认
  resetBtn?.click();
  const webpInsertCb = cards[0]?.querySelector('input[data-mode="insert"]') as HTMLInputElement;
  expect(webpInsertCb.checked).toBe(true); // convert-webp 默认新增为 true
  expect(insertCheckbox.checked).toBe(false); // add-border 默认新增为 false
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

test("decorateDocumentMenu uses collectImageTargetsByDocId when clicked to fetch images in unrendered blocks", async () => {
  const addItem = vi.fn();
  const imageWorkflow = await import("../src/services/image-workflow.ts");
  vi.spyOn(imageWorkflow, "collectImageTargetsByDocId").mockResolvedValue([
    { alt: "p1", blockId: "block-1", displayHeight: 0, displayWidth: 0, src: "/assets/pic1.png" },
    { alt: "p2", blockId: "block-3", displayHeight: 0, displayWidth: 0, src: "/assets/pic2.png" },
  ]);

  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  const processDocumentTargets = vi.spyOn(plugin as any, "processDocumentTargets").mockResolvedValue({
    failureCount: 0,
    processedCount: 2,
    savedBytes: 100,
    successCount: 2,
  });

  const emptyContentElement = document.createElement("div"); // DOM has 0 images due to lazy loading
  const protyle = {
    block: { rootID: "long-doc-unrendered-123" },
    contentElement: emptyContentElement,
    element: emptyContentElement,
  };

  (plugin as any).settings = mergeSettings({
    documentReplaceMenuCommands: {
      "compress-10": true,
    },
  });

  (plugin as any).decorateDocumentMenu(protyle, { addItem }, { id: "long-doc-unrendered-123" } as any);

  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
    label: "图片快剪",
  }));

  const menuArg = addItem.mock.calls[0][0];
  const compressCommand = menuArg.submenu.find((item: any) => item.label?.includes("10%") && item.label?.includes("替换"));
  expect(compressCommand).toBeTruthy();

  // Trigger the menu command click
  await compressCommand.click();

  expect(processDocumentTargets).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ blockId: "block-1", src: "/assets/pic1.png" }),
      expect.objectContaining({ blockId: "block-3", src: "/assets/pic2.png" }),
    ]),
    "compress-10",
    "replace",
  );
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
  const cropCheckbox = inputs.find(input => input.type === "checkbox") as HTMLInputElement;

  expect(gapInput).toBeTruthy();
  expect(borderWidthInput).toBeTruthy();
  expect(colorInput).toBeTruthy();
  expect(cropCheckbox).toBeTruthy();
  expect(borderWidthInput.value).toBe("2");
  expect(colorInput.value).toBe("#808080");
  expect(cropCheckbox.checked).toBe(false);

  gapInput.value = "6";
  gapInput.dispatchEvent(new Event("change"));
  borderWidthInput.value = "2";
  borderWidthInput.dispatchEvent(new Event("change"));
  colorInput.value = "#00ff88";
  colorInput.dispatchEvent(new Event("change"));
  cropCheckbox.checked = true;
  cropCheckbox.dispatchEvent(new Event("change"));

  expect((plugin as any).settings.superBlockMergeOptions).toEqual({
    borderColor: "#00ff88",
    borderWidthPx: 2,
    gapPx: 6,
    cropToSameHeight: true,
  });
  expect(saveData).toHaveBeenLastCalledWith("settings.json", expect.objectContaining({
    superBlockMergeOptions: {
      borderColor: "#00ff88",
      borderWidthPx: 2,
      gapPx: 6,
      cropToSameHeight: true,
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
      cropToSameHeight: false,
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

test("createCommandToggleGroup toolbar buttons support selectAll, unselectAll, and reset to defaults", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const wrapper = (plugin as any).createCommandToggleGroup("documentInsertMenuCommands");
  const toolBtns = Array.from(wrapper.querySelectorAll(".image-quickedit-tool-btn")) as HTMLButtonElement[];
  const selectAllBtn = toolBtns.find(btn => btn.textContent === "全选");
  const unselectAllBtn = toolBtns.find(btn => btn.textContent === "取消全选");
  const resetBtn = toolBtns.find(btn => btn.textContent === "恢复默认");

  expect(selectAllBtn).toBeTruthy();
  expect(unselectAllBtn).toBeTruthy();
  expect(resetBtn).toBeTruthy();

  // 点击全选
  selectAllBtn?.click();
  const checkboxes = Array.from(wrapper.querySelectorAll<HTMLInputElement>("input[type='checkbox']"));
  expect(checkboxes.every(cb => cb.checked)).toBe(true);

  // 点击取消全选
  unselectAllBtn?.click();
  expect(checkboxes.every(cb => !cb.checked)).toBe(true);

  // 点击恢复默认
  resetBtn?.click();
  const addBorderCheckbox = checkboxes[checkboxes.length - 1]; // add-border 默认在 insert 中是 false
  expect(addBorderCheckbox?.checked).toBe(false);
});

test("createCompressionStrategySelect updates strategy when strategy card is clicked", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const wrapper = (plugin as any).createCompressionStrategySelect();
  const cards = Array.from(wrapper.querySelectorAll(".image-quickedit-strategy-card")) as HTMLElement[];
  expect(cards).toHaveLength(3);

  // 点击第 2 个卡片（优先压缩分辨率）
  cards[1].click();
  expect((plugin as any).settings.compressionStrategy).toBe("resolution-first");
  expect(cards[1].classList.contains("is-active")).toBe(true);
  expect(cards[0].classList.contains("is-active")).toBe(false);

  // 点击第 3 个卡片（优先压缩颜色）
  cards[2].click();
  expect((plugin as any).settings.compressionStrategy).toBe("color-first");
  expect(cards[2].classList.contains("is-active")).toBe(true);
  expect(cards[1].classList.contains("is-active")).toBe(false);
});

test("createSuperBlockMergeOptionsGroup updates border color via preset swatches", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings();

  const panel = (plugin as any).createSuperBlockMergeOptionsGroup();
  const swatches = Array.from(panel.querySelectorAll(".image-quickedit-color-swatch")) as HTMLElement[];
  expect(swatches.length).toBeGreaterThan(0);

  // 点击黑色预设色块
  const blackSwatch = swatches.find(s => s.title === "#000000");
  expect(blackSwatch).toBeTruthy();
  blackSwatch?.click();

  expect((plugin as any).settings.superBlockMergeOptions.borderColor).toBe("#000000");
});

test("createLocalEditorPathInput clear button empties path and saves settings", async () => {
  const saveData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");
  const plugin = new SiyuanImageQuickEditPlugin();
  (plugin as any).saveData = saveData;
  (plugin as any).settings = mergeSettings({
    localEditorPath: "C:\\Windows\\notepad.exe",
  });

  const wrapper = (plugin as any).createLocalEditorPathInput();
  const input = wrapper.querySelector("input") as HTMLInputElement;
  const clearBtn = wrapper.querySelector(".image-quickedit-input-clear") as HTMLButtonElement;

  expect(input.value).toBe("C:\\Windows\\notepad.exe");
  expect(clearBtn.style.display).not.toBe("none");

  clearBtn.click();
  expect(input.value).toBe("");
  expect((plugin as any).settings.localEditorPath).toBe("");
  expect(clearBtn.style.display).toBe("none");
});

