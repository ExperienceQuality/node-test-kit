import { createRestClient, type RestClient } from '@xq/node-test-kit-api-client';
import { StubClient } from '@xq/node-test-kit-stub';
import type { RunContext } from './run-context.js';

export interface Kit {
  readonly api: RestClient;
  readonly rest: RestClient;
  readonly stub: StubClient;
  readonly run: RunContext;
}

export function createKit(run: RunContext): Kit {
  const rest = createRestClient({
    baseUrl: run.backendUrl ? new URL(run.backendUrl).origin : run.backendUrl,
    namespaceHeader: run.mock.namespaceHeader,
    namespace: run.id
  });
  const stub = new StubClient({ ...run.mock, namespace: run.id });
  return Object.freeze({ api: rest, rest, stub, run });
}
