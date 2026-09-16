import { expect as vitestExpect, inject, test as vitestTest } from 'vitest';
import { createKit } from '../lifecycle/kit.js';
import { createRunContext } from '../lifecycle/run-context.js';

export const test = vitestTest.extend({
  kit: async ({ task }, use) => {
    const run = createRunContext(task, {
      backendUrl: inject('backendUrl'),
      stubUrl: inject('stubUrl')
    });
    const kit = createKit(run);

    try {
      await use(kit);
    } finally {
      await kit.stub.clear();
    }
  }
});

export const expect = vitestExpect;
