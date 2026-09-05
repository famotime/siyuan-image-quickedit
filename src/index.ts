import type { IEventBusMap, IProtyle } from "siyuan";
import {
  Plugin,
  Setting,
  confirm,
  getActiveEditor,
  showMessage,
} from "siyuan";

import "@/index.scss";
import {
  COMMAND_DEFINITIONS,
  DOCUMENT_BATCH_COMMAND_DEFINITIONS,
} from "@/core/command-meta.ts";
import {
  COMMAND_ORDER,
  DOCUMENT_BATCH_COMMAND_ORDER,
  DEFAULT_SETTINGS,
  DEFAULT_SUPER_BLOCK_MERGE_OPTIONS,
  type CommandMenuSettingKey,
  type CommandId,
  type CompressionStrategy,
  type DocumentBatchCommandId,
  type PluginSettings,
  type SuperBlockMergeOptions,
  getEnabledCommandIds,
  getEnabledDocumentBatchCommandIds,
  mergeSettings,
} from "@/core/command-settings.ts";
import {
  buildBatchResultMessage,
  buildDocumentImageSummaryLabel,
  formatBytes,
} from "@/core/formatters.ts";
import {
  buildDocumentBatchSubmenuItems,
  buildImageQuickEditSubmenuItems,
  syncReadonlyMenuItemLabelElement,
  type DocumentBatchMode,
} from "@/core/menu-items.ts";
import {
  createPowerButtonsProvider,
  parsePublicPowerButtonsCommandId,
} from "@/core/power-buttons-provider.ts";
import type {
  PowerButtonsCommandProvider,
  PowerButtonsInvokeContext,
  PowerButtonsInvokeResult,
} from "@/core/power-buttons-provider-types.ts";
import { ensurePluginSetting } from "@/core/plugin-setting.ts";
import { runTargetsSequentially } from "@/core/task-runner.ts";
import {
  getBlockMarkdown,
  insertMarkdownAfterBlock,
  updateMarkdownBlock,
  uploadAsset,
} from "@/services/kernel.ts";
import {
  addBorderToImageTarget as prepareBorderedImage,
  buildReplacedBlockMarkdown,
  buildImageInfoForTarget,
  buildProcessedResultMarkdown,
  collectSuperBlockImageTargets,
  collectImageTargets,
  collectImageTargetsByDocId,
  mergeSuperBlockImages,
  prepareProcessedImage,
  resolveImageTarget,
  resolveImageTargetFromBlockElements,
  type ImageTarget,
} from "@/services/image-workflow.ts";
import {
  cleanupLocalEditorEditSession,
  commitLocalEditorEditSession,
  createEditedImagePreviewUrl,
  openLocalEditorAndWait,
  prepareLocalEditorEditSession,
  removeCacheBustingSearchParam,
  resolveLocalEditorImageSource,
  resolveLocalEditorImagePath,
} from "@/services/local-editor.ts";
import { loadDocumentEmbeddedAssetBytes } from "@/services/document-asset-stats.ts";
import { notifyImageInfo } from "@/services/image-info-notification.ts";
import PluginInfo from "@/../plugin.json";

const SETTINGS_STORAGE = "settings.json";
const IMAGE_INFO_MESSAGE_ID = "siyuan-image-quickedit-image-info";
const PROGRESS_MESSAGE_ID = "siyuan-image-quickedit-progress";
const LOCAL_EDITOR_REFRESH_DELAY_MS = 200;

export default class SiyuanImageQuickEditPlugin extends Plugin {
  private readonly imageInfoCache = new Map<string, string>();
  private readonly localEditorPreviewUrls = new Map<HTMLImageElement, string>();
  private readonly powerButtonsProvider: PowerButtonsCommandProvider = createPowerButtonsProvider({
    invokeCommand: (commandId, context) => this.invokePowerButtonsCommand(commandId, context),
    pluginVersion: PluginInfo.version,
  });
  private isProcessing = false;
  private settings: PluginSettings = DEFAULT_SETTINGS;

  private readonly onImageMenu = (event: CustomEvent<IEventBusMap["open-menu-image"]>) => {
    void this.decorateImageMenu(event.detail);
  };

  private readonly onBlockIcon = (event: CustomEvent<IEventBusMap["click-blockicon"]>) => {
    void this.decorateBlockIconMenu(event.detail);
  };

  private readonly onEditorTitleIcon = (event: CustomEvent<IEventBusMap["click-editortitleicon"]>) => {
    this.decorateDocumentMenu(event.detail.protyle, event.detail.menu, event.detail.data);
  };

  public readonly version = PluginInfo.version;

  async onload() {
    this.settings = mergeSettings(await this.loadData(SETTINGS_STORAGE));
    ensurePluginSetting(
      this,
      Setting,
      this.createImageMenuToggleGroup.bind(this),
      this.createDocumentBatchMenuToggleGroup.bind(this),
      this.createLocalEditorPathInput.bind(this),
      this.createSuperBlockMergeOptionsGroup.bind(this),
      this.createCompressionStrategySelect.bind(this),
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
      this.createImageMenuToggleGroup.bind(this),
      this.createDocumentBatchMenuToggleGroup.bind(this),
      this.createLocalEditorPathInput.bind(this),
      this.createSuperBlockMergeOptionsGroup.bind(this),
      this.createCompressionStrategySelect.bind(this),
    ).open(this.name);
  }

  public getPowerButtonsIntegration(): PowerButtonsCommandProvider {
    return this.powerButtonsProvider;
  }

