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

  const child = spawn(command, {
    cwd,
    shell: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`node-test-kit: backend exited before readiness with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.status < 500) return {
        url,
        async stop(): Promise<void> {
          if (child.exitCode === null) child.kill('SIGTERM');
        }
      };
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  child.kill('SIGTERM');
  throw new Error(`node-test-kit: backend did not become ready: ${lastError instanceof Error ? lastError.message : url}`);
}
