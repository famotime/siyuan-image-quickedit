import type { Plugin } from "siyuan";

let currentPlugin: Plugin | null = null;

export function usePlugin(plugin?: Plugin): Plugin {
  if (plugin) {
    currentPlugin = plugin;
  }

  if (!currentPlugin) {
    throw new Error("Plugin instance is not bound.");
  }

  return currentPlugin;
}

export function init(plugin: Plugin) {
  usePlugin(plugin);
}

export function destroy() {
  currentPlugin = null;
}
