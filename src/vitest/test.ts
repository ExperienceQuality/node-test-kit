import { expect as vitestExpect, inject, test as vitestTest } from 'vitest';
import { createKit } from '../lifecycle/kit.js';
import { createRunContext } from '../lifecycle/run-context.js';
import type { Kit } from '../lifecycle/kit.js';

declare module 'vitest' {
  interface ProvidedContext {
    nodeTestKit: { mock: { baseUrl: string; host: string; port: number; managementUrl: string; namespaceHeader: string }; backendUrl: string | null };
  }
}

interface NodeTestKitFixtures { kit: Kit }

export const test = vitestTest.extend<NodeTestKitFixtures>({
  kit: async ({ task }, use) => {
    const run = createRunContext(task, inject('nodeTestKit'));
    const kit = createKit(run);
    let testError;

    try {
      await use(kit);
    } catch (error) {
      testError = error;
    }

    let cleanupError;
    try {
      await kit.stub.clear();
    } catch (error) {
      cleanupError = error;
    }

    if (testError && cleanupError) {
      throw new AggregateError([testError, cleanupError], 'node-test-kit: test and fixture cleanup both failed');
    }
    if (testError) throw testError;
    if (cleanupError) throw cleanupError;
  }
});

export const expect = vitestExpect;
