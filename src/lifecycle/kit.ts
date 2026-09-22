import { createApiClient } from '../rest/api-client.js';
import { createStubClient, type StubClient } from '../stub/stub-client.js';
import type { ApiClient } from '../rest/api-client.js';
import type { RunContext } from './run-context.js';

export interface Kit { readonly api: ApiClient; readonly stub: StubClient; readonly run: RunContext }

export function createKit(run: RunContext): Kit {
  const api = createApiClient({
    baseUrl: run.backendUrl,
    headers: { 'x-node-test-kit-namespace': run.id }
  });

  const stub = createStubClient({ ...run.mock, namespace: run.id });

  return Object.freeze({ api, stub, run });
}
