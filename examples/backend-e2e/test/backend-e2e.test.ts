import { expect } from 'vitest';
import { test } from 'node-test-kit/vitest';

test('consumer drives a dummy backend through the kit facade', async ({ kit }) => {
  const health = await kit.rest
    .get('/health')
    .expectStatus(200)
    .toss();

  expect(health.body).toEqual({ status: 'ok' });
  expect(kit.run.id).toBeTypeOf('string');
  expect(kit.rest).toBeDefined();

  const payment = await kit.stub.addInteraction({
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
  expect(payment).toBeTypeOf('string');

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
  const paymentInteraction = await kit.stub.getInteraction(payment);
  expect(paymentInteraction.exercised).toBe(true);
  expect(paymentInteraction.callCount).toBe(1);
});
