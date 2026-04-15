// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const confirmMock = vi.fn((_title: string, _text: string, yes?: () => void) => {
  yes?.();
});
const getActiveEditorMock = vi.fn();
const showMessageMock = vi.fn();

vi.mock('siyuan', () => {
  class Plugin {
    public readonly eventBus = {
      off: vi.fn(),
      on: vi.fn(),
    };

    public readonly addCommand = vi.fn();

    async loadData(): Promise<unknown> {
      return null;
    }

    async removeData(): Promise<void> {}

    async saveData(): Promise<void> {}
  }

  class Setting {
    open() {}
  }

  return {
    Plugin,
    Setting,
    confirm: confirmMock,
    getActiveEditor: getActiveEditorMock,
    showMessage: showMessageMock,
  };
});

afterEach(() => {
  confirmMock.mockClear();
  getActiveEditorMock.mockReset();
  showMessageMock.mockClear();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('power buttons integration', () => {
  it('exposes a provider from the plugin instance', async () => {
    const { default: SiyuanImageQuickEditPlugin } = await import('../src/index.ts');
    const plugin = new SiyuanImageQuickEditPlugin();

    const provider = plugin.getPowerButtonsIntegration?.();

    expect(provider).toEqual(expect.objectContaining({
      protocol: 'power-buttons-command-provider',
      protocolVersion: 1,
      providerId: 'siyuan-image-quickedit',
    }));
    expect(await provider.listCommands()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'current-image.convert-webp' }),
    ]));
  });

  it('returns a friendly message when no image is selected', async () => {
    const { default: SiyuanImageQuickEditPlugin } = await import('../src/index.ts');
    const plugin = new SiyuanImageQuickEditPlugin();

    const result = await plugin.getPowerButtonsIntegration().invokeCommand('current-image.convert-webp', {
      sourcePlugin: 'siyuan-power-buttons',
      trigger: 'button-click',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errorCode: 'context-unavailable',
      message: expect.stringContaining('请先选中图片'),
    }));
  });

  it('routes current-image commands to the selected image target', async () => {
    const { default: SiyuanImageQuickEditPlugin } = await import('../src/index.ts');
    const plugin = new SiyuanImageQuickEditPlugin();
    const processSingleTarget = vi.spyOn(plugin as any, 'processSingleTarget').mockResolvedValue(undefined);

    document.body.innerHTML = `
      <div class="protyle-wysiwyg">
        <div data-node-id="img-1" class="protyle-wysiwyg--select">
          <img src="/assets/demo.png" alt="demo">
        </div>
      </div>
    `;

    const result = await plugin.getPowerButtonsIntegration().invokeCommand('current-image.compress-50', {
      sourcePlugin: 'siyuan-power-buttons',
      trigger: 'button-click',
    });
    await Promise.resolve();

    expect(result).toEqual({
      ok: true,
      alreadyNotified: true,
    });
    expect(processSingleTarget).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'img-1',
      src: '/assets/demo.png',
    }), 'compress-50');
  });

  it('returns a friendly message when no current document is available', async () => {
    const { default: SiyuanImageQuickEditPlugin } = await import('../src/index.ts');
    const plugin = new SiyuanImageQuickEditPlugin();

    const result = await plugin.getPowerButtonsIntegration().invokeCommand('current-document.insert.convert-webp', {
      sourcePlugin: 'siyuan-power-buttons',
      trigger: 'button-click',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errorCode: 'context-unavailable',
      message: expect.stringContaining('请先打开包含图片的文档'),
    }));
  });

  it('routes current-document commands to document batch processing after confirmation', async () => {
    const { default: SiyuanImageQuickEditPlugin } = await import('../src/index.ts');
    const plugin = new SiyuanImageQuickEditPlugin();
    const processDocumentTargets = vi.spyOn(plugin as any, 'processDocumentTargets').mockResolvedValue(undefined);
    const contentElement = document.createElement('div');
    contentElement.innerHTML = `
      <div data-node-id="img-1"><img src="/assets/one.png" alt="one"></div>
      <div data-node-id="img-2"><img src="/assets/two.png" alt="two"></div>
    `;
    getActiveEditorMock.mockReturnValue({
      protyle: {
        contentElement,
        element: contentElement,
      },
    });

    const result = await plugin.getPowerButtonsIntegration().invokeCommand('current-document.replace.compress-10', {
      sourcePlugin: 'siyuan-power-buttons',
      trigger: 'button-click',
    });
    await Promise.resolve();

    expect(result).toEqual({
      ok: true,
      alreadyNotified: true,
    });
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(processDocumentTargets).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ blockId: 'img-1' }),
      expect.objectContaining({ blockId: 'img-2' }),
    ]), 'compress-10', 'replace');
  });

  it('returns a friendly message when no super block is selected for merge', async () => {
    const { default: SiyuanImageQuickEditPlugin } = await import('../src/index.ts');
    const plugin = new SiyuanImageQuickEditPlugin();

    const result = await plugin.getPowerButtonsIntegration().invokeCommand('current-super-block.merge-images', {
      sourcePlugin: 'siyuan-power-buttons',
      trigger: 'button-click',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errorCode: 'context-unavailable',
      message: expect.stringContaining('请先选中包含至少两张图片的超级块'),
    }));
  });
});
