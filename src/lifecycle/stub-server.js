import { createServer } from 'node:http';
import { InteractionRegistry } from '../stub/interaction-registry.js';

export async function startStubServer({ port = 0 } = {}) {
  const registry = new InteractionRegistry();
  const server = createServer((request, response) => {
    handleRequest(request, response, registry).catch((error) => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    });
  });

  async function handleRequest(request, response, interactions) {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/interactions' && request.method === 'POST') {
      const input = await readJson(request);
      const interaction = interactions.add(input);
      writeJson(response, 201, interaction);
      return;
    }

    if (url.pathname === '/interactions' && request.method === 'DELETE') {
      interactions.clear(url.searchParams.get('namespace'));
      response.writeHead(204);
      response.end();
      return;
    }

    const interactionId = url.pathname.match(/^\/interactions\/([^/]+)$/)?.[1];
    if (interactionId && request.method === 'GET') {
      const interaction = interactions.get(interactionId);
      if (!interaction) return writeJson(response, 404, { error: 'not_found' });
      writeJson(response, 200, interaction);
      return;
    }

    if (interactionId && request.method === 'DELETE') {
      interactions.remove(interactionId);
      response.writeHead(204);
      response.end();
      return;
    }

    if (url.pathname === '/interactions/verify') {
      writeJson(response, 200, { matched: true });
      return;
    }

    const input = await readRequest(request);
    const interaction = interactions.find(input);
    if (!interaction) return writeJson(response, 404, { error: 'no_matching_interaction' });

    const delay = Number(interaction.response.delay ?? 0);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 30_000)));
    const result = interaction.response;
    writeJson(response, result.status ?? 200, result.body, result.headers);
  }

  

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  return {
    url: `http://127.0.0.1:${actualPort}`,
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function readRequest(request) {
  const body = await readJson(request);
  return {
    method: request.method,
    path: new URL(request.url, 'http://127.0.0.1').pathname,
    headers: Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value])),
    body,
    namespace: request.headers['x-node-test-kit-namespace'] ?? null
  };
}

async function readJson(request) {
  let text = '';
  for await (const chunk of request) text += chunk;
  return text ? JSON.parse(text) : undefined;
}

function writeJson(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(body === undefined ? '' : JSON.stringify(body));
}
