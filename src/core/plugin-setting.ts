import type { PluginSettings } from "@/core/command-settings.ts";

type SettingLike = {
  addItem(item: {
    createActionElement: () => HTMLElement;
    description: string;
    direction: "column";
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
  createCommandToggleGroup: (settingKey: keyof PluginSettings) => HTMLElement,
): TSetting {
  if (host.setting) {
    return host.setting;
  }

  const setting = new SettingCtor({
    width: "640px",
  });

  setting.addItem({
    createActionElement: () => createCommandToggleGroup("imageMenuCommands"),
    description: "控制图片右键菜单里展示哪些单图操作。",
    direction: "column",
    title: "图片右键菜单",
  });
  setting.addItem({
    createActionElement: () => createCommandToggleGroup("documentInsertMenuCommands"),
    description: "控制文档标题菜单里展示哪些批量新增命令。",
    direction: "column",
    title: "文档批量菜单（新增）",
  });
  setting.addItem({
    createActionElement: () => createCommandToggleGroup("documentReplaceMenuCommands"),
    description: "控制文档标题菜单里展示哪些批量替换命令。",
    direction: "column",
    title: "文档批量菜单（替换）",
  });

  host.setting = setting;
  return setting;
}
