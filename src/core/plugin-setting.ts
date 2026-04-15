import type { CommandMenuSettingKey } from "@/core/command-settings.ts";

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
  createImageMenuToggleGroup: () => HTMLElement,
  createCommandToggleGroup: (settingKey: CommandMenuSettingKey) => HTMLElement,
  createImageInfoNotificationToggle: () => HTMLElement,
  createLocalEditorPathInput: () => HTMLElement,
  createSuperBlockMergeOptionsGroup: () => HTMLElement,
): TSetting {
  if (host.setting) {
    return host.setting;
  }

  const setting = new SettingCtor({
    width: "640px",
  });

  setting.addItem({
    createActionElement: createLocalEditorPathInput,
    description: "填写本地图片编辑器的可执行文件路径，配置后可直接在图片菜单中调用本地软件编辑。",
    direction: "column",
    title: "本地图片编辑",
  });
  setting.addItem({
    createActionElement: createImageInfoNotificationToggle,
    description: "控制右键打开图片菜单时，是否额外弹出一条图片信息通知。",
    direction: "column",
    title: "图片信息通知",
  });
  setting.addItem({
    createActionElement: createImageMenuToggleGroup,
    description: "控制图片右键菜单里展示哪些单图操作，以及是否显示超级块图片合并。",
    direction: "column",
    title: "图片右键菜单",
  });
  setting.addItem({
    createActionElement: createSuperBlockMergeOptionsGroup,
    description: "仅影响超级块图片合并结果，可设置图片间距和每张图片的边框样式。",
    direction: "column",
    title: "超级块图片合并",
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
