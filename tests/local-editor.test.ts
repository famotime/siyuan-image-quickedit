// @vitest-environment jsdom
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { afterEach, vi } from "vitest";

import {
  buildCacheBustedImageSrc,
  cleanupLocalEditorEditSession,
  commitLocalEditorEditSession,
  createEditedImagePreviewUrl,
  removeCacheBustingSearchParam,
  prepareLocalEditorEditSession,
  resolveLocalEditorImageSource,
  resolveLocalEditorImagePath,
} from "../src/services/local-editor.ts";

const tempDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  return Promise.all(tempDirectories.splice(0).map(dir => rm(dir, {
    force: true,
    recursive: true,
  })));
});

test("resolveLocalEditorImagePath resolves workspace asset urls against Siyuan data dir", () => {
  const imagePath = resolveLocalEditorImagePath("/assets/demo/image.png?t=100", {
    dataDir: "D:\\SiYuan\\workspace\\data",
    origin: "http://127.0.0.1:6806",
  });

  expect(imagePath).toBe("D:\\SiYuan\\workspace\\data\\assets\\demo\\image.png");
});

test("resolveLocalEditorImagePath accepts file protocol paths directly", () => {
  const imagePath = resolveLocalEditorImagePath("file:///D:/Images/demo.png", {
    dataDir: "D:\\SiYuan\\workspace\\data",
    origin: "http://127.0.0.1:6806",
  });

  expect(imagePath).toBe("D:\\Images\\demo.png");
});

test("buildCacheBustedImageSrc replaces an existing timestamp query", () => {
  expect(buildCacheBustedImageSrc("/assets/demo.png?t=100&foo=bar", 200)).toBe(
    "/assets/demo.png?foo=bar&t=200",
  );
});

test("removeCacheBustingSearchParam keeps the persisted image path stable", () => {
  expect(removeCacheBustingSearchParam("/assets/demo.png?t=100&foo=bar")).toBe(
    "/assets/demo.png?foo=bar",
  );
});

test("createEditedImagePreviewUrl keeps assets urls cache-busted instead of converting them to blob urls", async () => {
  vi.spyOn(Date, "now").mockReturnValue(200);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    blob: async () => new Blob(["image"]),
    ok: true,
  } as Response);
  const createObjectURL = vi.fn(() => "blob:http://127.0.0.1:6806/preview");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });

  await expect(createEditedImagePreviewUrl("/assets/demo.png?foo=bar")).resolves.toBe(
    "/assets/demo.png?foo=bar&t=200",
  );
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(createObjectURL).not.toHaveBeenCalled();
});

test("workspace assets are edited through a temporary copy and written back after the editor closes", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "siyuan-image-quickedit-workspace-"));
  tempDirectories.push(workspaceRoot);
  const editorTempRoot = join(workspaceRoot, "editor-temp");
  const workspaceFile = join(workspaceRoot, "data", "assets", "demo", "image.png");
  await mkdir(dirname(workspaceFile), { recursive: true });
  await writeFile(workspaceFile, "original-image");

  const source = resolveLocalEditorImageSource("/assets/demo/image.png?t=100", {
    dataDir: join(workspaceRoot, "data"),
    origin: "http://127.0.0.1:6806",
  });
  const session = await prepareLocalEditorEditSession(source, {
    tempDir: editorTempRoot,
  });

  expect(session.imagePath).not.toBe(workspaceFile);
  expect(await readFile(session.imagePath, "utf8")).toBe("original-image");

  await writeFile(session.imagePath, "edited-image");
  await commitLocalEditorEditSession(session);

  expect(await readFile(workspaceFile, "utf8")).toBe("edited-image");
  await expect(stat(session.imagePath)).rejects.toThrow();
});

test("external file images keep editing the original file path", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "siyuan-image-quickedit-external-"));
  tempDirectories.push(workspaceRoot);
  const externalFile = join(workspaceRoot, "external.png");
  await writeFile(externalFile, "external-image");

  const source = resolveLocalEditorImageSource(`file:///${externalFile.replace(/\\/g, "/")}`, {
    dataDir: join(workspaceRoot, "data"),
    origin: "http://127.0.0.1:6806",
  });
  const session = await prepareLocalEditorEditSession(source, {
    tempDir: join(workspaceRoot, "editor-temp"),
  });

  expect(session.imagePath).toBe(externalFile);
  await commitLocalEditorEditSession(session);
  await cleanupLocalEditorEditSession(session);
  expect(await readFile(externalFile, "utf8")).toBe("external-image");
});
