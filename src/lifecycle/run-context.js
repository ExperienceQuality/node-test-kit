import { randomUUID } from 'node:crypto';

export function createRunContext(task = {}, urls = {}) {
  return Object.freeze({
    id: randomUUID(),
    testId: typeof task.id === 'string' ? task.id : 'unknown-test',
    workerId: process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? 'unknown-worker',
    backendUrl: urls.backendUrl ?? process.env.NODE_TEST_KIT_BACKEND_URL ?? null,
    stubUrl: urls.stubUrl ?? process.env.NODE_TEST_KIT_STUB_URL ?? null
  });
}
