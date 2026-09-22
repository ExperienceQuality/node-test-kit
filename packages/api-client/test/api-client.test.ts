import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createOpenApiClient, type ApiRequest, type OpenApiClient } from '../src/index.js';

let server: Server | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe('createApiClient', () => {
  it('maps an OpenAPI request to Pactum and normalizes JSON response', async () => {
    const requests: Array<{ method?: string | undefined; url?: string | undefined; headers: Record<string, string>; body: string }> = [];
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({ method: request.method, url: request.url, headers: Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, String(value)])), body });
      response.writeHead(201, { 'content-type': 'application/json', 'x-result': 'ok' });
      response.end(JSON.stringify({ created: true }));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not start');

    const client: OpenApiClient = createOpenApiClient({ baseUrl: `http://127.0.0.1:${address.port}/api`, headers: { 'x-run': 'one' } });
    const response = await client.request<{ created: boolean }>({
      method: 'POST',
      path: '/orders/{id}',
      pathParams: { id: 'order-1' },
      query: { dryRun: true },
      body: { productId: 'product-1' },
      headers: { 'x-request': 'two' }
    });

    expect(requests[0]).toMatchObject({ method: 'POST', url: '/api/orders/order-1?dryRun=true', body: JSON.stringify({ productId: 'product-1' }) });
    expect(requests[0]?.headers).toMatchObject({ 'content-type': 'application/json', 'x-run': 'one', 'x-request': 'two' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(response.headers['x-result']).toBe('ok');
  });

  it('supports convenience methods and preserves plain-text bodies', async () => {
    server = createServer((_request, response) => {
      response.writeHead(204);
      response.end();
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not start');

    const client = createOpenApiClient({ baseUrl: `http://127.0.0.1:${address.port}` });
    await expect(client.get('/health')).resolves.toMatchObject({ status: 204, body: undefined, text: '' });
  });

  it('rejects requests when backend URL is absent', async () => {
    await expect(createOpenApiClient({}).get('/health')).rejects.toThrow('backend URL is not configured');
  });

  it('accepts a typed OpenAPI request', () => {
    const request: ApiRequest = { method: 'GET', path: '/health' };
    expect(request.method).toBe('GET');
  });
});
