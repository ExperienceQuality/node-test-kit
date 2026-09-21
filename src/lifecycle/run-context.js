import { randomUUID } from 'node:crypto';

export function createRunContext(task = {}, metadata = {}) {
  return Object.freeze({
    id: randomUUID(),
    testId: typeof task.id === 'string' ? task.id : 'unknown-test',
    workerId: process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? 'unknown-worker',
    backendUrl: metadata.backendUrl ?? process.env.NODE_TEST_KIT_BACKEND_URL ?? null,
    mock: metadata.mock ?? {
      baseUrl: process.env.NODE_TEST_KIT_STUB_URL ?? null,
      namespaceHeader: 'x-node-test-kit-namespace'
    }
  });
}
