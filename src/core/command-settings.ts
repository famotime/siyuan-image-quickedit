export const COMMAND_ORDER = [
  "convert-webp",
  "compress-75",
  "compress-50",
  "compress-30",
  "compress-10",
] as const;

export type CommandId = (typeof COMMAND_ORDER)[number];

export type CommandToggleMap = Record<CommandId, boolean>;

export const DOCUMENT_BATCH_COMMAND_ORDER = [
  ...COMMAND_ORDER,
  "add-border",
] as const;

export type DocumentBatchCommandId = (typeof DOCUMENT_BATCH_COMMAND_ORDER)[number];

export type DocumentBatchCommandToggleMap = Record<DocumentBatchCommandId, boolean>;

export const COMPRESSION_STRATEGY_OPTIONS = [
  "comprehensive",
  "resolution-first",
  "color-first",
] as const;

export type CompressionStrategy = (typeof COMPRESSION_STRATEGY_OPTIONS)[number];

export interface SuperBlockMergeOptions {
  gapPx: number;
  borderWidthPx: number;
  borderColor: string;
  cropToSameHeight: boolean;
}

/**
 * 文档批量处理图片跳过条件配置
 */
export interface DocumentBatchSkipOptions {
  /** 是否启用跳过过滤规则 */
  enabled: boolean;
  /** 文件大小阈值（单位：KB），小于此值跳过，0 表示不限制 */
  minSizeKb: number;
  /** 图片宽高阈值（单位：px），宽度或高度之一小于此值跳过，0 表示不限制 */
  minDimensionPx: number;
  /** 兼容可选拓展：最小宽度（px） */
  minWidthPx?: number;
  /** 兼容可选拓展：最小高度（px） */
  minHeightPx?: number;
}

export interface PluginSettings {
  imageMenuCommands: CommandToggleMap;
  documentInsertMenuCommands: DocumentBatchCommandToggleMap;
  documentReplaceMenuCommands: DocumentBatchCommandToggleMap;
  localEditorPath: string;
  showAddImageBorderMenuItem: boolean;
  showSuperBlockMergeMenuItem: boolean;
  showImageInfoNotification: boolean;
  compressionStrategy: CompressionStrategy;
  superBlockMergeOptions: SuperBlockMergeOptions;
  documentBatchSkipOptions: DocumentBatchSkipOptions;
}

export type CommandMenuSettingKey =
  | "imageMenuCommands"
  | "documentInsertMenuCommands"
  | "documentReplaceMenuCommands";

type LegacyPluginSettings = Partial<Omit<PluginSettings, "superBlockMergeOptions" | "documentBatchSkipOptions">> & {
  documentMenuCommands?: Partial<CommandToggleMap>;
  superBlockMergeOptions?: Partial<SuperBlockMergeOptions>;
  documentBatchSkipOptions?: Partial<DocumentBatchSkipOptions>;
};

export const DEFAULT_COMMAND_TOGGLES: CommandToggleMap = {
  "convert-webp": true,
  "compress-75": false,
  "compress-50": true,
  "compress-30": false,
  "compress-10": true,
};

export const DEFAULT_DOCUMENT_BATCH_COMMAND_TOGGLES: DocumentBatchCommandToggleMap = {
  ...DEFAULT_COMMAND_TOGGLES,
  "add-border": false,
};

export const DEFAULT_SUPER_BLOCK_MERGE_OPTIONS: SuperBlockMergeOptions = {
  gapPx: 0,
  borderWidthPx: 2,
  borderColor: "#808080",
  cropToSameHeight: false,
};

export const DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS: DocumentBatchSkipOptions = {
  enabled: true,
  minSizeKb: 300,
  minDimensionPx: 100,
};

export const DEFAULT_SETTINGS: PluginSettings = {
  imageMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  documentInsertMenuCommands: { ...DEFAULT_DOCUMENT_BATCH_COMMAND_TOGGLES },
  documentReplaceMenuCommands: { ...DEFAULT_DOCUMENT_BATCH_COMMAND_TOGGLES },
  localEditorPath: "",
  showAddImageBorderMenuItem: false,
  showSuperBlockMergeMenuItem: true,
  showImageInfoNotification: false,
  compressionStrategy: "comprehensive",
  superBlockMergeOptions: { ...DEFAULT_SUPER_BLOCK_MERGE_OPTIONS },
  documentBatchSkipOptions: { ...DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS },
};

