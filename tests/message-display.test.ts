// @vitest-environment jsdom
import { expect, test, vi } from "vitest";

import { applyPreLineToMessage, showMultilineMessage } from "../src/services/message-display.ts";

test("applyPreLineToMessage makes the matching notification node preserve line breaks", () => {
  const messageText = [
    "图片信息：212.40 KB，950×1026×24 (0.93)",
    "当前文档内嵌资源总大小：1.86 MB",
  ].join("\n");

  document.body.innerHTML = `
    <div class="b3-snackbar">
      <div class="b3-snackbar__content">
        <span class="b3-snackbar__text">${messageText}</span>
      </div>
    </div>
  `;

  const patched = applyPreLineToMessage(messageText);
  const textElement = document.querySelector(".b3-snackbar__text") as HTMLElement;

  expect(patched).toBe(true);
  expect(textElement.style.whiteSpace).toBe("pre-line");
});

test("showMultilineMessage shows the message and schedules a multiline patch", () => {
  const show = vi.fn((text: string) => {
    document.body.innerHTML = `<div class="b3-snackbar__text">${text}</div>`;
  });
  const schedule = vi.fn((task: () => void) => task());
  const messageText = [
    "图片信息：212.40 KB，950×1026×24 (0.93)",
    "当前文档内嵌资源总大小：1.86 MB",
  ].join("\n");

  showMultilineMessage({
    schedule,
    show,
    text: messageText,
    timeout: 5000,
    type: "info",
  });

  const textElement = document.querySelector(".b3-snackbar__text") as HTMLElement;

  expect(show).toHaveBeenCalledWith(messageText, 5000, "info", undefined);
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(textElement.style.whiteSpace).toBe("pre-line");
});
