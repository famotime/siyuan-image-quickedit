import { expect, test, vi } from "vitest";

import { ensurePluginSetting } from "../src/core/plugin-setting.ts";

test("ensurePluginSetting creates and assigns the plugin setting once", () => {
  class MockSetting {
    public readonly options: { width: string };
    public readonly items: Array<{ title: string }> = [];

    constructor(options: { width: string }) {
      this.options = options;
    }

    addItem(item: unknown) {
      this.items.push(item);
    }
  }

  const host: { name: string; setting?: { options: { width: string }; items: unknown[] } } = {
    name: "siyuan-image-quickedit",
  };
  const createImageMenuToggleGroup = vi.fn(() => ({}) as HTMLElement);
  const createDocumentBatchMenuToggleGroup = vi.fn(() => ({}) as HTMLElement);
  const createLocalEditorPathInput = vi.fn(() => ({}) as HTMLElement);
  const createSuperBlockMergeOptionsGroup = vi.fn(() => ({}) as HTMLElement);
  const createCompressionStrategySelect = vi.fn(() => ({}) as HTMLElement);

  const setting = ensurePluginSetting(
    host,
    MockSetting,
    createImageMenuToggleGroup,
    createDocumentBatchMenuToggleGroup,
    createLocalEditorPathInput,
    createSuperBlockMergeOptionsGroup,
    createCompressionStrategySelect,
  );
  const reusedSetting = ensurePluginSetting(
    host,
    MockSetting,
    createImageMenuToggleGroup,
    createDocumentBatchMenuToggleGroup,
    createLocalEditorPathInput,
    createSuperBlockMergeOptionsGroup,
    createCompressionStrategySelect,
  );

  expect(setting).toBe(host.setting);
  expect(reusedSetting).toBe(setting);
  expect(setting.options.width).toBe("720px");
  expect(setting.items).toHaveLength(5);
  expect(setting.items.map(item => item.title)).toEqual([
    "本地图片编辑",
    "超级块图片合并",
    "压缩策略",
    "图片右键菜单",
    "文档批量菜单",
  ]);
  expect(createImageMenuToggleGroup).not.toHaveBeenCalled();
  expect(createDocumentBatchMenuToggleGroup).not.toHaveBeenCalled();
  expect(createLocalEditorPathInput).not.toHaveBeenCalled();
  expect(createSuperBlockMergeOptionsGroup).not.toHaveBeenCalled();
  expect(createCompressionStrategySelect).not.toHaveBeenCalled();
});
