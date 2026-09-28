import { expect } from 'vitest';
import { test } from '../../src/vitest/test.js';

test('starts one platform stub server for the Vitest run', async ({ kit }) => {
  const response = await fetch(`${kit.stub.baseUrl}/api/pactum/health`);

  expect(response.status).toBe(200);
  await expect(response.text()).resolves.toBe('OK');
});
