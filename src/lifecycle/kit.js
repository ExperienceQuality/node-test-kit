import { createApiClient } from '../rest/api-client.js';
import { createStubClient } from '../stub/stub-client.js';

export function createKit(run) {
  const api = createApiClient({
    baseUrl: run.backendUrl,
    headers: { 'x-node-test-kit-namespace': run.id }
  });

  const stub = createStubClient({ ...run.mock, namespace: run.id });

  return Object.freeze({ api, stub, run });
}
