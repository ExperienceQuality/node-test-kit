import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBackend } from '../src/backend-process.js';

const delayedShutdownCommand = "trap 'sleep 0.1; exit 0' TERM; while :; do sleep 1; done";
const nodeCommand = (script: string) => `${process.execPath} -e ${JSON.stringify(script)}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('backend process lifecycle', () => {
  it('waits for the child to exit and keeps stop idempotent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
    const backend = await startBackend({
      command: delayedShutdownCommand,
      url: 'http://backend.test/health'
    });

    const started = Date.now();
    await Promise.all([backend.stop(), backend.stop()]);

    expect(Date.now() - started).toBeGreaterThanOrEqual(75);
  });

  it('reaps a process when readiness times out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('not ready'); }));
    await expect(startBackend({
      command: delayedShutdownCommand,
      url: 'http://backend.test/health',
      timeout: 20
    })).rejects.toThrow('backend did not become ready: not ready');
  });

  it('reports a backend that exits before readiness', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('not ready'); }));
    await expect(startBackend({
      command: nodeCommand('process.exit(3)'),
      url: 'http://backend.test/health',
      timeout: 1_000
    })).rejects.toThrow('backend exited before readiness with code 3');
  });

  it('reports spawn failures and reaps the failed child', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('not ready'); }));
    await expect(startBackend({
      command: process.execPath,
      cwd: '/definitely/not/a/real/backend-directory',
      url: 'http://backend.test/health',
      timeout: 1_000
    })).rejects.toThrow('failed to spawn backend');
  });
});
