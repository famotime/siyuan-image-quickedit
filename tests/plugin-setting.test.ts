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
  const createCommandToggleGroup = vi.fn(() => ({}) as HTMLElement);
  const createImageInfoNotificationToggle = vi.fn(() => ({}) as HTMLElement);
  const createLocalEditorPathInput = vi.fn(() => ({}) as HTMLElement);
  const createSuperBlockMergeOptionsGroup = vi.fn(() => ({}) as HTMLElement);

  const setting = ensurePluginSetting(
    host,
    MockSetting,
    createImageMenuToggleGroup,
    createCommandToggleGroup,
    createImageInfoNotificationToggle,
    createLocalEditorPathInput,
    createSuperBlockMergeOptionsGroup,
  );
  const reusedSetting = ensurePluginSetting(
    host,
    MockSetting,
    createImageMenuToggleGroup,
    createCommandToggleGroup,
    createImageInfoNotificationToggle,
    createLocalEditorPathInput,
    createSuperBlockMergeOptionsGroup,
  );

  expect(setting).toBe(host.setting);
  expect(reusedSetting).toBe(setting);
  expect(setting.options.width).toBe("640px");
  expect(setting.items).toHaveLength(6);
  expect(setting.items.map(item => item.title)).toEqual([
    "本地图片编辑",
    "图片信息通知",
    "图片右键菜单",
    "超级块图片合并",
    "文档批量菜单（新增）",
    "文档批量菜单（替换）",
  ]);
  expect(createImageMenuToggleGroup).not.toHaveBeenCalled();
  expect(createCommandToggleGroup).not.toHaveBeenCalled();
  expect(createImageInfoNotificationToggle).not.toHaveBeenCalled();
  expect(createLocalEditorPathInput).not.toHaveBeenCalled();
  expect(createSuperBlockMergeOptionsGroup).not.toHaveBeenCalled();
});
