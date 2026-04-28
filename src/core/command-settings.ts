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

export interface SuperBlockMergeOptions {
  gapPx: number;
  borderWidthPx: number;
  borderColor: string;
}

export interface PluginSettings {
  imageMenuCommands: CommandToggleMap;
  documentInsertMenuCommands: DocumentBatchCommandToggleMap;
  documentReplaceMenuCommands: DocumentBatchCommandToggleMap;
  localEditorPath: string;
  showAddImageBorderMenuItem: boolean;
  showSuperBlockMergeMenuItem: boolean;
  showImageInfoNotification: boolean;
  superBlockMergeOptions: SuperBlockMergeOptions;
}

export type CommandMenuSettingKey =
  | "imageMenuCommands"
  | "documentInsertMenuCommands"
  | "documentReplaceMenuCommands";

type LegacyPluginSettings = Partial<Omit<PluginSettings, "superBlockMergeOptions">> & {
  documentMenuCommands?: Partial<CommandToggleMap>;
  superBlockMergeOptions?: Partial<SuperBlockMergeOptions>;
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
};

export const DEFAULT_SETTINGS: PluginSettings = {
  imageMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  documentInsertMenuCommands: { ...DEFAULT_DOCUMENT_BATCH_COMMAND_TOGGLES },
  documentReplaceMenuCommands: { ...DEFAULT_DOCUMENT_BATCH_COMMAND_TOGGLES },
  localEditorPath: "",
  showAddImageBorderMenuItem: false,
  showSuperBlockMergeMenuItem: true,
  showImageInfoNotification: false,
  superBlockMergeOptions: { ...DEFAULT_SUPER_BLOCK_MERGE_OPTIONS },
};

export function mergeSettings(settings?: LegacyPluginSettings | null): PluginSettings {
  const legacyDocumentMenuCommands = settings?.documentMenuCommands;
  const superBlockMergeOptions = settings?.superBlockMergeOptions;

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
    },
  };
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
