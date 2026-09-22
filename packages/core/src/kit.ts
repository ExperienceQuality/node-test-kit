import { createOpenApiClient, type OpenApiClient } from '@xq/node-test-kit-api-client';
import { createStubClient, type StubClient } from '@xq/node-test-kit-stub';
import type { RunContext } from './run-context.js';

export interface Kit { readonly api: OpenApiClient; readonly stub: StubClient; readonly run: RunContext }

export function createKit(run: RunContext): Kit {
  const api = createOpenApiClient({
    baseUrl: run.backendUrl ? new URL(run.backendUrl).origin : run.backendUrl,
    headers: { 'x-node-test-kit-namespace': run.id }
  });
  const stub = createStubClient({ ...run.mock, namespace: run.id });
  return Object.freeze({ api, stub, run });
}
