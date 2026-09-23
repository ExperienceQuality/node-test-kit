import { expect } from 'vitest';
import { test } from 'node-test-kit/vitest';

test('consumer drives a dummy backend through the kit facade', async ({ kit }) => {
  const health = await fetch(`${kit.stub.baseUrl}/api/pactum/health`);
  const body = await health.text();

  expect(health.status).toBe(200);
  expect(body).toBe('OK');
  expect(kit.run.id).toBeTypeOf('string');
  expect(kit.rest).toBeDefined();

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

  const response = await kit.rest
    .post('/orders')
    .withJson({ productId: 'product-1' })
    .toss();

  expect(response.statusCode).toBe(201);
  expect(response.body).toEqual({
    id: 'order-123',
    productId: 'product-1',
    paymentId: 'pay-123',
    status: 'created'
  });
  await kit.stub.verify(payment.id, { exercised: true, callCount: 1 });
});
