# Super Block Image Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `图片合并` block-icon menu command for SiYuan super blocks that horizontally merges the super block's images into one image and inserts the result below the super block.

**Architecture:** Extend the existing `click-blockicon` plugin path to detect `NodeSuperBlock` blocks and render a dedicated top-level menu item. Implement merge-specific image collection and canvas export in `src/services/image-workflow.ts`, then reuse the existing asset upload and markdown insertion APIs to persist the merged result below the target super block.

**Tech Stack:** TypeScript, Vitest, jsdom, SiYuan plugin API, browser canvas/ImageBitmap APIs

---

## File Structure

- Modify: `src/index.ts`
  Adds super block menu detection and hooks the merge action into the existing exclusive task runner and message flow.
- Modify: `src/core/menu-items.ts`
  Adds a focused builder for the super block `图片合并` menu item.
- Modify: `src/services/image-workflow.ts`
  Adds super block image collection helpers and merged-image export logic.
- Modify: `tests/menu-items.test.ts`
  Covers the new menu item builder.
- Create: `tests/super-block-image-merge.test.ts`
  Covers image collection order and merge canvas sizing/alignment behavior.
- Modify: `tests/plugin-lifecycle.test.ts`
  Covers plugin menu injection and action wiring for super blocks.

### Task 1: Add the failing menu-item test

**Files:**
- Modify: `tests/menu-items.test.ts`
- Modify: `src/core/menu-items.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("buildSuperBlockMergeMenuItem creates the image merge command", () => {
  const onClick = vi.fn();

  const item = buildSuperBlockMergeMenuItem({
    onClick,
  });

  expect(item).toMatchObject({
    label: "图片合并",
  });

  item.click?.();
  expect(onClick).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/menu-items.test.ts`
Expected: FAIL because `buildSuperBlockMergeMenuItem` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildSuperBlockMergeMenuItem(
  options: { onClick: () => void },
): IMenu {
  return {
    click: () => options.onClick(),
    label: "图片合并",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/menu-items.test.ts`
Expected: PASS with the new test and existing menu-item tests all green.

- [ ] **Step 5: Commit**

```bash
git add tests/menu-items.test.ts src/core/menu-items.ts
git commit -m "test: add super block merge menu item"
```

### Task 2: Add failing workflow tests for super block image collection

**Files:**
- Create: `tests/super-block-image-merge.test.ts`
- Modify: `src/services/image-workflow.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("collectSuperBlockImageTargets returns images in DOM order", () => {
  document.body.innerHTML = `
    <div data-node-id="super-1" data-type="NodeSuperBlock">
      <div data-node-id="img-1"><img src="/assets/1.png" alt="one"></div>
      <div data-node-id="text-1"><span>text</span></div>
      <div data-node-id="img-2"><img src="/assets/2.png" alt="two"></div>
    </div>
  `;

  const superBlock = document.querySelector('[data-node-id="super-1"]') as HTMLElement;
  const targets = collectSuperBlockImageTargets(superBlock);

  expect(targets.map(target => target.blockId)).toEqual(["img-1", "img-2"]);
  expect(targets.map(target => target.src)).toEqual(["/assets/1.png", "/assets/2.png"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/super-block-image-merge.test.ts`
Expected: FAIL because `collectSuperBlockImageTargets` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function collectSuperBlockImageTargets(superBlockElement: HTMLElement): ImageTarget[] {
  const imageElements = Array.from(superBlockElement.querySelectorAll("img"));
  const seen = new Set<string>();

  return imageElements
    .map(imageElement => resolveImageTarget(imageElement))
    .filter((target): target is ImageTarget => Boolean(target))
    .filter((target) => {
      const key = `${target.blockId}|${target.src}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/super-block-image-merge.test.ts`
Expected: PASS for the collection-order test.

- [ ] **Step 5: Commit**

```bash
git add tests/super-block-image-merge.test.ts src/services/image-workflow.ts
git commit -m "test: cover super block image target collection"
```

### Task 3: Add failing workflow tests for merged canvas sizing and top alignment

**Files:**
- Modify: `tests/super-block-image-merge.test.ts`
- Modify: `src/services/image-workflow.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("mergeImagesHorizontallyTopAligned uses summed width and max height", async () => {
  const firstBitmap = { width: 120, height: 40, close: vi.fn() } as unknown as ImageBitmap;
  const secondBitmap = { width: 80, height: 60, close: vi.fn() } as unknown as ImageBitmap;
  const drawImage = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["merged"], { type: "image/webp" })));
  const getContext = vi.fn(() => ({ drawImage }));

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext,
        toBlob,
      } as unknown as HTMLCanvasElement;
    }

    return document.createElementNS("http://www.w3.org/1999/xhtml", tagName) as unknown as HTMLElement;
  }) as typeof document.createElement);

  const result = await mergeBitmapsHorizontallyTopAligned([
    { bitmap: firstBitmap, fileName: "one.png" },
    { bitmap: secondBitmap, fileName: "two.png" },
  ]);

  expect(result.width).toBe(200);
  expect(result.height).toBe(60);
  expect(drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 120, 40);
  expect(drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 120, 0, 80, 60);
  expect(result.blob.type).toBe("image/webp");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/super-block-image-merge.test.ts`
Expected: FAIL because `mergeBitmapsHorizontallyTopAligned` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function mergeBitmapsHorizontallyTopAligned(
  images: Array<{ bitmap: ImageBitmap; fileName: string }>,
): Promise<{ blob: Blob; width: number; height: number }> {
  const width = images.reduce((total, image) => total + image.bitmap.width, 0);
  const height = images.reduce((max, image) => Math.max(max, image.bitmap.height), 0);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建图片处理画布。");
  }

  let offsetX = 0;
  for (const image of images) {
    context.drawImage(image.bitmap, offsetX, 0, image.bitmap.width, image.bitmap.height);
    offsetX += image.bitmap.width;
  }

  return {
    blob: await canvasToBlob(canvas, 0.92),
    height,
    width,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/super-block-image-merge.test.ts`
