import type { CommandId } from "./command-settings.ts";

export interface CommandDefinition {
  batchLabel: string;
  id: CommandId;
  label: string;
  targetRatio?: number;
}

export const COMMAND_DEFINITIONS: Record<CommandId, CommandDefinition> = {
  "convert-webp": {
    batchLabel: "全部转为 WebP 格式",
    id: "convert-webp",
    label: "转为 WebP 格式",
  },
  "compress-50": {
    batchLabel: "全部压缩到 50%",
    id: "compress-50",
    label: "压缩到 50%",
    targetRatio: 0.5,
  },
  "compress-30": {
    batchLabel: "全部压缩到 30%",
    id: "compress-30",
    label: "压缩到 30%",
    targetRatio: 0.3,
  },
  "compress-10": {
    batchLabel: "全部压缩到 10%",
    id: "compress-10",
    label: "压缩到 10%",
    targetRatio: 0.1,
  },
};
