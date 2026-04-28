import type {
  CommandId,
  DocumentBatchCommandId,
} from "./command-settings.ts";

export interface CommandDefinition {
  id: CommandId;
  insertBatchLabel: string;
  label: string;
  replaceBatchLabel: string;
  targetRatio?: number;
}

export interface DocumentBatchCommandDefinition {
  id: DocumentBatchCommandId;
  insertBatchLabel: string;
  replaceBatchLabel: string;
}

export const COMMAND_DEFINITIONS: Record<CommandId, CommandDefinition> = {
  "convert-webp": {
    id: "convert-webp",
    insertBatchLabel: "全部转为 WebP 格式（新增）",
    label: "转为 WebP 格式",
    replaceBatchLabel: "全部转为 WebP 格式（替换）",
  },
  "compress-75": {
    id: "compress-75",
    insertBatchLabel: "全部压缩到 75%（新增）",
    label: "压缩到 75%",
    replaceBatchLabel: "全部压缩到 75%（替换）",
    targetRatio: 0.75,
  },
  "compress-50": {
    id: "compress-50",
    insertBatchLabel: "全部压缩到 50%（新增）",
    label: "压缩到 50%",
    replaceBatchLabel: "全部压缩到 50%（替换）",
    targetRatio: 0.5,
  },
  "compress-30": {
    id: "compress-30",
    insertBatchLabel: "全部压缩到 30%（新增）",
    label: "压缩到 30%",
    replaceBatchLabel: "全部压缩到 30%（替换）",
    targetRatio: 0.3,
  },
  "compress-10": {
    id: "compress-10",
    insertBatchLabel: "全部压缩到 10%（新增）",
    label: "压缩到 10%",
    replaceBatchLabel: "全部压缩到 10%（替换）",
    targetRatio: 0.1,
  },
};

export const DOCUMENT_BATCH_COMMAND_DEFINITIONS: Record<DocumentBatchCommandId, DocumentBatchCommandDefinition> = {
  "convert-webp": {
    id: "convert-webp",
    insertBatchLabel: COMMAND_DEFINITIONS["convert-webp"].insertBatchLabel,
    replaceBatchLabel: COMMAND_DEFINITIONS["convert-webp"].replaceBatchLabel,
  },
  "compress-75": {
    id: "compress-75",
    insertBatchLabel: COMMAND_DEFINITIONS["compress-75"].insertBatchLabel,
    replaceBatchLabel: COMMAND_DEFINITIONS["compress-75"].replaceBatchLabel,
  },
  "compress-50": {
    id: "compress-50",
    insertBatchLabel: COMMAND_DEFINITIONS["compress-50"].insertBatchLabel,
    replaceBatchLabel: COMMAND_DEFINITIONS["compress-50"].replaceBatchLabel,
  },
  "compress-30": {
    id: "compress-30",
    insertBatchLabel: COMMAND_DEFINITIONS["compress-30"].insertBatchLabel,
    replaceBatchLabel: COMMAND_DEFINITIONS["compress-30"].replaceBatchLabel,
  },
  "compress-10": {
    id: "compress-10",
    insertBatchLabel: COMMAND_DEFINITIONS["compress-10"].insertBatchLabel,
    replaceBatchLabel: COMMAND_DEFINITIONS["compress-10"].replaceBatchLabel,
  },
  "add-border": {
    id: "add-border",
    insertBatchLabel: "全部图片添加边框（新增）",
    replaceBatchLabel: "图片添加边框（替换）",
  },
};
