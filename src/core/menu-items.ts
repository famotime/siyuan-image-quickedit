import type { IMenu } from "siyuan";

import {
  COMMAND_DEFINITIONS,
  DOCUMENT_BATCH_COMMAND_DEFINITIONS,
} from "./command-meta.ts";
import type {
  CommandId,
  DocumentBatchCommandId,
} from "./command-settings.ts";

export type DocumentBatchMode = "insert" | "replace";

interface BuildImageQuickEditSubmenuItemsOptions {
  commandIds: CommandId[];
  imageInfoLabel: string;
  onAddImageBorder?: () => void;
  onCommandClick: (commandId: CommandId) => void;
  onMergeSuperBlockImages?: () => void;
  onOpenLocalEditor?: () => void;
}

interface BuildDocumentBatchSubmenuItemsOptions {
  insertCommandIds: DocumentBatchCommandId[];
  onCommandClick: (commandId: DocumentBatchCommandId, mode: DocumentBatchMode) => void;
  replaceCommandIds: DocumentBatchCommandId[];
}

export function buildImageQuickEditSubmenuItems(
  options: BuildImageQuickEditSubmenuItemsOptions,
): IMenu[] {
  const actionItems: IMenu[] = [];
  if (options.onOpenLocalEditor) {
    actionItems.push({
      click: () => options.onOpenLocalEditor?.(),
      label: "使用本地编辑器编辑",
    });
  }

  if (options.onAddImageBorder) {
    actionItems.push({
      click: () => options.onAddImageBorder?.(),
      label: "添加图像边框",
    });
  }

  if (options.onMergeSuperBlockImages) {
    actionItems.push(buildSuperBlockMergeMenuItem({
      onClick: options.onMergeSuperBlockImages,
    }));
  }

  return [
    {
      label: options.imageInfoLabel,
      type: "readonly",
    },
    {
      type: "separator",
    },
    ...actionItems,
    ...(actionItems.length && options.commandIds.length
      ? [{
          type: "separator" as const,
        }]
      : []),
    ...options.commandIds.map(commandId => ({
      click: () => options.onCommandClick(commandId),
      label: COMMAND_DEFINITIONS[commandId].label,
    })),
  ];
}

export function syncReadonlyMenuItemLabelElement(labelElement: Element, label: string): void {
  if (!(labelElement instanceof HTMLElement)) {
    return;
  }

  labelElement.textContent = label;
  labelElement.style.whiteSpace = "pre-line";
}

export function buildDocumentBatchSubmenuItems(
  options: BuildDocumentBatchSubmenuItemsOptions,
): IMenu[] {
  const items: IMenu[] = [
    ...options.insertCommandIds.map(commandId => ({
      click: () => options.onCommandClick(commandId, "insert"),
      label: DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].insertBatchLabel,
    })),
  ];

  if (options.insertCommandIds.length && options.replaceCommandIds.length) {
    items.push({
      type: "separator",
    });
  }

  items.push(...options.replaceCommandIds.map(commandId => ({
      click: () => options.onCommandClick(commandId, "replace"),
      label: DOCUMENT_BATCH_COMMAND_DEFINITIONS[commandId].replaceBatchLabel,
    })));

  return items;
}

export function buildSuperBlockMergeMenuItem(options: { onClick: () => void }): IMenu {
  return {
    click: () => options.onClick(),
    label: "图片合并",
  };
}
