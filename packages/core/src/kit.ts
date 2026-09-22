import { createApiClient, type ApiClient } from '@xq/node-test-kit-api-client';
import { createStubClient, type StubClient } from '@xq/node-test-kit-stub';
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