Expected: PASS for collection and merge-behavior tests.

- [ ] **Step 5: Commit**

```bash
git add tests/super-block-image-merge.test.ts src/services/image-workflow.ts
git commit -m "test: cover super block image merge rendering"
```

### Task 4: Add failing plugin test for super block menu injection

**Files:**
- Modify: `tests/plugin-lifecycle.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("click-blockicon adds image merge menu item for super block with multiple images", async () => {
  const addItem = vi.fn();
  const plugin = new (await import("../src/index.ts")).default();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/plugin-lifecycle.test.ts`
Expected: FAIL because the plugin does not yet add the super block menu item.

- [ ] **Step 3: Write minimal implementation**

```ts
private decorateBlockIconMenu(detail: IEventBusMap["click-blockicon"]): void {
  const superBlockElement = detail.blockElements.find(
    blockElement => blockElement.dataset.type === "NodeSuperBlock",
  );

  if (superBlockElement) {
    const targets = collectSuperBlockImageTargets(superBlockElement);
    if (targets.length >= 2) {
      detail.menu.addItem(buildSuperBlockMergeMenuItem({
        onClick: () => {
          void this.runExclusive(async () => this.mergeImagesForSuperBlock(superBlockElement));
        },
      }));
    }
  }

  const target = resolveImageTargetFromBlockElements(detail.blockElements);
  this.decorateSingleImageMenu(detail.menu, target);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/plugin-lifecycle.test.ts`
Expected: PASS for the new menu-injection test.

- [ ] **Step 5: Commit**

```bash
git add tests/plugin-lifecycle.test.ts src/index.ts
git commit -m "test: add super block merge menu injection"
```

### Task 5: Add failing plugin test for merge action persistence

**Files:**
- Modify: `tests/plugin-lifecycle.test.ts`
- Modify: `src/index.ts`
- Modify: `src/services/image-workflow.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("mergeImagesForSuperBlock uploads merged image and inserts it after the super block", async () => {
  vi.mock("../src/services/image-workflow.ts", async () => {
    const actual = await vi.importActual("../src/services/image-workflow.ts");
    return {
      ...actual,
      collectSuperBlockImageTargets: vi.fn(() => [
        { alt: "one", blockId: "img-1", displayHeight: 10, displayWidth: 10, src: "/assets/1.png" },
        { alt: "two", blockId: "img-2", displayHeight: 10, displayWidth: 10, src: "/assets/2.png" },
      ]),
      mergeSuperBlockImages: vi.fn(async () => ({
        fileName: "superblock-merge-1.webp",
        output: { blob: new Blob(["merged"], { type: "image/webp" }), bytes: 6, height: 10, width: 20 },
      })),
    };
  });

  vi.mock("../src/services/kernel.ts", () => ({
    insertMarkdownAfterBlock: vi.fn(async () => undefined),
    uploadAsset: vi.fn(async () => "/assets/superblock-merge-1.webp"),
  }));

  const { default: Plugin } = await import("../src/index.ts");
  const plugin = new Plugin();
  const superBlockElement = document.createElement("div");
  superBlockElement.dataset.nodeId = "super-1";

  await (plugin as any).mergeImagesForSuperBlock(superBlockElement);

  const kernel = await import("../src/services/kernel.ts");
  expect(kernel.uploadAsset).toHaveBeenCalledTimes(1);
  expect(kernel.insertMarkdownAfterBlock).toHaveBeenCalledWith(
    "super-1",
    expect.stringContaining("/assets/superblock-merge-1.webp"),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/plugin-lifecycle.test.ts`
