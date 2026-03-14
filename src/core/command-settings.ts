export const COMMAND_ORDER = [
  "convert-webp",
  "compress-50",
  "compress-30",
  "compress-10",
] as const;

export type CommandId = (typeof COMMAND_ORDER)[number];

export type CommandToggleMap = Record<CommandId, boolean>;

export interface PluginSettings {
  imageMenuCommands: CommandToggleMap;
  documentInsertMenuCommands: CommandToggleMap;
  documentReplaceMenuCommands: CommandToggleMap;
}

type LegacyPluginSettings = Partial<PluginSettings> & {
  documentMenuCommands?: Partial<CommandToggleMap>;
};

export const DEFAULT_COMMAND_TOGGLES: CommandToggleMap = {
  "convert-webp": true,
  "compress-50": true,
  "compress-30": true,
  "compress-10": true,
};

export const DEFAULT_SETTINGS: PluginSettings = {
  imageMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  documentInsertMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
  documentReplaceMenuCommands: { ...DEFAULT_COMMAND_TOGGLES },
};

export function mergeSettings(settings?: LegacyPluginSettings | null): PluginSettings {
  const legacyDocumentMenuCommands = settings?.documentMenuCommands;

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
  };
}

export function getEnabledCommandIds(toggleMap: Partial<CommandToggleMap>): CommandId[] {
  return COMMAND_ORDER.filter(commandId => toggleMap[commandId]);
}
