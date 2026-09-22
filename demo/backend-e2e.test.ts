import { expect } from 'vitest';
// Exercise the same source adapter used by the package while running in-repo.
import { test } from '../src/vitest/test.js';

test('consumer drives a dummy backend through the kit facade', async ({ kit }) => {
  const health = await fetch(`${kit.stub.baseUrl}/api/pactum/health`);
  const body = await health.text();

  expect(health.status).toBe(200);
  expect(body).toBe('OK');
  expect(kit.run.id).toBeTypeOf('string');
  expect(kit.api).toBeDefined();

  const payment = await kit.stub.add({
    request: {
      method: 'POST',
      path: '/payments',
      body: { productId: 'product-1' }
    },
    response: {
      status: 201,
      body: { paymentId: 'pay-123', status: 'approved' }
    }
  });
  expect(payment.id).toBeTypeOf('string');

  const response = await kit.api.post('/orders', {
    data: { productId: 'product-1' }
  });

  expect(response.status).toBe(201);
  expect(response.body).toEqual({
    id: 'order-123',
    productId: 'product-1',
    paymentId: 'pay-123',
    status: 'created'
  });
  await kit.stub.verify(payment.id, { exercised: true, callCount: 1 });
});