Expected: FAIL because `mergeImagesForSuperBlock` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
private async mergeImagesForSuperBlock(superBlockElement: HTMLElement): Promise<void> {
  const superBlockId = superBlockElement.dataset.nodeId;
  if (!superBlockId) {
    throw new Error("找不到超级块 ID。");
  }

  const targets = collectSuperBlockImageTargets(superBlockElement);
  if (targets.length < 2) {
    throw new Error("超级块中至少需要两张图片才能合并。");
  }

  this.reportProgress("图片合并：正在生成拼接结果");
  const merged = await mergeSuperBlockImages(targets);

  this.reportProgress("图片合并：正在上传处理结果");
  const assetPath = await uploadAsset(new File([merged.output.blob], merged.fileName, {
    type: "image/webp",
  }));

  this.reportProgress("图片合并：正在插入结果块");
  await insertMarkdownAfterBlock(superBlockId, `![图片合并](${assetPath})`);
  showMessage("图片合并完成，结果已插入到超级块下方。", 6000, "info");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/plugin-lifecycle.test.ts`
Expected: PASS for upload and insertion behavior.

- [ ] **Step 5: Commit**

```bash
git add tests/plugin-lifecycle.test.ts src/index.ts src/services/image-workflow.ts
git commit -m "feat: persist merged super block image below block"
```

### Task 6: Refine messages and guards under TDD

**Files:**
- Modify: `tests/plugin-lifecycle.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("click-blockicon does not add image merge menu item when super block has fewer than two images", async () => {
  const addItem = vi.fn();
  const plugin = new (await import("../src/index.ts")).default();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/plugin-lifecycle.test.ts`
Expected: FAIL if the menu item is added too eagerly.

- [ ] **Step 3: Write minimal implementation**

```ts
if (superBlockElement) {
  const targets = collectSuperBlockImageTargets(superBlockElement);
  if (targets.length >= 2) {
    detail.menu.addItem(buildSuperBlockMergeMenuItem({
      onClick: () => {
        void this.runExclusive(async () => this.mergeImagesForSuperBlock(superBlockElement));
      },
    }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/plugin-lifecycle.test.ts`
Expected: PASS for both positive and negative menu-injection cases.

- [ ] **Step 5: Commit**

```bash
git add tests/plugin-lifecycle.test.ts src/index.ts
git commit -m "test: guard super block merge menu visibility"
```

### Task 7: Full verification and manual SiYuan validation

**Files:**
- Modify: none expected

- [ ] **Step 1: Run focused automated tests**

Run: `npm test -- tests/menu-items.test.ts tests/super-block-image-merge.test.ts tests/plugin-lifecycle.test.ts`
Expected: PASS with 0 failures.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with 0 failures.

- [ ] **Step 3: Build the plugin**

Run: `npm run build`
Expected: successful build and refreshed `dist/` / `package.zip`.

- [ ] **Step 4: Validate against the requested SiYuan content**

Run the plugin in SiYuan and verify on:
- Document ID: `20260408222453-gf7nk4p`
- Super block ID: `20260408222732-qnw7cxp`

Expected:
- The block icon menu for the target super block shows `图片合并`.
- Clicking it inserts one merged image block immediately after the target super block.
- The super block's existing children remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/core/menu-items.ts src/services/image-workflow.ts tests/menu-items.test.ts tests/super-block-image-merge.test.ts tests/plugin-lifecycle.test.ts
git commit -m "feat: add super block image merge command"
```
