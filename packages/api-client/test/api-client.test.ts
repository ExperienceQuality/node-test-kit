import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/index.js';

afterEach(() => vi.unstubAllGlobals());

describe('createApiClient', () => {
  it('combines the base URL and headers and decodes JSON responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { 'content-type': 'application/json', 'x-result': 'ok' }
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createApiClient({ baseUrl: 'http://127.0.0.1:4000/api', headers: { 'x-run': 'one' } });

    const response = await client.post<{ created: boolean }>('/orders', {
      data: { productId: 'product-1' },
      headers: { 'x-request': 'two' }
    });

    expect(fetchMock).toHaveBeenCalledWith(new URL('http://127.0.0.1:4000/orders'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-run': 'one', 'x-request': 'two' },
      body: JSON.stringify({ productId: 'product-1' })
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(response.headers['x-result']).toBe('ok');
  });

  it('rejects requests when the backend URL is absent', async () => {
    await expect(createApiClient({}).get('/health')).rejects.toThrow('backend URL is not configured');
  });
});
