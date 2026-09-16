export function createApiClient({ baseUrl, headers: defaultHeaders = {} }) {
  async function request(method, path, options = {}) {
    if (!baseUrl) throw new Error('node-test-kit: backend URL is not configured');

    const response = await fetch(new URL(path, `${baseUrl.replace(/\/$/, '')}/`), {
      method,
      headers: {
        ...(options.data === undefined ? {} : { 'content-type': 'application/json' }),
        ...defaultHeaders,
        ...(options.headers ?? {})
      },
      body: options.data === undefined ? undefined : JSON.stringify(options.data)
    });

    const text = await response.text();
    let body = text;
    try { body = text ? JSON.parse(text) : undefined; } catch {}

    return Object.freeze({
      status: response.status,
      headers: Object.freeze(Object.fromEntries(response.headers.entries())),
      body,
      text
    });
  }

  return Object.freeze({
    baseUrl,
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    put: (path, options) => request('PUT', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options)
  });
}
