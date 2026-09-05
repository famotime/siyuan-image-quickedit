import type { CommandMenuSettingKey } from "@/core/command-settings.ts";

type SettingLike = {
  addItem(item: {
    createActionElement: () => HTMLElement;
    description?: string;
    direction?: "column" | "row";
    title: string;
  }): void;
  open(name: string): void;
};

type SettingConstructor<TSetting extends SettingLike> = new (options: { width: string }) => TSetting;

type SettingHost<TSetting extends SettingLike> = {
  name: string;
  setting?: TSetting;
};

export function ensurePluginSetting<TSetting extends SettingLike>(
  host: SettingHost<TSetting>,
  SettingCtor: SettingConstructor<TSetting>,
  createImageMenuToggleGroup: () => HTMLElement,
  createDocumentBatchMenuToggleGroup: () => HTMLElement,
  createLocalEditorPathInput: () => HTMLElement,
  createSuperBlockMergeOptionsGroup: () => HTMLElement,
  createCompressionStrategySelect: () => HTMLElement,
): TSetting {
  if (host.setting) {
    return host.setting;
  }

  const setting = new SettingCtor({
    width: "720px",
  });

  setting.addItem({
    createActionElement: createLocalEditorPathInput,
    description: "",
    direction: "row",
    title: "本地图片编辑",
  });
  setting.addItem({
    createActionElement: createSuperBlockMergeOptionsGroup,
    description: "",
    direction: "row",
    title: "超级块图片合并",
  });
  setting.addItem({
    createActionElement: createCompressionStrategySelect,
    description: "",
    direction: "row",
    title: "压缩策略",
  });
  setting.addItem({
    createActionElement: createImageMenuToggleGroup,
    description: "",
    direction: "row",
    title: "图片右键菜单",
  });
  setting.addItem({
    createActionElement: createDocumentBatchMenuToggleGroup,
    description: "",
    direction: "row",
    title: "文档批量菜单",
  });

  host.setting = setting;
  return setting;
}