export function mergeSettings(settings?: LegacyPluginSettings | null): PluginSettings {
  const legacyDocumentMenuCommands = settings?.documentMenuCommands;
  const superBlockMergeOptions = settings?.superBlockMergeOptions;
  const documentBatchSkipOptions = settings?.documentBatchSkipOptions;

  return {
    imageMenuCommands: {
      ...DEFAULT_SETTINGS.imageMenuCommands,
      ...settings?.imageMenuCommands,
    },
    documentInsertMenuCommands: {
      ...DEFAULT_SETTINGS.documentInsertMenuCommands,
      ...legacyDocumentMenuCommands,
      ...settings?.documentInsertMenuCommands,
    },
    documentReplaceMenuCommands: {
      ...DEFAULT_SETTINGS.documentReplaceMenuCommands,
      ...legacyDocumentMenuCommands,
      ...settings?.documentReplaceMenuCommands,
    },
    localEditorPath: settings?.localEditorPath ?? DEFAULT_SETTINGS.localEditorPath,
    showAddImageBorderMenuItem:
      settings?.showAddImageBorderMenuItem ?? DEFAULT_SETTINGS.showAddImageBorderMenuItem,
    showSuperBlockMergeMenuItem:
      settings?.showSuperBlockMergeMenuItem ?? DEFAULT_SETTINGS.showSuperBlockMergeMenuItem,
    showImageInfoNotification: settings?.showImageInfoNotification ?? DEFAULT_SETTINGS.showImageInfoNotification,
    compressionStrategy: (COMPRESSION_STRATEGY_OPTIONS as readonly string[]).includes(settings?.compressionStrategy ?? "")
      ? settings!.compressionStrategy!
      : DEFAULT_SETTINGS.compressionStrategy,
    superBlockMergeOptions: {
      gapPx: normalizeNonNegativeInteger(superBlockMergeOptions?.gapPx, DEFAULT_SUPER_BLOCK_MERGE_OPTIONS.gapPx),
      borderWidthPx: normalizeNonNegativeInteger(
        superBlockMergeOptions?.borderWidthPx,
        DEFAULT_SUPER_BLOCK_MERGE_OPTIONS.borderWidthPx,
      ),
      borderColor: normalizeHexColor(
        superBlockMergeOptions?.borderColor,
        DEFAULT_SUPER_BLOCK_MERGE_OPTIONS.borderColor,
      ),
      cropToSameHeight: superBlockMergeOptions?.cropToSameHeight ?? DEFAULT_SUPER_BLOCK_MERGE_OPTIONS.cropToSameHeight,
    },
    documentBatchSkipOptions: {
      enabled: documentBatchSkipOptions?.enabled ?? DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS.enabled,
      minSizeKb: normalizeNonNegativeInteger(
        documentBatchSkipOptions?.minSizeKb,
        DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS.minSizeKb,
      ),
      minDimensionPx: normalizeNonNegativeInteger(
        documentBatchSkipOptions?.minDimensionPx ?? documentBatchSkipOptions?.minWidthPx ?? documentBatchSkipOptions?.minHeightPx,
        DEFAULT_DOCUMENT_BATCH_SKIP_OPTIONS.minDimensionPx,
      ),
    },
  };
}

/**
 * 判断图片是否满足跳过条件（小于设定文件大小或宽高之一小于设定阈值）
 */
export function shouldSkipImageTarget(
  metadata: { bytes: number; width: number; height: number },
  options?: DocumentBatchSkipOptions | null,
): boolean {
  if (!options || !options.enabled) {
    return false;
  }

  // 文件体积检查：小于 minSizeKb 时跳过（1 KB = 1024 Bytes）
  if (options.minSizeKb > 0 && metadata.bytes < options.minSizeKb * 1024) {
    return true;
  }

  // 尺寸检查：宽或高之一小于 minDimensionPx 时跳过
  if (
    options.minDimensionPx > 0
    && (metadata.width < options.minDimensionPx || metadata.height < options.minDimensionPx)
  ) {
    return true;
  }

  // 兼容单独配置的宽度阈值
  if (typeof options.minWidthPx === "number" && options.minWidthPx > 0 && metadata.width < options.minWidthPx) {
    return true;
  }

  // 兼容单独配置的高度阈值
  if (typeof options.minHeightPx === "number" && options.minHeightPx > 0 && metadata.height < options.minHeightPx) {
    return true;
  }

  return false;
}

export function getEnabledCommandIds(toggleMap: Partial<CommandToggleMap>): CommandId[] {
  return COMMAND_ORDER.filter(commandId => toggleMap[commandId]);
}

export function getEnabledDocumentBatchCommandIds(
  toggleMap: Partial<DocumentBatchCommandToggleMap>,
): DocumentBatchCommandId[] {
  return DOCUMENT_BATCH_COMMAND_ORDER.filter(commandId => toggleMap[commandId]);
}

function normalizeNonNegativeInteger(value: number | string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/u.test(normalized) ? normalized : fallback;
}
