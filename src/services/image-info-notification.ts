import { showMessage } from "siyuan";

import { showMultilineMessage } from "@/services/message-display.ts";

interface NotifyImageInfoOptions {
  enabled: boolean;
  imageInfo: string;
  messageId: string;
  notify?: (options: {
    id: string;
    text: string;
    timeout: number;
    type: "info";
  }) => void;
}

export function notifyImageInfo(options: NotifyImageInfoOptions): void {
  if (!options.enabled) {
    return;
  }

  const notify = options.notify ?? defaultNotifyImageInfo;
  notify({
    id: options.messageId,
    text: `图片信息：${options.imageInfo}`,
    timeout: 5000,
    type: "info",
  });
}

function defaultNotifyImageInfo(options: {
  id: string;
  text: string;
  timeout: number;
  type: "info";
}): void {
  showMultilineMessage({
    id: options.id,
    show: showMessage,
    text: options.text,
    timeout: options.timeout,
    type: options.type,
  });
}
