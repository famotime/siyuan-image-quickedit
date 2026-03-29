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
  type CommandMenuSettingKey,
  type CommandId,
  type PluginSettings,
  getEnabledCommandIds,
  mergeSettings,
} from "@/core/command-settings.ts";
import { buildBatchResultMessage } from "@/core/formatters.ts";
import {
  buildDocumentBatchSubmenuItems,
  buildImageQuickEditSubmenuItems,
  syncReadonlyMenuItemLabelElement,
  type DocumentBatchMode,
} from "@/core/menu-items.ts";
import { ensurePluginSetting } from "@/core/plugin-setting.ts";
import { runTargetsSequentially } from "@/core/task-runner.ts";
import {
  getBlockMarkdown,
  insertMarkdownAfterBlock,
  updateMarkdownBlock,
  uploadAsset,
} from "@/services/kernel.ts";
import {
  buildReplacedBlockMarkdown,
  buildImageInfoForTarget,
  buildProcessedResultMarkdown,
  collectImageTargets,
  prepareProcessedImage,
  resolveImageTarget,
  resolveImageTargetFromBlockElements,
  type ImageTarget,
} from "@/services/image-workflow.ts";
import {
  createEditedImagePreviewUrl,
  openLocalEditorAndWait,
  removeCacheBustingSearchParam,
  resolveLocalEditorImagePath,
} from "@/services/local-editor.ts";
import { showMultilineMessage } from "@/services/message-display.ts";
import PluginInfo from "@/../plugin.json";

const SETTINGS_STORAGE = "settings.json";
const IMAGE_INFO_MESSAGE_ID = "siyuan-image-quickedit-image-info";
const PROGRESS_MESSAGE_ID = "siyuan-image-quickedit-progress";
const LOCAL_EDITOR_REFRESH_DELAY_MS = 200;

