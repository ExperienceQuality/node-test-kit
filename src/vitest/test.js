import { expect as vitestExpect, inject, test as vitestTest } from 'vitest';
import { createKit } from '../lifecycle/kit.js';
import { createRunContext } from '../lifecycle/run-context.js';

export const test = vitestTest.extend({
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
