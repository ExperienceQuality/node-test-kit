import { describe, expect, it } from 'vitest';
import { createKit, createRunContext } from '../src/index.js';

describe('core kit', () => {
  it('creates an immutable facade with rest, stub, and run members', () => {
    const run = createRunContext({ id: 'orders-test' }, {
      mock: { baseUrl: 'http://127.0.0.1:9393', namespaceHeader: 'x-node-test-kit-namespace' }
    });
    const kit = createKit(run);

    expect(Object.keys(kit)).toEqual(['rest', 'stub', 'run']);
    expect(kit.run.testId).toBe('orders-test');
    expect(kit.stub.namespace).toBe(kit.run.id);
    expect(Object.isFrozen(kit)).toBe(true);
    expect(Object.isFrozen(kit.run)).toBe(true);
  });
});
