export class Plugin {}

export class Setting {
  constructor(_options?: unknown) {}
}

export function confirm(_title?: string, _text?: string, confirmCallback?: () => void) {
  confirmCallback?.();
}

export async function fetchSyncPost(..._args: unknown[]) {
  return {
    code: 0,
    data: {},
    msg: "",
  };
}

export function getActiveEditor() {
  return undefined;
}

export function showMessage(..._args: unknown[]) {}
