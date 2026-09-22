import { randomUUID } from 'node:crypto';

export interface MockMetadata {
  baseUrl: string | null;
  namespaceHeader: string;
  host?: string;
  port?: number;
  managementUrl?: string;
}

export interface RunContext {
  readonly id: string;
  readonly testId: string;
  readonly workerId: string;
  readonly backendUrl: string | null;
  readonly mock: MockMetadata;
}

interface RunTask { id?: unknown }
interface RunMetadata { backendUrl?: string | null; mock?: MockMetadata }

export function createRunContext(task: RunTask = {}, metadata: RunMetadata = {}): RunContext {
  return Object.freeze({
    id: randomUUID(),
    testId: typeof task.id === 'string' ? task.id : 'unknown-test',
    workerId: process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? 'unknown-worker',
    backendUrl: metadata.backendUrl ?? process.env.NODE_TEST_KIT_BACKEND_URL ?? null,
    mock: metadata.mock ?? {
      baseUrl: process.env.NODE_TEST_KIT_STUB_URL ?? null,
      namespaceHeader: 'x-node-test-kit-namespace'
    }
  }) as RunContext;
}
