import type { IEventBusMap, IProtyle } from "siyuan";
import {
  Plugin,
  Setting,
  confirm,
  showMessage,
} from "siyuan";

import "@/index.scss";
import { COMMAND_DEFINITIONS } from "@/core/command-meta.ts";
import {
  COMMAND_ORDER,
  DEFAULT_SETTINGS,
  type CommandId,
  type PluginSettings,
  getEnabledCommandIds,
  mergeSettings,
} from "@/core/command-settings.ts";
import { buildImageQuickEditSubmenuItems } from "@/core/menu-items.ts";
import { runTargetsSequentially } from "@/core/task-runner.ts";
import { insertMarkdownAfterBlock, uploadAsset } from "@/services/kernel.ts";
import {
  buildImageInfoForTarget,
  buildProcessedResultMarkdown,
  collectImageTargets,
  prepareProcessedImage,
  resolveImageTarget,
  resolveImageTargetFromBlockElements,
  type ImageTarget,
} from "@/services/image-workflow.ts";
import PluginInfo from "@/../plugin.json";

const SETTINGS_STORAGE = "settings.json";
const PROGRESS_MESSAGE_ID = "siyuan-image-quickedit-progress";

export default class SiyuanImageQuickEditPlugin extends Plugin {
  private readonly imageInfoCache = new Map<string, string>();
  private isProcessing = false;
  private settings: PluginSettings = DEFAULT_SETTINGS;

  private readonly onImageMenu = (event: CustomEvent<IEventBusMap["open-menu-image"]>) => {
    void this.decorateImageMenu(event.detail);
  };

  private readonly onBlockIcon = (event: CustomEvent<IEventBusMap["click-blockicon"]>) => {
    void this.decorateBlockIconMenu(event.detail);
  };

  private readonly onEditorTitleIcon = (event: CustomEvent<IEventBusMap["click-editortitleicon"]>) => {
    this.decorateDocumentMenu(event.detail.protyle, event.detail.menu);
  };

  public readonly version = PluginInfo.version;

  async onload() {
    this.settings = mergeSettings(await this.loadData(SETTINGS_STORAGE));

    this.eventBus.on("open-menu-image", this.onImageMenu);
    this.eventBus.on("click-blockicon", this.onBlockIcon);
    this.eventBus.on("click-editortitleicon", this.onEditorTitleIcon);
    this.addCommand({
      callback: () => this.openSetting(),
      hotkey: "",
      langKey: "openSetting",
    });
  }

  onunload() {
    this.eventBus.off("open-menu-image", this.onImageMenu);
    this.eventBus.off("click-blockicon", this.onBlockIcon);
    this.eventBus.off("click-editortitleicon", this.onEditorTitleIcon);
  }

  openSetting() {
    const setting = new Setting({
      width: "640px",
    });

    setting.addItem({
      createActionElement: () => this.createCommandToggleGroup("imageMenuCommands", false),
      description: "控制图片右键菜单里展示哪些单图操作。",
      direction: "column",
      title: "图片右键菜单",
    });
    setting.addItem({
      createActionElement: () => this.createCommandToggleGroup("documentMenuCommands", true),
      description: "控制文档标题菜单里展示哪些批量处理命令。",
      direction: "column",
      title: "文档批量菜单",
    });
    setting.open(this.name);
  }

  private createCommandToggleGroup(settingKey: keyof PluginSettings, useBatchLabel: boolean): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-group";

    for (const commandId of COMMAND_ORDER) {
      const label = document.createElement("label");
      label.className = "image-quickedit-setting-option";

      const checkbox = document.createElement("input");
      checkbox.checked = this.settings[settingKey][commandId];
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => {
        this.settings = mergeSettings({
          ...this.settings,
          [settingKey]: {
            ...this.settings[settingKey],
            [commandId]: checkbox.checked,
          },
        });
        void this.saveData(SETTINGS_STORAGE, this.settings);
      });

      const text = document.createElement("span");
      text.textContent = useBatchLabel
        ? COMMAND_DEFINITIONS[commandId].batchLabel
        : COMMAND_DEFINITIONS[commandId].label;