  private createCardCheckboxOption(options: {
    checked: boolean;
    label: string;
    badge?: { text: string; type: "insert" | "replace" };
    onChange: (checked: boolean) => void;
  }): HTMLLabelElement {
    const card = document.createElement("label");
    card.className = `image-quickedit-setting-card image-quickedit-setting-option${options.checked ? " is-checked" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = options.checked;

    const content = document.createElement("div");
    content.className = "image-quickedit-card-content";

    const title = document.createElement("span");
    title.className = "image-quickedit-card-title";
    title.textContent = options.label;
    content.appendChild(title);

    if (options.badge) {
      const badge = document.createElement("span");
      badge.className = `image-quickedit-badge is-${options.badge.type}`;
      badge.textContent = options.badge.text;
      content.appendChild(badge);
    }

    checkbox.addEventListener("change", () => {
      card.classList.toggle("is-checked", checkbox.checked);
      options.onChange(checkbox.checked);
    });

    card.append(checkbox, content);
    return card;
  }

  private createCommandToggleGroup(settingKey: CommandMenuSettingKey): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-group";

    const isImageMenu = settingKey === "imageMenuCommands";
    const commandIds = isImageMenu ? COMMAND_ORDER : DOCUMENT_BATCH_COMMAND_ORDER;

    // 快捷操作工具条
    const toolbar = document.createElement("div");
    toolbar.className = "image-quickedit-toolbar";

    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "image-quickedit-tool-btn";
    selectAllBtn.textContent = "全选";

    const unselectAllBtn = document.createElement("button");
    unselectAllBtn.type = "button";
    unselectAllBtn.className = "image-quickedit-tool-btn";
    unselectAllBtn.textContent = "取消全选";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "image-quickedit-tool-btn";
    resetBtn.textContent = "恢复默认";

    toolbar.append(selectAllBtn, unselectAllBtn, resetBtn);
    wrapper.appendChild(toolbar);

    const grid = document.createElement("div");
    grid.className = "image-quickedit-setting-grid";
    wrapper.appendChild(grid);

    for (const commandId of commandIds) {
      const isChecked = isImageMenu
        ? this.settings.imageMenuCommands[commandId as CommandId]
        : this.settings[settingKey][commandId as DocumentBatchCommandId];

      let labelText = "";
      let badgeInfo: { text: string; type: "insert" | "replace" } | undefined;

      if (isImageMenu) {
        labelText = COMMAND_DEFINITIONS[commandId as CommandId].label;
      }
      else if (settingKey === "documentInsertMenuCommands") {
        const rawLabel = DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId as DocumentBatchCommandId].insertBatchLabel;
        labelText = rawLabel.replace("（新增）", "");
        badgeInfo = { text: "（新增）", type: "insert" };
      }
      else {
        const rawLabel = DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId as DocumentBatchCommandId].replaceBatchLabel;
        labelText = rawLabel.replace("（替换）", "");
        badgeInfo = { text: "（替换）", type: "replace" };
      }

      const card = this.createCardCheckboxOption({
        badge: badgeInfo,
        checked: isChecked,
        label: labelText,
        onChange: (checked) => {
          if (isImageMenu) {
            this.persistSettings({
              imageMenuCommands: {
                ...this.settings.imageMenuCommands,
                [commandId]: checked,
              },
            });
            return;
          }

          this.persistSettings({
            [settingKey]: {
              ...this.settings[settingKey],
              [commandId]: checked,
            },
          });
        },
      });

      grid.appendChild(card);
    }

    selectAllBtn.addEventListener("click", () => {
      const checkboxes = grid.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
      checkboxes.forEach((cb) => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    unselectAllBtn.addEventListener("click", () => {
      const checkboxes = grid.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
      checkboxes.forEach((cb) => {
        if (cb.checked) {
          cb.checked = false;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    resetBtn.addEventListener("click", () => {
      const defaultMap = isImageMenu
        ? DEFAULT_SETTINGS.imageMenuCommands
        : DEFAULT_SETTINGS[settingKey];
      const checkboxes = grid.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
      checkboxes.forEach((cb, idx) => {
        const id = commandIds[idx];
        if (!id) return;
        const defaultVal = Boolean((defaultMap as any)[id]);
        if (cb.checked !== defaultVal) {
          cb.checked = defaultVal;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    return wrapper;
  }

  private createDocumentBatchMenuToggleGroup(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-group";

    // 快捷工具栏
    const toolbar = document.createElement("div");
    toolbar.className = "image-quickedit-toolbar";

    const selectAllInsertBtn = document.createElement("button");
    selectAllInsertBtn.type = "button";
    selectAllInsertBtn.className = "image-quickedit-tool-btn";
    selectAllInsertBtn.textContent = "全选新增";

    const unselectAllInsertBtn = document.createElement("button");
    unselectAllInsertBtn.type = "button";
    unselectAllInsertBtn.className = "image-quickedit-tool-btn";
    unselectAllInsertBtn.textContent = "清空新增";

    const selectAllReplaceBtn = document.createElement("button");
    selectAllReplaceBtn.type = "button";
    selectAllReplaceBtn.className = "image-quickedit-tool-btn";
    selectAllReplaceBtn.textContent = "全选替换";

    const unselectAllReplaceBtn = document.createElement("button");
    unselectAllReplaceBtn.type = "button";
    unselectAllReplaceBtn.className = "image-quickedit-tool-btn";
    unselectAllReplaceBtn.textContent = "清空替换";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "image-quickedit-tool-btn";
    resetBtn.textContent = "恢复默认";

    toolbar.append(
      selectAllInsertBtn,
      unselectAllInsertBtn,
      selectAllReplaceBtn,
      unselectAllReplaceBtn,
      resetBtn,
    );
    wrapper.appendChild(toolbar);

    const grid = document.createElement("div");
    grid.className = "image-quickedit-batch-grid";
    wrapper.appendChild(grid);

    const insertCheckboxes: HTMLInputElement[] = [];
    const replaceCheckboxes: HTMLInputElement[] = [];

    for (const commandId of DOCUMENT_BATCH_COMMAND_ORDER) {
      const card = document.createElement("div");
      card.className = "image-quickedit-batch-card";

      const title = document.createElement("span");
      title.className = "image-quickedit-batch-title";
      const rawLabel = DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].insertBatchLabel;
      title.textContent = rawLabel.replace("（新增）", "");
      card.appendChild(title);

      const toggles = document.createElement("div");
      toggles.className = "image-quickedit-batch-toggles";

      // 新增勾选框
      const isInsertChecked = Boolean(this.settings.documentInsertMenuCommands[commandId]);
      const insertLabel = document.createElement("label");
      insertLabel.className = `image-quickedit-sub-checkbox is-insert${isInsertChecked ? " is-checked" : ""}`;

      const insertCheckbox = document.createElement("input");
      insertCheckbox.type = "checkbox";
      insertCheckbox.checked = isInsertChecked;
      insertCheckbox.dataset.commandId = commandId;
      insertCheckbox.dataset.mode = "insert";
      insertCheckboxes.push(insertCheckbox);

      const insertText = document.createElement("span");
      insertText.textContent = "新增";

      insertCheckbox.addEventListener("change", () => {
        insertLabel.classList.toggle("is-checked", insertCheckbox.checked);
        this.persistSettings({
          documentInsertMenuCommands: {
            ...this.settings.documentInsertMenuCommands,
            [commandId]: insertCheckbox.checked,
          },
        });
      });

      insertLabel.append(insertCheckbox, insertText);

      // 替换勾选框
      const isReplaceChecked = Boolean(this.settings.documentReplaceMenuCommands[commandId]);
      const replaceLabel = document.createElement("label");
      replaceLabel.className = `image-quickedit-sub-checkbox is-replace${isReplaceChecked ? " is-checked" : ""}`;

      const replaceCheckbox = document.createElement("input");
      replaceCheckbox.type = "checkbox";
      replaceCheckbox.checked = isReplaceChecked;
      replaceCheckbox.dataset.commandId = commandId;
      replaceCheckbox.dataset.mode = "replace";
      replaceCheckboxes.push(replaceCheckbox);

      const replaceText = document.createElement("span");
      replaceText.textContent = "替换";

      replaceCheckbox.addEventListener("change", () => {
        replaceLabel.classList.toggle("is-checked", replaceCheckbox.checked);
        this.persistSettings({
          documentReplaceMenuCommands: {
            ...this.settings.documentReplaceMenuCommands,
            [commandId]: replaceCheckbox.checked,
          },
        });
      });

      replaceLabel.append(replaceCheckbox, replaceText);

      toggles.append(insertLabel, replaceLabel);
      card.appendChild(toggles);
      grid.appendChild(card);
    }

    selectAllInsertBtn.addEventListener("click", () => {
      insertCheckboxes.forEach((cb) => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    unselectAllInsertBtn.addEventListener("click", () => {
      insertCheckboxes.forEach((cb) => {
        if (cb.checked) {
          cb.checked = false;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    selectAllReplaceBtn.addEventListener("click", () => {
      replaceCheckboxes.forEach((cb) => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    unselectAllReplaceBtn.addEventListener("click", () => {
      replaceCheckboxes.forEach((cb) => {
        if (cb.checked) {
          cb.checked = false;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    resetBtn.addEventListener("click", () => {
      insertCheckboxes.forEach((cb) => {
        const id = cb.dataset.commandId as DocumentBatchCommandId;
        const defaultVal = Boolean(DEFAULT_SETTINGS.documentInsertMenuCommands[id]);
        if (cb.checked !== defaultVal) {
          cb.checked = defaultVal;
          cb.dispatchEvent(new Event("change"));
        }
      });
      replaceCheckboxes.forEach((cb) => {
        const id = cb.dataset.commandId as DocumentBatchCommandId;
        const defaultVal = Boolean(DEFAULT_SETTINGS.documentReplaceMenuCommands[id]);
        if (cb.checked !== defaultVal) {
          cb.checked = defaultVal;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });

    return wrapper;
  }

  private createImageMenuToggleGroup(): HTMLElement {
    const wrapper = this.createCommandToggleGroup("imageMenuCommands");
    const grid = wrapper.querySelector(".image-quickedit-setting-grid") ?? wrapper;

    const addBorderCard = this.createCardCheckboxOption({
      checked: this.settings.showAddImageBorderMenuItem,
      label: "添加图像边框",
      onChange: (checked) => {
        this.persistSettings({
          showAddImageBorderMenuItem: checked,
        });
      },
    });

    const superBlockMergeCard = this.createCardCheckboxOption({
      checked: this.settings.showSuperBlockMergeMenuItem,
      label: "超级块图片合并",
      onChange: (checked) => {
        this.persistSettings({
          showSuperBlockMergeMenuItem: checked,
        });
      },
    });

    grid.append(addBorderCard, superBlockMergeCard);

    // 图片信息通知开关：合入图片右键菜单选项底部
    const notificationRow = document.createElement("div");
    notificationRow.className = "image-quickedit-notification-row";

    const notificationToggle = this.createImageInfoNotificationToggle();
    notificationRow.appendChild(notificationToggle);

    wrapper.appendChild(notificationRow);

    // 联动工具条恢复默认按钮
    const resetBtn = wrapper.querySelector(".image-quickedit-toolbar .image-quickedit-tool-btn:last-child");
    resetBtn?.addEventListener("click", () => {
      const addBorderCheckbox = addBorderCard.querySelector("input") as HTMLInputElement;
      if (addBorderCheckbox && addBorderCheckbox.checked !== DEFAULT_SETTINGS.showAddImageBorderMenuItem) {
        addBorderCheckbox.checked = DEFAULT_SETTINGS.showAddImageBorderMenuItem;
        addBorderCheckbox.dispatchEvent(new Event("change"));
      }

      const superBlockMergeCheckbox = superBlockMergeCard.querySelector("input") as HTMLInputElement;
      if (superBlockMergeCheckbox && superBlockMergeCheckbox.checked !== DEFAULT_SETTINGS.showSuperBlockMergeMenuItem) {
        superBlockMergeCheckbox.checked = DEFAULT_SETTINGS.showSuperBlockMergeMenuItem;
        superBlockMergeCheckbox.dispatchEvent(new Event("change"));
      }

      const notificationCheckbox = notificationRow.querySelector("input") as HTMLInputElement;
      if (notificationCheckbox && notificationCheckbox.checked !== DEFAULT_SETTINGS.showImageInfoNotification) {
        notificationCheckbox.checked = DEFAULT_SETTINGS.showImageInfoNotification;
        notificationCheckbox.dispatchEvent(new Event("change"));
      }
    });

    return wrapper;
  }

  private createLocalEditorPathInput(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-path";

    const inputWrapper = document.createElement("div");
    inputWrapper.className = "image-quickedit-input-wrapper";

    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.placeholder = "例如：C:\\Program Files\\paint.net\\PaintDotNet.exe";
    input.spellcheck = false;
    input.type = "text";
    input.value = this.settings.localEditorPath;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "image-quickedit-input-clear";
    clearBtn.textContent = "✕";
    clearBtn.title = "清空路径";
    clearBtn.style.display = input.value ? "flex" : "none";

    const savePath = () => {
      const nextPath = input.value.trim();
      if (nextPath === this.settings.localEditorPath) {
        return;
      }

      this.persistSettings({
        localEditorPath: nextPath,
      });
    };

    input.addEventListener("input", () => {
      clearBtn.style.display = input.value ? "flex" : "none";
    });
    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearBtn.style.display = "none";
      savePath();
      input.focus();
    });

    input.addEventListener("change", savePath);
    input.addEventListener("blur", savePath);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        savePath();
      }
    });

    inputWrapper.append(input, clearBtn);

    const hint = document.createElement("div");
    hint.className = "image-quickedit-setting-hint";
    hint.textContent = "可执行文件完整路径，不含外层引号。配置后可在图片右键菜单直接调用此软件编辑。";

    wrapper.append(inputWrapper, hint);
    return wrapper;
  }

  private createImageInfoNotificationToggle(): HTMLElement {
    const wrapper = document.createElement("label");
    wrapper.className = "image-quickedit-switch-container image-quickedit-setting-option";

    const checkbox = document.createElement("input");
    checkbox.className = "b3-switch fn__flex-center";
    checkbox.type = "checkbox";
    checkbox.checked = this.settings.showImageInfoNotification;

    const statusText = document.createElement("span");
    statusText.className = "image-quickedit-switch-status";
    statusText.textContent = "右键显示图片信息通知";

    checkbox.addEventListener("change", () => {
      this.persistSettings({
        showImageInfoNotification: checkbox.checked,
      });
    });

    wrapper.append(checkbox, statusText);
    return wrapper;
  }

  private createSuperBlockMergeOptionsGroup(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "image-quickedit-param-panel";

    // 第一行：间距与边框宽度并排
    const row1 = document.createElement("div");
    row1.className = "image-quickedit-param-row";

    const gapCol = this.createSettingParamNumberCol({
      affix: "px",
      initialValue: this.settings.superBlockMergeOptions.gapPx,
      label: "图片间距",
      onChange: (value) => {
        this.persistSuperBlockMergeOptions({ gapPx: value });
      },
    });

    const borderWidthCol = this.createSettingParamNumberCol({
      affix: "px",
      initialValue: this.settings.superBlockMergeOptions.borderWidthPx,
      label: "图片边框宽度",
      onChange: (value) => {
        this.persistSuperBlockMergeOptions({ borderWidthPx: value });
      },
    });

    row1.append(gapCol, borderWidthCol);

    // 第二行：边框颜色与色块预设
    const row2 = this.createSettingColorPaletteRow({
      initialValue: this.settings.superBlockMergeOptions.borderColor,
      label: "边框颜色",
      onChange: (value) => {
        this.persistSuperBlockMergeOptions({ borderColor: value });
      },
    });

    // 第三行：裁剪一致高度卡片式开关
    const row3 = document.createElement("label");
    row3.className = "image-quickedit-crop-option image-quickedit-setting-option";

    const cropDesc = document.createElement("span");
    cropDesc.className = "image-quickedit-crop-desc";
    cropDesc.textContent = "裁剪一致高度（以合并块中最小高度为准）";

    const cropSwitch = document.createElement("input");
    cropSwitch.className = "b3-switch fn__flex-center";
    cropSwitch.type = "checkbox";
    cropSwitch.checked = this.settings.superBlockMergeOptions.cropToSameHeight;
    cropSwitch.addEventListener("change", () => {
      this.persistSuperBlockMergeOptions({
        cropToSameHeight: cropSwitch.checked,
      });
    });

    row3.append(cropDesc, cropSwitch);

    panel.append(row1, row2, row3);
    return panel;
  }

  private createSettingParamNumberCol(options: {
    initialValue: number;
    label: string;
    affix: string;
    onChange: (value: number) => void;
  }): HTMLElement {
    const col = document.createElement("div");
    col.className = "image-quickedit-param-col";

    const label = document.createElement("span");
    label.className = "image-quickedit-param-label";
    label.textContent = `${options.label}（${options.affix}）`;

    const affixWrapper = document.createElement("div");
    affixWrapper.className = "image-quickedit-input-affix";

    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(options.initialValue);

    const affix = document.createElement("span");
    affix.className = "image-quickedit-affix-text";
    affix.textContent = options.affix;

    const save = () => {
      input.value = String(this.normalizeNonNegativeIntegerInput(input.value));
      options.onChange(Number.parseInt(input.value, 10));
    };

    input.addEventListener("change", save);
    input.addEventListener("blur", save);

    affixWrapper.append(input, affix);
    col.append(label, affixWrapper);
    return col;
  }

  private createSettingColorPaletteRow(options: {
    initialValue: string;
    label: string;
    onChange: (value: string) => void;
  }): HTMLElement {
    const row = document.createElement("div");
    row.className = "image-quickedit-color-row";

    const pickerBox = document.createElement("div");
    pickerBox.className = "image-quickedit-color-picker-box";

    const label = document.createElement("span");
    label.className = "image-quickedit-param-label";
    label.textContent = options.label;

    const initialColor = this.normalizeColorInputValue(options.initialValue);

    // 颜色预览圆环（点击直接唤起系统调色板）
    const preview = document.createElement("div");
    preview.className = "image-quickedit-color-preview";
    preview.title = "点击打开调色板选取颜色";
    preview.style.backgroundColor = initialColor;

    // 原生系统调色盘 input[type="color"]
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "image-quickedit-hidden-color-input";
    colorInput.value = initialColor;

    // HEX 十六进制代码输入框（允许直接输入自定义颜色）
    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.className = "b3-text-field image-quickedit-color-hex-input";
    hexInput.maxLength = 7;
    hexInput.spellcheck = false;
    hexInput.value = initialColor.toUpperCase();
    hexInput.title = "可直接输入十六进制颜色代码（如 #D5D5D8）";

    const updateColor = (newVal: string) => {
      const normalized = this.normalizeColorInputValue(newVal);
      colorInput.value = normalized;
      preview.style.backgroundColor = normalized;
      hexInput.value = normalized.toUpperCase();
      options.onChange(normalized);
    };

    const triggerColorPicker = () => {
      try {
        if (typeof (colorInput as any).showPicker === "function") {
          (colorInput as any).showPicker();
          return;
        }
      }
      catch {
        // ignore
      }
      colorInput.click();
    };

    colorInput.addEventListener("click", (e) => e.stopPropagation());
    preview.addEventListener("click", triggerColorPicker);

    colorInput.addEventListener("input", () => {
      preview.style.backgroundColor = colorInput.value;
      hexInput.value = colorInput.value.toUpperCase();
    });
    colorInput.addEventListener("change", () => updateColor(colorInput.value));

    const handleHexInputChange = () => updateColor(hexInput.value);
    hexInput.addEventListener("change", handleHexInputChange);
    hexInput.addEventListener("blur", handleHexInputChange);
    hexInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleHexInputChange();
        hexInput.blur();
      }
    });

    preview.appendChild(colorInput);
    pickerBox.append(label, preview, hexInput);

    // 右侧：预置常用色块
    const rightBox = document.createElement("div");
    rightBox.className = "image-quickedit-color-right-box";

    const swatches = document.createElement("div");
    swatches.className = "image-quickedit-color-swatches";

    const presetColors = ["#000000", "#4285f4", "#9e9e9e", "#e0e0e0", "#ffffff"];
    for (const color of presetColors) {
      const swatch = document.createElement("div");
      swatch.className = "image-quickedit-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.addEventListener("click", () => updateColor(color));
      swatches.appendChild(swatch);
    }

    rightBox.append(swatches);
    row.append(pickerBox, rightBox);
    return row;
  }

  private createCompressionStrategySelect(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "image-quickedit-setting-group";

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "image-quickedit-strategy-cards";

    const select = document.createElement("select");
    select.className = "b3-select";
    select.style.display = "none";

    const strategies: Array<{
      desc: string;
      name: string;
      tag?: string;
      value: CompressionStrategy;
    }> = [
      {
        desc: "遍历尝试分辨率与色彩所有组合，自动寻找体积最小且画质最优的平衡点，但耗时较长。",
        name: "综合比较",
        tag: "推荐",
        value: "comprehensive",
      },
      {
        desc: "保持原有色彩层次与深度，优先按比例适度缩小图像尺寸（适合大图/高分辨率截图）。",
        name: "优先压缩分辨率",
        value: "resolution-first",
      },
      {
        desc: "保持完整分辨率细节，优先通过调色板量化减少色彩深度（适合图表、文字、代码截图）。",
        name: "优先压缩颜色",
        value: "color-first",
      },
    ];

    const cardElements: HTMLElement[] = [];

    const updateActiveState = (selectedVal: CompressionStrategy) => {
      strategies.forEach((strat, idx) => {
        const card = cardElements[idx];
        if (card) {
          card.classList.toggle("is-active", strat.value === selectedVal);
        }
      });
      select.value = selectedVal;
    };

    for (const strat of strategies) {
      const optionElement = document.createElement("option");
      optionElement.value = strat.value;
      optionElement.textContent = strat.name;
      optionElement.selected = this.settings.compressionStrategy === strat.value;
      select.appendChild(optionElement);

      const card = document.createElement("div");
      card.className = `image-quickedit-strategy-card${this.settings.compressionStrategy === strat.value ? " is-active" : ""}`;

      const radio = document.createElement("div");
      radio.className = "image-quickedit-strategy-radio";

      const body = document.createElement("div");
      body.className = "image-quickedit-strategy-body";

      const header = document.createElement("div");
      header.className = "image-quickedit-strategy-header";

      const name = document.createElement("span");
      name.className = "image-quickedit-strategy-name";
      name.textContent = strat.name;
      header.appendChild(name);

      if (strat.tag) {
        const tag = document.createElement("span");
        tag.className = "image-quickedit-strategy-tag";
        tag.textContent = strat.tag;
        header.appendChild(tag);
      }

      const desc = document.createElement("div");
      desc.className = "image-quickedit-strategy-desc";
      desc.textContent = strat.desc;

      body.append(header, desc);
      card.append(radio, body);

      card.addEventListener("click", () => {
        if (this.settings.compressionStrategy === strat.value) {
          return;
        }
        updateActiveState(strat.value);
        this.persistSettings({
          compressionStrategy: strat.value,
        });
      });

      cardElements.push(card);
      cardsContainer.appendChild(card);
    }

    select.addEventListener("change", () => {
      const nextVal = select.value as CompressionStrategy;
      updateActiveState(nextVal);
      this.persistSettings({
        compressionStrategy: nextVal,
      });
    });

    wrapper.append(cardsContainer, select);
    return wrapper;
  }

  private createSettingCheckboxOption(options: {
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
  }): HTMLElement {
    const wrapper = document.createElement("label");
    wrapper.className = "image-quickedit-setting-option";

    const checkbox = document.createElement("input");
    checkbox.checked = options.checked;
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      options.onChange(checkbox.checked);
    });

    const text = document.createElement("span");
    text.textContent = options.label;

    wrapper.append(checkbox, text);
    return wrapper;
  }

  private createSettingNumberInputOption(options: {
    initialValue: number;
    label: string;
    onChange: (value: number) => void;
  }): HTMLElement {
    const wrapper = document.createElement("label");
    wrapper.className = "image-quickedit-setting-field";

    const text = document.createElement("span");
    text.textContent = options.label;

    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.min = "0";
    input.step = "1";
    input.type = "number";
    input.value = String(options.initialValue);

    const save = () => {
      input.value = String(this.normalizeNonNegativeIntegerInput(input.value));
      options.onChange(Number.parseInt(input.value, 10));
    };

    input.addEventListener("change", save);
    input.addEventListener("blur", save);

    wrapper.append(text, input);
    return wrapper;
  }

  private createSettingColorInputOption(options: {
    initialValue: string;
    label: string;
    onChange: (value: string) => void;
  }): HTMLElement {
    const wrapper = document.createElement("label");
    wrapper.className = "image-quickedit-setting-field";

    const text = document.createElement("span");
    text.textContent = options.label;

    const input = document.createElement("input");
    input.className = "b3-text-field";
    input.type = "color";
    input.value = this.normalizeColorInputValue(options.initialValue);
    input.addEventListener("change", () => {
      const normalizedValue = this.normalizeColorInputValue(input.value);
      input.value = normalizedValue;
      options.onChange(normalizedValue);
    });

    wrapper.append(text, input);
    return wrapper;
  }

  private decorateImageMenu(detail: IEventBusMap["open-menu-image"]): void {
    const target = resolveImageTarget(detail.element);
    this.decorateSingleImageMenu(detail.menu, target);
  }

  private decorateBlockIconMenu(detail: IEventBusMap["click-blockicon"]): void {
    const superBlockElement = detail.blockElements.find(
      blockElement => blockElement.dataset.type === "NodeSuperBlock",
    );
    const target = resolveImageTargetFromBlockElements(detail.blockElements);
    const shouldShowSuperBlockMerge = Boolean(
      superBlockElement
      && this.settings.showSuperBlockMergeMenuItem
      && collectSuperBlockImageTargets(superBlockElement).length >= 2,
    );

    this.decorateSingleImageMenu(detail.menu, target, {
      onMergeSuperBlockImages: shouldShowSuperBlockMerge
        ? () => {
            void this.runExclusive(async () => this.mergeImagesForSuperBlock(superBlockElement as HTMLElement));
          }
        : undefined,
    });
  }

  private decorateSingleImageMenu(
    menu: IEventBusMap["open-menu-image"]["menu"] | IEventBusMap["click-blockicon"]["menu"],
    target: ImageTarget | null,
    options?: {
      onMergeSuperBlockImages?: () => void;
    },
  ): void {
    if (!target) {
      return;
    }

    const enabledCommands = getEnabledCommandIds(this.settings.imageMenuCommands);
    const cacheKey = `${target.blockId}|${target.src}`;
    const submenu = buildImageQuickEditSubmenuItems({
      commandIds: enabledCommands,
      imageInfoLabel: this.imageInfoCache.get(cacheKey) || "读取图片信息中...",
      onAddImageBorder: this.settings.showAddImageBorderMenuItem
        ? () => {
            void this.runExclusive(async () => this.addBorderToImageTarget(target));
          }
        : undefined,
      onCommandClick: (commandId) => {
        void this.runExclusive(async () => this.processSingleTarget(target, commandId));
      },
      onMergeSuperBlockImages: options?.onMergeSuperBlockImages,
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
      notifyImageInfo({
        enabled: this.settings.showImageInfoNotification,
        imageInfo,
        messageId: IMAGE_INFO_MESSAGE_ID,
      });
    }
    catch (error) {
      console.error("[siyuan-image-quickedit] Failed to inspect image info", error);
    }
  }

  private async hydrateDocumentImageSummary(
    summaryElement: HTMLElement,
    docId: string | undefined,
    domTargets: ImageTarget[],
    targetsPromise?: Promise<ImageTarget[]>,
  ): Promise<void> {
    // 1. 并行发起两路独立异步统计：获取图片目标与计算内嵌资源总大小
    const fetchTargets = targetsPromise ?? (docId ? collectImageTargetsByDocId(docId) : Promise.resolve(domTargets));
    const fetchAssetBytes = docId ? loadDocumentEmbeddedAssetBytes(docId) : Promise.resolve(0);

    const [targetsResult, assetBytesResult] = await Promise.allSettled([
      fetchTargets,
      fetchAssetBytes,
    ]);

    // 2. 健壮容错与回退：只要全量扫描正常返回（即便为 0 张），均作为可信数据采用；仅在查询异常时降级回退
    const targets = targetsResult.status === "fulfilled"
      ? targetsResult.value
      : domTargets;

    if (targetsResult.status === "rejected") {
      console.error("[image-quickedit] Failed to collect image targets by docId", targetsResult.reason);
    }

    const documentEmbeddedAssetBytes = assetBytesResult.status === "fulfilled"
      ? assetBytesResult.value
      : 0;

    if (assetBytesResult.status === "rejected") {
      console.error("[image-quickedit] Failed to load document asset stats", assetBytesResult.reason);
    }

    // 3. 构建多行文本并安全回写 DOM
    const label = buildDocumentImageSummaryLabel({
      documentEmbeddedAssetBytes,
      imageCount: targets.length,
    });
    const labelElement = summaryElement.querySelector(".b3-menu__label");
    if (labelElement) {
      syncReadonlyMenuItemLabelElement(labelElement, label);
    }
  }

  private decorateDocumentMenu(
    protyle: IProtyle,
    menu: IEventBusMap["click-editortitleicon"]["menu"],
    data?: IGetDocInfo,
  ): void {
    const enabledInsertCommands = getEnabledDocumentBatchCommandIds(this.settings.documentInsertMenuCommands);
    const enabledReplaceCommands = getEnabledDocumentBatchCommandIds(this.settings.documentReplaceMenuCommands);
    if (!enabledInsertCommands.length && !enabledReplaceCommands.length) {
      return;
    }

    const docId = data?.id || protyle?.block?.rootID || protyle?.options?.rootId || protyle?.block?.id;
    const domTargets = collectImageTargets(protyle);

    if (!docId && !domTargets.length) {
      return;
    }

    // 缓存或共享本次菜单打开周期的 targets Promise，供水合与后续点击复用，避免重复执行 SQL 及正文扫描
    let cachedTargetsPromise: Promise<ImageTarget[]> | null = null;
    let resolvedTargets: ImageTarget[] | null = null;

    const getTargets = (): Promise<ImageTarget[]> => {
      if (resolvedTargets) {
        return Promise.resolve(resolvedTargets);
      }
      if (!cachedTargetsPromise) {
        cachedTargetsPromise = (docId
          ? collectImageTargetsByDocId(docId)
              .then((targets) => {
                resolvedTargets = targets;
                return targets;
              })
              .catch((error) => {
                console.error("[image-quickedit] Failed to collect image targets by docId", error);
                resolvedTargets = domTargets;
                return domTargets;
              })
          : Promise.resolve(domTargets)
        );
      }
      return cachedTargetsPromise;
    };

    const summaryLabel = buildDocumentImageSummaryLabel({
      imageCount: domTargets.length,
    });

    menu.addItem({
      icon: "iconImage",
      label: "图片快剪",
      submenu: buildDocumentBatchSubmenuItems({
        imageSummaryLabel: summaryLabel,
        onBindImageSummaryLabel: (element) => {
          return this.hydrateDocumentImageSummary(element, docId, domTargets, getTargets());
        },
        insertCommandIds: enabledInsertCommands,
        replaceCommandIds: enabledReplaceCommands,
        onCommandClick: (commandId, mode) => {
          return (async () => {
            let targets: ImageTarget[] = [];
            try {
              targets = await getTargets();
            }
            catch (error) {
              console.error("[image-quickedit] Failed to collect image targets by docId", error);
            }

            if (!targets.length && protyle) {
              targets = collectImageTargets(protyle);
            }

            if (!targets.length) {
              showMessage("本文档中没有可处理的图片。", 5000, "info");
              return;
            }

            const commandLabel = mode === "replace"
              ? DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].replaceBatchLabel
              : DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].insertBatchLabel;
            const detail = mode === "replace"
              ? "原图将被直接替换，正文文本保持不变。"
              : "原图不会删除，处理结果会插入到对应图片块后方。";

            confirm(
              "图片快剪",
              `将对本文档中的 ${targets.length} 张图片执行“${commandLabel}”。${detail}`,
              () => {
                void this.runExclusive(async () => this.processDocumentTargets(targets, commandId, mode));
              },
            );
          })();
        },
      }),
    });
  }

  private runExclusive(task: () => Promise<void>): boolean {
    if (this.isProcessing) {
      showMessage("图片快剪正在处理，请等待当前任务完成。", 4000, "error");
      return false;
    }

    this.isProcessing = true;
    void (async () => {
      try {
        await task();
      }
      catch (error) {
        console.error("[siyuan-image-quickedit] Unexpected task failure", error);
      }
      finally {
        this.isProcessing = false;
      }
    })();
    return true;
  }

  private reportProgress(message: string): void {
    showMessage(message, 3000, "info", PROGRESS_MESSAGE_ID);
  }

  private persistSuperBlockMergeOptions(nextOptions: Partial<SuperBlockMergeOptions>): void {
    this.persistSettings({
      superBlockMergeOptions: {
        ...this.settings.superBlockMergeOptions,
        ...nextOptions,
      },
    });
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

  private async addBorderToImageTarget(target: ImageTarget): Promise<void> {
    if (this.settings.superBlockMergeOptions.borderWidthPx <= 0) {
      showMessage("请先在“超级块图片合并”设置中填写大于 0 的图片边框宽度。", 6000, "error");
      return;
    }

    try {
      this.reportProgress("添加图像边框：正在读取图片");
      const prepared = await prepareBorderedImage(target, this.settings.superBlockMergeOptions);

      this.reportProgress("添加图像边框：正在上传处理结果");
      const assetPath = await uploadAsset(new File([prepared.output.blob], prepared.fileName, {
        type: "image/webp",
      }));

      this.reportProgress("添加图像边框：正在插入结果块");
      const markdown = buildProcessedResultMarkdown(prepared, assetPath);
      await insertMarkdownAfterBlock(target.blockId, markdown);

      showMessage("添加图像边框完成，结果已插入到当前图片下方。", 6000, "info");
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
      const imageSource = resolveLocalEditorImageSource(target.src, {
        dataDir,
        origin: location.origin,
      });
      const editSession = await prepareLocalEditorEditSession(imageSource);

      try {
        this.reportProgress("本地图片编辑：正在打开编辑器");
        await openLocalEditorAndWait({
          editorPath,
          imagePath: editSession.imagePath,
        });
        await this.delay(LOCAL_EDITOR_REFRESH_DELAY_MS);

        await commitLocalEditorEditSession(editSession);
      }
      finally {
        await cleanupLocalEditorEditSession(editSession);
      }

      this.reportProgress("本地图片编辑：正在刷新图片");
      const refreshedCount = await this.refreshEditedImages(imageSource.filePath, dataDir);
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
    commandId: DocumentBatchCommandId,
    mode: DocumentBatchMode,
  ): Promise<{
    processedCount: number
    successCount: number
    failureCount: number
    savedBytes: number
  }> {
    const indexedTargets = targets.map((target, index) => ({
      ...target,
      executionId: `${target.blockId}-${index}`,
    }));
    const targetMap = new Map(indexedTargets.map(target => [target.executionId, target]));
    const batchCommandLabel = mode === "replace"
      ? DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].replaceBatchLabel
      : DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].insertBatchLabel;

    const result = await runTargetsSequentially({
      commandId,
      onProgress: message => this.reportProgress(`${batchCommandLabel}：${message}`),
      runTarget: async ({ id }) => {
        const target = targetMap.get(id);
        if (!target) {
          throw new Error(`找不到图片任务：${id}`);
        }

        if (commandId === "add-border") {
          return this.processBorderTarget(target, mode);
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

    return {
      processedCount: targets.length,
      successCount: result.successes.length,
      failureCount: result.failures.length,
      savedBytes,
    };
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
      this.settings.compressionStrategy,
      message => this.reportProgress(`${COMMAND_DEFINITIONS[commandId].label}：${message}`),
    );

    return this.finalizeGeneratedTarget(target, prepared, mode, COMMAND_DEFINITIONS[commandId].label);
  }

  private async processBorderTarget(
    target: ImageTarget,
    mode: DocumentBatchMode,
  ): Promise<{
    originalBytes: number;
    outputBytes: number;
    summary: string;
  }> {
    this.reportProgress("添加图像边框：正在读取图片");
    const prepared = await prepareBorderedImage(target, this.settings.superBlockMergeOptions);
    return this.finalizeGeneratedTarget(target, prepared, mode, prepared.commandLabel);
  }

  private async finalizeGeneratedTarget(
    target: ImageTarget,
    prepared: {
      commandLabel: string;
      fileName: string;
      original: {
        bytes: number;
      };
      output: {
        blob: Blob;
        bytes: number;
      };
    },
    mode: DocumentBatchMode,
    progressLabel: string,
  ): Promise<{
    originalBytes: number;
    outputBytes: number;
    summary: string;
  }> {
    this.reportProgress(`${progressLabel}：正在上传处理结果`);
    const file = new File([prepared.output.blob], prepared.fileName, {
      type: "image/webp",
    });
    const assetPath = await uploadAsset(file);

    if (mode === "replace") {
      this.reportProgress(`${progressLabel}：正在替换原图`);
      const blockMarkdown = await getBlockMarkdown(target.blockId);
      const updatedMarkdown = buildReplacedBlockMarkdown(blockMarkdown, target, assetPath);
      await updateMarkdownBlock(target.blockId, updatedMarkdown);

      return {
        originalBytes: prepared.original.bytes,
        outputBytes: prepared.output.bytes,
        summary: `${prepared.commandLabel}已直接替换原图`,
      };
    }

    this.reportProgress(`${progressLabel}：正在插入结果块`);
    const markdown = buildProcessedResultMarkdown(prepared, assetPath);
    try {
      await insertMarkdownAfterBlock(target.blockId, markdown);
    }
    catch (insertError) {
      const block = await getBlockById(target.blockId);
      if (block?.root_id && block.root_id !== target.blockId) {
        await insertMarkdownAfterBlock(block.root_id, markdown);
      }
      else {
        throw insertError;
      }
    }

    return {
      originalBytes: prepared.original.bytes,
      outputBytes: prepared.output.bytes,
      summary: markdown.split("\n", 1)[0],
    };
  }

  private async mergeImagesForSuperBlock(superBlockElement: HTMLElement): Promise<void> {
    const superBlockId = superBlockElement.dataset.nodeId;
    if (!superBlockId) {
      showMessage("找不到超级块 ID。", 6000, "error");
      return;
    }

    try {
      const targets = collectSuperBlockImageTargets(superBlockElement);
      if (targets.length < 2) {
        throw new Error("超级块中至少需要两张图片才能合并。");
      }

      this.reportProgress("图片合并：正在生成拼接结果");
      const merged = await mergeSuperBlockImages(targets, this.settings.superBlockMergeOptions);

      this.reportProgress("图片合并：正在上传处理结果");
      const assetPath = await uploadAsset(new File([merged.output.blob], merged.fileName, {
        type: "image/webp",
      }));

      this.reportProgress("图片合并：正在插入结果块");
      await insertMarkdownAfterBlock(superBlockId, `![图片合并](${assetPath})`);

      showMessage("图片合并完成，结果已插入到超级块下方。", 6000, "info");
    }
    catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), 6000, "error");
    }
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

  private normalizeNonNegativeIntegerInput(value: string): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private normalizeColorInputValue(value: string): string {
    const trimmed = (value ?? "").trim();
    if (/^#[0-9a-f]{3}$/iu.test(trimmed)) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    if (/^#[0-9a-f]{6}$/iu.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return DEFAULT_SUPER_BLOCK_MERGE_OPTIONS.borderColor;
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
    if (currentPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentPreviewUrl);
    }

    this.localEditorPreviewUrls.set(imageElement, previewUrl);
    imageElement.removeAttribute("src");
    imageElement.src = previewUrl;
  }

  private disposeLocalEditorPreviewUrls(): void {
    for (const previewUrl of this.localEditorPreviewUrls.values()) {
      URL.revokeObjectURL(previewUrl);
    }

    this.localEditorPreviewUrls.clear();
  }

  private async invokePowerButtonsCommand(
    commandId: string,
    context: PowerButtonsInvokeContext,
  ): Promise<PowerButtonsInvokeResult> {
    const command = parsePublicPowerButtonsCommandId(commandId);
    if (!command) {
      return {
        errorCode: "command-not-found",
        message: `未找到公开命令：${commandId}`,
        ok: false,
      };
    }

    if (command.kind === "current-image-local-editor") {
      const target = this.resolvePowerButtonsCurrentImageTarget();
      if (!target) {
        return {
          errorCode: "context-unavailable",
          message: "请先选中图片，再使用本地编辑器编辑。",
          ok: false,
        };
      }

      return this.startPowerButtonsTask(async () => this.editImageWithLocalEditor(target));
    }

    if (command.kind === "current-image-command") {
      const target = this.resolvePowerButtonsCurrentImageTarget();
      if (!target) {
        return {
          errorCode: "context-unavailable",
          message: "请先选中图片，再执行该操作。",
          ok: false,
        };
      }

      return this.startPowerButtonsTask(async () => this.processSingleTarget(target, command.commandId));
    }

    if (command.kind === "current-super-block-merge") {
      const superBlockElement = this.resolvePowerButtonsCurrentSuperBlockElement();
      if (!superBlockElement || collectSuperBlockImageTargets(superBlockElement).length < 2) {
        return {
          errorCode: "context-unavailable",
          message: "请先选中包含至少两张图片的超级块，再执行图片合并。",
          ok: false,
        };
      }

      return this.startPowerButtonsTask(async () => this.mergeImagesForSuperBlock(superBlockElement));
    }

    console.log(`[image-quickedit] invokePowerButtonsCommand: commandId=${commandId}, docId=${context.docId || "(none)"}, trigger=${context.trigger}, scope=${context.scope || "(none)"}`);

    const protyle = this.resolvePowerButtonsProtyle();
    const effectiveDocId = context.docId
      || protyle?.block?.rootID
      || protyle?.options?.rootId
      || protyle?.block?.id;

    let targets: ImageTarget[] = [];
    if (effectiveDocId) {
      try {
        targets = await collectImageTargetsByDocId(effectiveDocId);
      }
      catch (error) {
        console.error("[image-quickedit] Failed to collect targets by docId in power buttons", error);
      }
    }
    if (!targets.length && protyle) {
      targets = collectImageTargets(protyle);
    }
    console.log(`[image-quickedit] collected ${targets.length} image targets for docId=${effectiveDocId || "(current)"}`);

    if (!targets.length) {
      console.warn("[image-quickedit] no targets found, returning context-unavailable");
      return {
        errorCode: "context-unavailable",
        message: context.docId
          ? "目标文档中没有可处理的图片。"
          : "请先打开包含图片的文档，再执行该操作。",
        ok: false,
      };
    }

    const commandLabel = command.mode === "replace"
      ? COMMAND_DEFINITIONS[command.commandId].replaceBatchLabel
      : COMMAND_DEFINITIONS[command.commandId].insertBatchLabel;
    const detail = command.mode === "replace"
      ? "原图将直接替换，正文文本保持不变。"
      : "原图不会删除，处理结果会插入到对应图片块后方。";

    if (context.trigger === "workflow-step") {
      console.log("[image-quickedit] workflow-step trigger, skipping confirmation");
    } else {
      const confirmed = await this.askConfirm(
        "图片快剪",
        `将对本文档中的 ${targets.length} 张图片执行"${commandLabel}"。${detail}`,
      );
      if (!confirmed) {
        console.log("[image-quickedit] user cancelled confirmation");
        return {
          alreadyNotified: true,
          errorCode: "execution-failed",
          ok: false,
        };
      }
    }

    console.log(`[image-quickedit] starting task for ${targets.length} targets, isProcessing=${this.isProcessing}, trigger=${context.trigger}`);

    if (context.trigger === "workflow-step") {
      if (this.isProcessing) {
        console.warn("[image-quickedit] workflow-step: mutex locked, returning provider-unavailable");
        return {
          alreadyNotified: true,
          errorCode: "provider-unavailable",
          message: "图片快剪正在处理，请等待当前任务完成。",
          ok: false,
        };
      }
      this.isProcessing = true;
      try {
        const batchResult = await this.processDocumentTargets(targets, command.commandId, command.mode);
        console.log("[image-quickedit] workflow-step: task completed successfully");
        return {
          ok: true,
          alreadyNotified: true,
          resultSummary: {
            failureCount: batchResult.failureCount,
            label: batchResult.failureCount > 0
              ? `已处理 ${batchResult.processedCount} 张图片，成功 ${batchResult.successCount}，失败 ${batchResult.failureCount}；节省 ${formatBytes(batchResult.savedBytes)}`
              : `已处理 ${batchResult.processedCount} 张图片，节省 ${formatBytes(batchResult.savedBytes)}`,
            processedCount: batchResult.processedCount,
            savedBytes: batchResult.savedBytes,
            successCount: batchResult.successCount,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[image-quickedit] workflow-step: task failed", message);
        return { ok: false, errorCode: "execution-failed", message };
      } finally {
        this.isProcessing = false;
      }
    }

    return this.startPowerButtonsTask(async () => this.processDocumentTargets(targets, command.commandId, command.mode));
  }

  private startPowerButtonsTask(task: () => Promise<void>): PowerButtonsInvokeResult {
    const started = this.runExclusive(task);
    if (!started) {
      console.warn("[image-quickedit] startPowerButtonsTask: mutex locked, returning provider-unavailable");
      return {
        alreadyNotified: true,
        errorCode: "provider-unavailable",
        message: "图片快剪正在处理，请等待当前任务完成。",
        ok: false,
      };
    }

    console.log("[image-quickedit] startPowerButtonsTask: task launched successfully");
    return {
      alreadyNotified: true,
      ok: true,
    };
  }

  private async askConfirm(title: string, text: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirm(
        title,
        text,
        () => resolve(true),
        () => resolve(false),
      );
    });
  }

  private resolvePowerButtonsCurrentImageTarget(): ImageTarget | null {
    const selectedBlockTarget = resolveImageTargetFromBlockElements(this.getSelectedBlockElements());
    if (selectedBlockTarget) {
      return selectedBlockTarget;
    }

    for (const candidate of this.getPowerButtonsContextElements()) {
      const target = resolveImageTarget(candidate);
      if (target) {
        return target;
      }
    }

    return null;
  }

  private resolvePowerButtonsCurrentSuperBlockElement(): HTMLElement | null {
    for (const blockElement of this.getSelectedBlockElements()) {
      if (blockElement.dataset.type === "NodeSuperBlock") {
        return blockElement;
      }

      const superBlockElement = blockElement.closest<HTMLElement>("[data-type='NodeSuperBlock']");
      if (superBlockElement) {
        return superBlockElement;
      }
    }

    for (const candidate of this.getPowerButtonsContextElements()) {
      const superBlockElement = candidate.closest<HTMLElement>("[data-type='NodeSuperBlock']");
      if (superBlockElement) {
        return superBlockElement;
      }
    }

    return null;
  }

  private resolvePowerButtonsProtyle(): IProtyle | null {
    const activeEditor = getActiveEditor();
    const protyle = activeEditor?.protyle as IProtyle | undefined;
    if (!protyle) {
      return null;
    }

    if (protyle.contentElement || protyle.element) {
      return protyle;
    }

    return null;
  }

  private getSelectedBlockElements(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(
      "[data-node-id].protyle-wysiwyg--select, [data-node-id].protyle-select",
    ));
  }

  private getPowerButtonsContextElements(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      elements.push(activeElement);
    }

    const selection = window.getSelection?.();
    const anchorNode = selection?.anchorNode;
    if (anchorNode instanceof HTMLElement) {
      elements.push(anchorNode);
    }
    else if (anchorNode?.parentElement instanceof HTMLElement) {
      elements.push(anchorNode.parentElement);
    }

    return elements;
  }
}
