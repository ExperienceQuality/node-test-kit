import { createRestClient, type RestClient } from '@xq/node-test-kit-rest-client';
import type { DatabaseClients } from '@xq/node-test-kit-db';
import { StubClient } from '@xq/node-test-kit-stub';
import type { RunContext } from './run-context.js';

export interface Kit<Databases = Record<never, never>> {
  readonly api: RestClient;
  readonly db: DatabaseClients<Databases>;
  readonly rest: RestClient;
  readonly stub: StubClient;
  readonly run: RunContext;
}

export function createKit<Databases = Record<never, never>>(
  run: RunContext,
  db: DatabaseClients<Databases> = Object.freeze({}) as DatabaseClients<Databases>
): Kit<Databases> {
  const rest = createRestClient({
    baseUrl: run.backendUrl ? new URL(run.backendUrl).origin : run.backendUrl,
    namespaceHeader: run.mock.namespaceHeader,
    namespace: run.id
  });
  const stub = new StubClient({ ...run.mock, namespace: run.id });
  return Object.freeze({ api: rest, db, rest, stub, run });
}
