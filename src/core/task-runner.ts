import type { CommandId } from "./command-settings.ts";

interface TaskTarget {
  id: string;
  label: string;
}

interface RunTargetsSequentiallyOptions<TResult> {
  commandId: CommandId;
  onProgress?: (message: string) => void;
  runTarget: (target: TaskTarget, commandId: CommandId) => Promise<TResult>;
  targets: TaskTarget[];
}

interface TaskFailure {
  error: string;
  targetId: string;
}

type TaskSuccess<TResult> = TResult & {
  targetId: string;
};

export async function runTargetsSequentially<TResult>(
  options: RunTargetsSequentiallyOptions<TResult>,
): Promise<{
  failures: TaskFailure[];
  successes: TaskSuccess<TResult>[];
}> {
  const successes: TaskSuccess<TResult>[] = [];
  const failures: TaskFailure[] = [];

  for (const [index, target] of options.targets.entries()) {
    options.onProgress?.(`[${index + 1}/${options.targets.length}] 正在处理${target.label}`);

    try {
      const result = await options.runTarget(target, options.commandId);
      successes.push({
        ...result,
        targetId: target.id,
      });
    }
    catch (error) {
      failures.push({
        error: error instanceof Error ? error.message : String(error),
        targetId: target.id,
      });
    }
  }

  return {
    failures,
    successes,
  };
}
