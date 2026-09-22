import { createServer } from 'node:http';

const server = createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (request.method === 'POST' && request.url === '/orders') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body || '{}');
    const paymentBaseUrl = process.env.NODE_TEST_KIT_STUB_URL ?? process.env.PAYMENTS_URL?.replace(/\/payments$/, '');
    const namespace = request.headers['x-node-test-kit-namespace'];
    const payment = await fetch(`${paymentBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-node-test-kit-namespace': Array.isArray(namespace) ? namespace[0] ?? '' : namespace ?? ''
      },
      body: JSON.stringify({ productId: input.productId })
    });
    if (!payment.ok) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'payment_failed' }));
      return;
    }
    const paymentBody = await payment.json();
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: 'order-123', productId: input.productId, paymentId: paymentBody.paymentId, status: 'created' }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(4000, '127.0.0.1');
