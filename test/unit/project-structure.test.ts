import { describe, expect, it } from 'vitest';
import { createKit } from '../../src/lifecycle/kit.js';
import { createRunContext } from '../../src/lifecycle/run-context.js';

describe('project structure', () => {
  it('exposes the platform-owned Vitest entrypoints', async () => {
    const kit = await import('../../src/index.js');

    expect(kit.test).toBeTypeOf('function');
    expect(kit.expect).toBeTypeOf('function');
    expect(kit.defineConfig).toBeTypeOf('function');
  });

  it('creates an immutable facade with api, stub, and run members', () => {
    const run = createRunContext({ id: 'orders-test' }, {
      mock: {
        baseUrl: 'http://127.0.0.1:9393',
        namespaceHeader: 'x-node-test-kit-namespace'
      }
    });
    const kit = createKit(run);

    expect(Object.keys(kit)).toEqual(['api', 'stub', 'run']);
    expect(kit.run.testId).toBe('orders-test');
    expect(kit.stub.namespace).toBe(kit.run.id);
    expect(Object.isFrozen(kit)).toBe(true);
    expect(Object.isFrozen(kit.run)).toBe(true);
  });
});
