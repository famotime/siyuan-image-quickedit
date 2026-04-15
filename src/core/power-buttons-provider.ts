import { COMMAND_DEFINITIONS } from '@/core/command-meta.ts';
import { COMMAND_ORDER, type CommandId } from '@/core/command-settings.ts';
import type { DocumentBatchMode } from '@/core/menu-items.ts';
import type {
  PowerButtonsCommandProvider,
  PowerButtonsInvokeContext,
  PowerButtonsInvokeResult,
  PowerButtonsPublicCommand,
} from '@/core/power-buttons-provider-types.ts';

type PublicPowerButtonsCommand =
  | {
      kind: 'current-document-command';
      commandId: CommandId;
      mode: DocumentBatchMode;
    }
  | {
      kind: 'current-image-command';
      commandId: CommandId;
    }
  | {
      kind: 'current-image-local-editor';
    }
  | {
      kind: 'current-super-block-merge';
    };

const CURRENT_IMAGE_CATEGORY = '当前图片';
const CURRENT_DOCUMENT_INSERT_CATEGORY = '当前文档（新增结果）';
const CURRENT_DOCUMENT_REPLACE_CATEGORY = '当前文档（替换原图）';
const CURRENT_SUPER_BLOCK_CATEGORY = '当前超级块';

const CURRENT_IMAGE_COMMANDS: PowerButtonsPublicCommand[] = COMMAND_ORDER.map(commandId => ({
  category: CURRENT_IMAGE_CATEGORY,
  description: '对当前选中的图片执行此处理；若未选中图片，会提示先选中图片。',
  id: `current-image.${commandId}`,
  title: `当前图片：${COMMAND_DEFINITIONS[commandId].label}`,
}));

const CURRENT_DOCUMENT_INSERT_COMMANDS: PowerButtonsPublicCommand[] = COMMAND_ORDER.map(commandId => ({
  category: CURRENT_DOCUMENT_INSERT_CATEGORY,
  description: '对当前文档中的全部图片执行处理，并在原图后插入结果图片。',
  id: `current-document.insert.${commandId}`,
  title: `当前文档：${COMMAND_DEFINITIONS[commandId].insertBatchLabel}`,
}));

const CURRENT_DOCUMENT_REPLACE_COMMANDS: PowerButtonsPublicCommand[] = COMMAND_ORDER.map(commandId => ({
  category: CURRENT_DOCUMENT_REPLACE_CATEGORY,
  description: '对当前文档中的全部图片执行处理，并直接替换原图。',
  id: `current-document.replace.${commandId}`,
  title: `当前文档：${COMMAND_DEFINITIONS[commandId].replaceBatchLabel}`,
}));

export const PUBLIC_POWER_BUTTONS_COMMANDS: PowerButtonsPublicCommand[] = [
  ...CURRENT_IMAGE_COMMANDS,
  {
    category: CURRENT_IMAGE_CATEGORY,
    description: '使用本地图片编辑器打开当前选中的图片；仅 Electron 桌面端可用。',
    desktopOnly: true,
    id: 'current-image.open-local-editor',
    title: '当前图片：使用本地编辑器编辑',
  },
  ...CURRENT_DOCUMENT_INSERT_COMMANDS,
  ...CURRENT_DOCUMENT_REPLACE_COMMANDS,
  {
    category: CURRENT_SUPER_BLOCK_CATEGORY,
    description: '合并当前选中的超级块中的图片，并将结果插入到超级块下方。',
    id: 'current-super-block.merge-images',
    title: '当前超级块：图片合并',
  },
];

const PUBLIC_COMMAND_ID_SET = new Set(PUBLIC_POWER_BUTTONS_COMMANDS.map(command => command.id));

export function parsePublicPowerButtonsCommandId(commandId: string): PublicPowerButtonsCommand | null {
  if (commandId === 'current-image.open-local-editor') {
    return {
      kind: 'current-image-local-editor',
    };
  }

  if (commandId === 'current-super-block.merge-images') {
    return {
      kind: 'current-super-block-merge',
    };
  }

  if (commandId.startsWith('current-image.')) {
    const imageCommandId = commandId.slice('current-image.'.length);
    if (isCommandId(imageCommandId)) {
      return {
        commandId: imageCommandId,
        kind: 'current-image-command',
      };
    }
  }

  if (commandId.startsWith('current-document.insert.')) {
    const documentCommandId = commandId.slice('current-document.insert.'.length);
    if (isCommandId(documentCommandId)) {
      return {
        commandId: documentCommandId,
        kind: 'current-document-command',
        mode: 'insert',
      };
    }
  }

  if (commandId.startsWith('current-document.replace.')) {
    const documentCommandId = commandId.slice('current-document.replace.'.length);
    if (isCommandId(documentCommandId)) {
      return {
        commandId: documentCommandId,
        kind: 'current-document-command',
        mode: 'replace',
      };
    }
  }

  return null;
}

export function createPowerButtonsProvider(options: {
  pluginVersion: string;
  invokeCommand: (
    commandId: string,
    context: PowerButtonsInvokeContext,
  ) => Promise<PowerButtonsInvokeResult> | PowerButtonsInvokeResult;
}): PowerButtonsCommandProvider {
  return {
    protocol: 'power-buttons-command-provider',
    protocolVersion: 1,
    providerId: 'siyuan-image-quickedit',
    providerName: '图片快剪 / Image QuickEdit',
    providerVersion: options.pluginVersion,
    listCommands: () => PUBLIC_POWER_BUTTONS_COMMANDS,
    invokeCommand: async (commandId, context) => {
      if (!PUBLIC_COMMAND_ID_SET.has(commandId)) {
        return {
          errorCode: 'command-not-found',
          message: `未找到公开命令：${commandId}`,
          ok: false,
        };
      }

      try {
        return await options.invokeCommand(commandId, context);
      }
      catch (error) {
        return {
          errorCode: 'execution-failed',
          message: error instanceof Error ? error.message : `执行外部命令失败：${commandId}`,
          ok: false,
        };
      }
    },
  };
}

function isCommandId(value: string): value is CommandId {
  return COMMAND_ORDER.includes(value as CommandId);
}
