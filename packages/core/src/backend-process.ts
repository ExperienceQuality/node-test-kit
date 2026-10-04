import { spawn } from 'node:child_process';

export interface BackendOptions {
  command: string;
  url: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string | undefined>;
}

export interface BackendProcess { url: string; stop(): Promise<void> }

export async function startBackend({ command, url, cwd = process.cwd(), timeout = 30_000, env = {} }: BackendOptions): Promise<BackendProcess> {
  if (!command || !url) throw new Error('node-test-kit: application command and URL are required');

  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    throw new Error(`node-test-kit: failed to spawn backend: ${error instanceof Error ? error.message : String(error)}`);
  }

  let spawnError: Error | undefined;
  let hasExited = false;
  const exit = new Promise<void>((resolve) => {
    const reap = () => {
      hasExited = true;
      resolve();
    };
    child.once('exit', reap);
    // A process that cannot be spawned can emit `error` without `exit`, but
    // `close` is still guaranteed once its stdio has been closed.
    child.once('close', reap);
    child.once('error', (error) => {
      spawnError = error;
    });
  });

  let stopPromise: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    if (!stopPromise) {
      stopPromise = (async () => {
        if (!hasExited && child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM');
        }
        await exit;
      })();
    }
    return stopPromise;
  };

  const earlyExitError = () =>
    new Error(`node-test-kit: backend exited before readiness with code ${child.exitCode ?? 'null'}${child.signalCode ? ` (${child.signalCode})` : ''}`);

  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const currentSpawnError = spawnError;
    if (currentSpawnError) {
      await exit;
      throw new Error(`node-test-kit: failed to spawn backend: ${currentSpawnError.message}`);
    }
    if (hasExited || child.exitCode !== null || child.signalCode !== null) {
      await exit;
      throw earlyExitError();
    }
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        if (hasExited || child.exitCode !== null || child.signalCode !== null) {
          await exit;
          throw earlyExitError();
        }
        return { url, stop };
      }
    } catch (error) {
      lastError = error;
    }
    const afterFetchSpawnError = spawnError;
    if (afterFetchSpawnError) {
      await exit;
      throw new Error(`node-test-kit: failed to spawn backend: ${afterFetchSpawnError.message}`);
    }
    if (hasExited || child.exitCode !== null || child.signalCode !== null) {
      await exit;
      throw earlyExitError();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await stop();
  throw new Error(`node-test-kit: backend did not become ready: ${lastError instanceof Error ? lastError.message : url}`);
}
