import type { IMenu } from "siyuan";

import { COMMAND_DEFINITIONS } from "./command-meta.ts";
import type { CommandId } from "./command-settings.ts";

interface BuildImageQuickEditSubmenuItemsOptions {
  commandIds: CommandId[];
  imageInfoLabel: string;
  onCommandClick: (commandId: CommandId) => void;
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
