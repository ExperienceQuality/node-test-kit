import { createKit, createRunContext, type Kit } from '@xq/node-test-kit-core';
import {
  createDatabaseClients,
  destroyDatabaseClients,
  type DatabaseClients,
  type DatabaseDescriptors
} from '@xq/node-test-kit-db';
import { expect as vitestExpect, inject, test as vitestTest, type TestAPI } from 'vitest';

export interface NodeTestKitDatabases {}

declare module 'vitest' {
  interface ProvidedContext {
    nodeTestKit: {
      mock: { baseUrl: string; host: string; port: number; managementUrl: string; namespaceHeader: string };
      backendUrl: string | null;
      databases: DatabaseDescriptors;
    };
  }
}

interface NodeTestKitFixtures { kit: Kit<NodeTestKitDatabases> }
interface NodeTestKitWorkerFixtures { nodeTestKitDatabases: DatabaseClients<NodeTestKitDatabases> }

const extendedTest = vitestTest.extend<NodeTestKitFixtures & NodeTestKitWorkerFixtures>({
  nodeTestKitDatabases: [async ({}, use) => {
    const databases = createDatabaseClients<NodeTestKitDatabases>(inject('nodeTestKit').databases);
    try {
      await use(databases);
    } finally {
      await destroyDatabaseClients(databases);
    }
  }, { scope: 'worker' }],
  kit: async ({ task, nodeTestKitDatabases }, use) => {
    const run = createRunContext(task, inject('nodeTestKit'));
    const kit = createKit(run, nodeTestKitDatabases);
    let testError;
    try { await use(kit); } catch (error) { testError = error; }

    let cleanupError;
    try { await kit.stub.clearInteractions(); } catch (error) { cleanupError = error; }

    if (testError && cleanupError) throw new AggregateError([testError, cleanupError], 'node-test-kit: test and fixture cleanup both failed');
    if (testError) throw testError;
    if (cleanupError) throw cleanupError;
  }
});

export const test: TestAPI<NodeTestKitFixtures> = extendedTest;

export const expect = vitestExpect;
