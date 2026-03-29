type ShowMessageFn = (text: string, timeout?: number, type?: "info" | "error", id?: string) => void;

interface ShowMultilineMessageOptions {
  id?: string;
  root?: ParentNode;
  schedule?: (task: () => void) => void;
  show: ShowMessageFn;
  text: string;
  timeout?: number;
  type?: "info" | "error";
}

export function showMultilineMessage(options: ShowMultilineMessageOptions): void {
  options.show(options.text, options.timeout, options.type, options.id);

  const apply = () => {
    applyPreLineToMessage(options.text, options.root);
  };

  apply();
  (options.schedule ?? defaultSchedule)(apply);
}

export function applyPreLineToMessage(text: string, root: ParentNode = document): boolean {
  const messageElements = findMessageElements(root, text);
  for (const messageElement of messageElements) {
    messageElement.style.whiteSpace = "pre-line";
  }

  return messageElements.length > 0;
}

function findMessageElements(root: ParentNode, text: string): HTMLElement[] {
  if (!(root instanceof Document || root instanceof HTMLElement)) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>("div,span"))
    .filter(element => element.textContent === text)
    .filter(element => !Array.from(element.children).some(child => child.textContent === text));
}

function defaultSchedule(task: () => void): void {
  setTimeout(task, 0);
}
