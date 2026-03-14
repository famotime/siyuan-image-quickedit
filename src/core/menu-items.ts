import type { IMenu } from "siyuan";

import { COMMAND_DEFINITIONS } from "./command-meta.ts";
import type { CommandId } from "./command-settings.ts";

export type DocumentBatchMode = "insert" | "replace";

interface BuildImageQuickEditSubmenuItemsOptions {
  commandIds: CommandId[];
  imageInfoLabel: string;
  onCommandClick: (commandId: CommandId) => void;
}

interface BuildDocumentBatchSubmenuItemsOptions {
  insertCommandIds: CommandId[];
  onCommandClick: (commandId: CommandId, mode: DocumentBatchMode) => void;
  replaceCommandIds: CommandId[];
}

export function buildImageQuickEditSubmenuItems(
  options: BuildImageQuickEditSubmenuItemsOptions,
): IMenu[] {
  return [
    {
      label: options.imageInfoLabel,
      type: "readonly",
    },
    {
      type: "separator",
    },
    ...options.commandIds.map(commandId => ({
      click: () => options.onCommandClick(commandId),
      label: COMMAND_DEFINITIONS[commandId].label,
    })),
  ];
}

export function buildDocumentBatchSubmenuItems(
  options: BuildDocumentBatchSubmenuItemsOptions,
): IMenu[] {
  const items: IMenu[] = [
    ...options.insertCommandIds.map(commandId => ({
      click: () => options.onCommandClick(commandId, "insert"),
      label: COMMAND_DEFINITIONS[commandId].insertBatchLabel,
    })),
  ];

  if (options.insertCommandIds.length && options.replaceCommandIds.length) {
    items.push({
      type: "separator",
    });
  }

  items.push(...options.replaceCommandIds.map(commandId => ({
      click: () => options.onCommandClick(commandId, "replace"),
      label: COMMAND_DEFINITIONS[commandId].replaceBatchLabel,
    })));

  return items;
}