      label.append(checkbox, text);
      wrapper.append(label);
    }

    return wrapper;
  }

  private decorateImageMenu(detail: IEventBusMap["open-menu-image"]): void {
    const target = resolveImageTarget(detail.element);
    this.decorateSingleImageMenu(detail.menu, target);
  }

  private decorateBlockIconMenu(detail: IEventBusMap["click-blockicon"]): void {
    const target = resolveImageTargetFromBlockElements(detail.blockElements);
    this.decorateSingleImageMenu(detail.menu, target);
  }

  private decorateSingleImageMenu(
    menu: IEventBusMap["open-menu-image"]["menu"] | IEventBusMap["click-blockicon"]["menu"],
    target: ImageTarget | null,
  ): void {
    if (!target) {
      return;
    }

    const enabledCommands = getEnabledCommandIds(this.settings.imageMenuCommands);
    if (!enabledCommands.length) {
      return;
    }

    const cacheKey = `${target.blockId}|${target.src}`;
    const submenu = buildImageQuickEditSubmenuItems({
      commandIds: enabledCommands,
      imageInfoLabel: this.imageInfoCache.get(cacheKey) || "读取图片信息中...",
      onCommandClick: (commandId) => {
        void this.runExclusive(async () => this.processSingleTarget(target, commandId));
      },
    });
    const infoItem = submenu[0];
    infoItem.bind = (element) => {
      infoItem.element = element;
      this.syncInfoItemElement(infoItem);
    };

    menu.addItem({
      icon: "iconImage",
      label: "图片快剪",
      submenu,
    });

    void this.hydrateImageInfo(cacheKey, target, infoItem);
  }

  private syncInfoItemElement(infoItem: { element?: HTMLElement; label?: string }): void {
    const labelElement = infoItem.element?.querySelector(".b3-menu__label");
    if (labelElement) {
      labelElement.textContent = infoItem.label || "";
    }
  }

  private async hydrateImageInfo(
    cacheKey: string,
    target: ImageTarget,
    infoItem: { element?: HTMLElement; label?: string },
  ): Promise<void> {
    try {
      const imageInfo = await buildImageInfoForTarget(target);
      this.imageInfoCache.set(cacheKey, imageInfo);
      infoItem.label = imageInfo;
      this.syncInfoItemElement(infoItem);
      showMessage(`图片信息：${imageInfo}`, 5000, "info");
    }
    catch (error) {
      console.error("[siyuan-image-quickedit] Failed to inspect image info", error);
    }
  }

  private decorateDocumentMenu(protyle: IProtyle, menu: IEventBusMap["click-editortitleicon"]["menu"]): void {
    const enabledCommands = getEnabledCommandIds(this.settings.documentMenuCommands);
    if (!enabledCommands.length) {
      return;
    }

    const targets = collectImageTargets(protyle);
    if (!targets.length) {
      return;
    }

    menu.addItem({
      icon: "iconImage",
      label: "图片快剪",
      submenu: enabledCommands.map(commandId => ({
        label: COMMAND_DEFINITIONS[commandId].batchLabel,
        click: () => {
          confirm(
            "思源图片快剪",
            `将对本文档中的 ${targets.length} 张图片执行“${COMMAND_DEFINITIONS[commandId].batchLabel}”。原图不会删除，处理结果会插入到对应图片块后方。`,
            () => {
              void this.runExclusive(async () => this.processDocumentTargets(targets, commandId));
            },
          );
        },
      })),
    });
  }

  private async runExclusive(task: () => Promise<void>): Promise<void> {
    if (this.isProcessing) {
      showMessage("图片快剪正在处理，请等待当前任务完成。", 4000, "error");
      return;
    }

    this.isProcessing = true;
    try {
      await task();
    }
    finally {
      this.isProcessing = false;
    }
  }

  private reportProgress(message: string): void {
    showMessage(message, 3000, "info", PROGRESS_MESSAGE_ID);
  }

  private async processSingleTarget(target: ImageTarget, commandId: CommandId): Promise<void> {
    try {
      const result = await this.processAndInsertTarget(target, commandId);
      showMessage(`${COMMAND_DEFINITIONS[commandId].label}完成：${result}`, 6000, "info");
    }
    catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), 6000, "error");
    }
  }

  private async processDocumentTargets(targets: ImageTarget[], commandId: CommandId): Promise<void> {
    const indexedTargets = targets.map((target, index) => ({
      ...target,
      executionId: `${target.blockId}-${index}`,
    }));
    const targetMap = new Map(indexedTargets.map(target => [target.executionId, target]));

    const result = await runTargetsSequentially({
      commandId,
      onProgress: message => this.reportProgress(`${COMMAND_DEFINITIONS[commandId].batchLabel}：${message}`),
      runTarget: async ({ id }) => {
        const target = targetMap.get(id);
        if (!target) {
          throw new Error(`找不到图片任务：${id}`);
        }

        const summary = await this.processAndInsertTarget(target, commandId);
        return { summary };
      },
      targets: indexedTargets.map((target, index) => ({
        id: target.executionId,
        label: `第 ${index + 1} 张图片`,
      })),
    });

    const failureSummary = result.failures.length
      ? `失败 ${result.failures.length}`
      : "无失败";
    showMessage(
      `${COMMAND_DEFINITIONS[commandId].batchLabel}完成：成功 ${result.successes.length}，${failureSummary}。`,
      7000,
      result.failures.length ? "error" : "info",
    );
  }

  private async processAndInsertTarget(target: ImageTarget, commandId: CommandId): Promise<string> {
    this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：正在读取图片`);
    const prepared = await prepareProcessedImage(
      target,
      commandId,
      message => this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：${message}`),
    );

    this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：正在上传处理结果`);
    const file = new File([prepared.output.blob], prepared.fileName, {
      type: "image/webp",
    });
    const assetPath = await uploadAsset(file);

    this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：正在插入结果块`);
    const markdown = buildProcessedResultMarkdown(prepared, assetPath);
    await insertMarkdownAfterBlock(target.blockId, markdown);

    return markdown.split("\n", 1)[0];
  }
}
