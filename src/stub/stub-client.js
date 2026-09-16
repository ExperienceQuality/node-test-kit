export function createStubClient({ baseUrl, namespace }) {
  async function call(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        'x-node-test-kit-namespace': namespace,
        ...(options.headers ?? {})
      }
    });

    if (!response.ok) throw new Error(`node-test-kit: stub management request failed (${response.status})`);
    return response.status === 204 ? undefined : response.json();
  }

  return Object.freeze({
    baseUrl,
    namespace,
    add: (interaction) => call('/interactions', { method: 'POST', body: JSON.stringify({ ...interaction, namespace }) }),
    get: (id) => call(`/interactions/${id}`),
    remove: (id) => call(`/interactions/${id}`, { method: 'DELETE' }),
    clear: () => call(`/interactions?namespace=${encodeURIComponent(namespace)}`, { method: 'DELETE' }),
    verify: () => call(`/interactions/verify?namespace=${encodeURIComponent(namespace)}`)
  });
}
