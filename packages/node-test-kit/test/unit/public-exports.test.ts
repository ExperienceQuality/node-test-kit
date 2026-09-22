import { describe, expect, it } from 'vitest';

describe('public exports', () => {
  it('preserves the package facade', async () => {
    const kit = await import('../../src/index.js');
    expect(kit.test).toBeTypeOf('function');
    expect(kit.expect).toBeTypeOf('function');
    expect(kit.defineConfig).toBeTypeOf('function');
  });
});
