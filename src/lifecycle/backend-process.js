import { spawn } from 'node:child_process';

export async function startBackend({ command, url, cwd = process.cwd(), timeout = 30_000, env = {} }) {
  if (!command || !url) throw new Error('node-test-kit: application command and URL are required');

  const child = spawn(command, {
    cwd,
    shell: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`node-test-kit: backend exited before readiness with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.status < 500) return {
        url,
        async stop() {
          if (child.exitCode === null) child.kill('SIGTERM');
        }
      };
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  child.kill('SIGTERM');
  throw new Error(`node-test-kit: backend did not become ready: ${lastError?.message ?? url}`);
}
