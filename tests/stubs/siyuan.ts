export class Plugin {}

export class Setting {
  constructor(_options?: unknown) {}
}

export function confirm(..._args: unknown[]) {}

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
