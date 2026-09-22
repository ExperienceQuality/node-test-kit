import { expect } from 'vitest';
import { test } from '../../src/vitest/test.js';

test('injects one platform-owned kit fixture', async ({ kit }) => {
  expect(kit.api).toBeDefined();
  expect(kit.stub).toBeDefined();
  expect(kit.run.id).toBeTypeOf('string');
  expect(kit.stub.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
});
