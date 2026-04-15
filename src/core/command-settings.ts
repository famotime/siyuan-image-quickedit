export const COMMAND_ORDER = [
  "convert-webp",
  "compress-75",
  "compress-50",
  "compress-30",
  "compress-10",
] as const;

export type CommandId = (typeof COMMAND_ORDER)[number];

export type CommandToggleMap = Record<CommandId, boolean>;

export interface SuperBlockMergeOptions {
  gapPx: number;
  borderWidthPx: number;
  borderColor: string;
}

export interface PluginSettings {
  imageMenuCommands: CommandToggleMap;
  documentInsertMenuCommands: CommandToggleMap;
  documentReplaceMenuCommands: CommandToggleMap;
  localEditorPath: string;
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

export const DEFAULT_SUPER_BLOCK_MERGE_OPTIONS: SuperBlockMergeOptions = {
  gapPx: 0,
  borderWidthPx: 0,
  borderColor: "#000000",
};

export const DEFAULT_SETTINGS: PluginSettings = {
  imageMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  documentInsertMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  documentReplaceMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  localEditorPath: "",
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
