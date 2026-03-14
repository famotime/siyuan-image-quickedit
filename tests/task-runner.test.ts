import { expect, test } from "vitest";

import { runTargetsSequentially } from "../src/core/task-runner.ts";

test("runTargetsSequentially aggregates success and failure while reporting progress", async () => {
  const progressEvents: string[] = [];
  const result = await runTargetsSequentially({
    commandId: "compress-50",
    onProgress(message) {
      progressEvents.push(message);
    },
    runTarget: async (target) => {
      if (target.id === "image-2") {
        throw new Error("boom");
      }

      return {
        assetPath: `/assets/${target.id}.webp`,
      };
    },
    targets: [
      { id: "image-1", label: "第一张" },
      { id: "image-2", label: "第二张" },
    ],
  });

  expect(progressEvents).toEqual([
    "[1/2] 正在处理第一张",
    "[2/2] 正在处理第二张",
  ]);
  expect(result.successes).toEqual([
    {
      assetPath: "/assets/image-1.webp",
      targetId: "image-1",
    },
  ]);
  expect(result.failures).toEqual([
    {
      error: "boom",
      targetId: "image-2",
    },
  ]);
});
