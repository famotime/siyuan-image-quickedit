import { describe, expect, it, vi } from 'vitest';

import { createPowerButtonsProvider } from '@/core/power-buttons-provider.ts';

describe('power buttons provider', () => {
  it('lists all public menu commands for power buttons', async () => {
    const provider = createPowerButtonsProvider({
      invokeCommand: vi.fn(),
      pluginVersion: '1.0.3',
    });

    const commands = await provider.listCommands();
    const commandIds = commands.map(command => command.id);

    expect(provider).toEqual(expect.objectContaining({
      protocol: 'power-buttons-command-provider',
      protocolVersion: 1,
      providerId: 'siyuan-image-quickedit',
      providerName: '图片快剪 / Image QuickEdit',
      providerVersion: '1.0.3',
    }));
    expect(commandIds).toEqual(expect.arrayContaining([
      'current-image.convert-webp',
      'current-image.compress-75',
      'current-image.compress-50',
      'current-image.compress-30',
      'current-image.compress-10',
      'current-image.open-local-editor',
      'current-document.insert.convert-webp',
      'current-document.insert.compress-50',
      'current-document.replace.convert-webp',
      'current-document.replace.compress-10',
      'current-super-block.merge-images',
    ]));
    expect(commands).toHaveLength(17);
  });

  it('rejects unknown commands before invoking plugin logic', async () => {
    const invokeCommand = vi.fn();
    const provider = createPowerButtonsProvider({
      invokeCommand,
      pluginVersion: '1.0.3',
    });

    const result = await provider.invokeCommand('missing-command', {
      sourcePlugin: 'siyuan-power-buttons',
      trigger: 'button-click',
    });

    expect(invokeCommand).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errorCode: 'command-not-found',
    }));
  });
});
