import { expect, test, vi } from "vitest";

import { notifyImageInfo } from "../src/services/image-info-notification.ts";

test("notifyImageInfo skips the menu-open notification when the setting is disabled", () => {
  const notify = vi.fn();

  notifyImageInfo({
    enabled: false,
    imageInfo: "212.40 KB，950×1026×24 (0.93)",
    messageId: "image-info",
    notify,
  });

  expect(notify).not.toHaveBeenCalled();
});

test("notifyImageInfo shows the menu-open notification when the setting is enabled", () => {
  const notify = vi.fn();

  notifyImageInfo({
    enabled: true,
    imageInfo: "212.40 KB，950×1026×24 (0.93)",
    messageId: "image-info",
    notify,
  });

  expect(notify).toHaveBeenCalledWith({
    id: "image-info",
    text: "图片信息：212.40 KB，950×1026×24 (0.93)",
    timeout: 5000,
    type: "info",
  });
});
