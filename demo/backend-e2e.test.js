import { expect } from 'vitest';
import { test } from 'node-test-kit/vitest';

test('consumer drives a dummy backend through the kit facade', async ({ kit }) => {
  const health = await fetch(`${kit.stub.baseUrl}/health`);
  const body = await health.json();

  expect(health.status).toBe(200);
  expect(body).toEqual({ status: 'ok' });
  expect(kit.run.id).toBeTypeOf('string');
  expect(kit.api).toBeDefined();

  const payment = await kit.stub.add({
    method: 'POST',
    path: '/payments',
    body: { productId: 'product-1' },
    response: {
      status: 201,
      body: { paymentId: 'pay-123', status: 'approved' }
    },
    times: 1
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
});