export default class SiyuanImageQuickEditPlugin extends Plugin {
  private readonly imageInfoCache = new Map<string, string>();
  private readonly localEditorPreviewUrls = new Map<HTMLImageElement, string>();
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
    ensurePluginSetting(
      this,
      Setting,
      this.createCommandToggleGroup.bind(this),
      this.createLocalEditorPathInput.bind(this),
    );

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
    this.disposeLocalEditorPreviewUrls();
  }

  async uninstall() {
    try {
      await this.removeData(SETTINGS_STORAGE);
    }
    catch (error) {
      const detail = error instanceof Error
        ? error.message
        : typeof error === "object" && error && "msg" in error
          ? String(error.msg)
          : String(error);
      showMessage(`uninstall [${this.name}] remove data [${SETTINGS_STORAGE}] fail: ${detail}`);
    }
  }

  openSetting() {
    ensurePluginSetting(
      this,
      Setting,
      this.createCommandToggleGroup.bind(this),
      this.createLocalEditorPathInput.bind(this),
    ).open(this.name);
  }

  private createCommandToggleGroup(settingKey: CommandMenuSettingKey): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-group";

    for (const commandId of COMMAND_ORDER) {
      const label = document.createElement("label");
      label.className = "image-quickedit-setting-option";

      const checkbox = document.createElement("input");
      checkbox.checked = this.settings[settingKey][commandId];
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => {
        this.persistSettings({
          [settingKey]: {
            ...this.settings[settingKey],
            [commandId]: checkbox.checked,
          },
        });
      });

      const text = document.createElement("span");
      text.textContent = settingKey === "documentInsertMenuCommands"
        ? COMMAND_DEFINITIONS[commandId].insertBatchLabel
        : settingKey === "documentReplaceMenuCommands"
          ? COMMAND_DEFINITIONS[commandId].replaceBatchLabel
          : COMMAND_DEFINITIONS[commandId].label;

      label.append(checkbox, text);
      wrapper.append(label);
    }

    return wrapper;
  }

  private createLocalEditorPathInput(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-path";

    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.placeholder = "例如：C:\\Program Files\\paint.net\\PaintDotNet.exe";
    input.spellcheck = false;
    input.type = "text";
    input.value = this.settings.localEditorPath;

    const savePath = () => {
      const nextPath = input.value.trim();
      if (nextPath === this.settings.localEditorPath) {
        return;
      }

      this.persistSettings({
        localEditorPath: nextPath,
      });
    };

    input.addEventListener("change", savePath);
    input.addEventListener("blur", savePath);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        savePath();
      }
    });

    const hint = document.createElement("div");
    hint.className = "image-quickedit-setting-hint";
    hint.textContent = "可执行文件路径，不含引号。";

    wrapper.append(input, hint);
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
      onOpenLocalEditor: () => {
        void this.runExclusive(async () => this.editImageWithLocalEditor(target));
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
      syncReadonlyMenuItemLabelElement(labelElement, infoItem.label || "");
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
      showMultilineMessage({
        id: IMAGE_INFO_MESSAGE_ID,
        show: showMessage,
        text: `图片信息：${imageInfo}`,
        timeout: 5000,
        type: "info",
      });
    }
    catch (error) {
      console.error("[siyuan-image-quickedit] Failed to inspect image info", error);
    }
  }

  private decorateDocumentMenu(protyle: IProtyle, menu: IEventBusMap["click-editortitleicon"]["menu"]): void {
    const enabledInsertCommands = getEnabledCommandIds(this.settings.documentInsertMenuCommands);
    const enabledReplaceCommands = getEnabledCommandIds(this.settings.documentReplaceMenuCommands);
    if (!enabledInsertCommands.length && !enabledReplaceCommands.length) {
      return;
    }

    const targets = collectImageTargets(protyle);
    if (!targets.length) {
      return;
    }

    menu.addItem({
      icon: "iconImage",
      label: "图片快剪",
      submenu: buildDocumentBatchSubmenuItems({
        insertCommandIds: enabledInsertCommands,
        replaceCommandIds: enabledReplaceCommands,
        onCommandClick: (commandId, mode) => {
          const commandLabel = mode === "replace"
            ? COMMAND_DEFINITIONS[commandId].replaceBatchLabel
            : COMMAND_DEFINITIONS[commandId].insertBatchLabel;
          const detail = mode === "replace"
            ? "原图将被直接替换，正文文本保持不变。"
            : "原图不会删除，处理结果会插入到对应图片块后方。";

          confirm(
            "思源图片快剪",
            `将对本文档中的 ${targets.length} 张图片执行“${commandLabel}”。${detail}`,
            () => {
              void this.runExclusive(async () => this.processDocumentTargets(targets, commandId, mode));
            },
          );
        },
      }),
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

  private persistSettings(nextSettings: Partial<PluginSettings>): void {
    this.settings = mergeSettings({
      ...this.settings,
      ...nextSettings,
    });
    void this.saveData(SETTINGS_STORAGE, this.settings);
  }

  private async processSingleTarget(target: ImageTarget, commandId: CommandId): Promise<void> {
    try {
      const result = await this.processTarget(target, commandId, "insert");
      showMessage(`${COMMAND_DEFINITIONS[commandId].label}完成：${result.summary}`, 6000, "info");
    }
    catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), 6000, "error");
    }
  }

  private async editImageWithLocalEditor(target: ImageTarget): Promise<void> {
    const editorPath = this.settings.localEditorPath.trim();
    if (!editorPath) {
      showMessage("请先在插件设置中配置本地图片编辑器路径。", 5000, "error");
      return;
    }

    if (!navigator.userAgent.includes("Electron")) {
      showMessage("本地图片编辑仅支持 Electron 桌面端。", 5000, "error");
      return;
    }

    const dataDir = this.getSiyuanDataDir();
    if (!dataDir) {
      showMessage("无法读取思源工作空间数据目录。", 5000, "error");
      return;
    }

    try {
      const imagePath = resolveLocalEditorImagePath(target.src, {
        dataDir,
        origin: location.origin,
      });

      this.reportProgress("本地图片编辑：正在打开编辑器");
      await openLocalEditorAndWait({
        editorPath,
        imagePath,
      });
      await this.delay(LOCAL_EDITOR_REFRESH_DELAY_MS);

      this.reportProgress("本地图片编辑：正在刷新图片");
      const refreshedCount = await this.refreshEditedImages(imagePath, dataDir);
      showMessage(
        refreshedCount > 0
          ? `本地图片编辑完成，已刷新 ${refreshedCount} 张图片。`
          : "本地图片编辑完成，但未找到可刷新的图片块。",
        6000,
        "info",
      );
    }
    catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), 6000, "error");
    }
  }

  private async processDocumentTargets(
    targets: ImageTarget[],
    commandId: CommandId,
    mode: DocumentBatchMode,
  ): Promise<void> {
    const indexedTargets = targets.map((target, index) => ({
      ...target,
      executionId: `${target.blockId}-${index}`,
    }));
    const targetMap = new Map(indexedTargets.map(target => [target.executionId, target]));
    const batchCommandLabel = mode === "replace"
      ? COMMAND_DEFINITIONS[commandId].replaceBatchLabel
      : COMMAND_DEFINITIONS[commandId].insertBatchLabel;

    const result = await runTargetsSequentially({
      commandId,
      onProgress: message => this.reportProgress(`${batchCommandLabel}：${message}`),
      runTarget: async ({ id }) => {
        const target = targetMap.get(id);
        if (!target) {
          throw new Error(`找不到图片任务：${id}`);
        }

        return this.processTarget(target, commandId, mode);
      },
      targets: indexedTargets.map((target, index) => ({
        id: target.executionId,
        label: `第 ${index + 1} 张图片`,
      })),
    });

    const savedBytes = result.successes.reduce((total, success) => {
      return total + Math.max(0, success.originalBytes - success.outputBytes);
    }, 0);
    const summaryMessage = buildBatchResultMessage({
      failureCount: result.failures.length,
      mode,
      processedCount: targets.length,
      savedBytes,
      successCount: result.successes.length,
    });

    showMessage(
      summaryMessage,
      7000,
      result.failures.length ? "error" : "info",
    );
  }

  private async processTarget(
    target: ImageTarget,
    commandId: CommandId,
    mode: DocumentBatchMode,
  ): Promise<{
    originalBytes: number;
    outputBytes: number;
    summary: string;
  }> {
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

    if (mode === "replace") {
      this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：正在替换原图`);
      const blockMarkdown = await getBlockMarkdown(target.blockId);
      const updatedMarkdown = buildReplacedBlockMarkdown(blockMarkdown, target, assetPath);
      await updateMarkdownBlock(target.blockId, updatedMarkdown);

      return {
        originalBytes: prepared.original.bytes,
        outputBytes: prepared.output.bytes,
        summary: `${COMMAND_DEFINITIONS[commandId].label}已直接替换原图`,
      };
    }

    this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：正在插入结果块`);
    const markdown = buildProcessedResultMarkdown(prepared, assetPath);
    await insertMarkdownAfterBlock(target.blockId, markdown);

    return {
      originalBytes: prepared.original.bytes,
      outputBytes: prepared.output.bytes,
      summary: markdown.split("\n", 1)[0],
    };
  }

  private getSiyuanDataDir(): string {
    const siyuanWindow = window as Window & {
      siyuan?: {
        config?: {
          system?: {
            dataDir?: string;
          };
        };
      };
    };

    return siyuanWindow.siyuan?.config?.system?.dataDir || "";
  }

  private async refreshEditedImages(editedImagePath: string, dataDir: string): Promise<number> {
    const imageElements = Array.from(document.querySelectorAll<HTMLImageElement>(".protyle-wysiwyg img"));
    let refreshedCount = 0;

    for (const imageElement of imageElements) {
      const stableSrc = this.getStableImageSrc(imageElement);
      if (!stableSrc) {
        continue;
      }

      try {
        const candidatePath = resolveLocalEditorImagePath(stableSrc, {
          dataDir,
          origin: location.origin,
        });
        if (candidatePath !== editedImagePath) {
          continue;
        }
      }
      catch {
        continue;
      }

      const previewUrl = await createEditedImagePreviewUrl(stableSrc);
      this.replaceLocalEditorPreviewUrl(imageElement, previewUrl);
      imageElement.dataset.src = stableSrc;

      refreshedCount += 1;
    }

    return refreshedCount;
  }

  private async delay(timeout: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, timeout));
  }

  private getStableImageSrc(imageElement: HTMLImageElement): string {
    const source = imageElement.dataset.src
      || imageElement.getAttribute("src")
      || imageElement.currentSrc
      || imageElement.src;
    if (!source) {
      return "";
    }

    return removeCacheBustingSearchParam(source);
  }

  private replaceLocalEditorPreviewUrl(imageElement: HTMLImageElement, previewUrl: string): void {
    const currentPreviewUrl = this.localEditorPreviewUrls.get(imageElement);
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
    }

    this.localEditorPreviewUrls.set(imageElement, previewUrl);
    imageElement.src = previewUrl;
  }

  private disposeLocalEditorPreviewUrls(): void {
    for (const previewUrl of this.localEditorPreviewUrls.values()) {
      URL.revokeObjectURL(previewUrl);
    }

    this.localEditorPreviewUrls.clear();
  }
}
