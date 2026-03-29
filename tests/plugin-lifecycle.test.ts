import { expect, test, vi } from "vitest";

test("uninstall removes persisted settings data", async () => {
  const removeData = vi.fn().mockResolvedValue(undefined);
  const { default: SiyuanImageQuickEditPlugin } = await import("../src/index.ts");

  await SiyuanImageQuickEditPlugin.prototype.uninstall.call({
    name: "siyuan-image-quickedit",
    removeData,
  });

  expect(removeData).toHaveBeenCalledWith("settings.json");
});
