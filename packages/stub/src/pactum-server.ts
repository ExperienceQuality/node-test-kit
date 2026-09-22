import { createServer } from 'node:net';
import pactum from 'pactum';

const { mock } = pactum;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 0;
const DEFAULT_ATTEMPTS = 5;

export const NAMESPACE_HEADER = 'x-node-test-kit-namespace';

export interface PactumServerOptions {
  host?: string;
  port?: number;
  attempts?: number;
  healthTimeout?: number;
}

export interface PactumServer {
  readonly host: string;
  readonly port: number;
  readonly url: string;
  readonly managementUrl: string;
  readonly namespaceHeader: string;
  stop(): Promise<void>;
}

export async function startPactumServer(options: PactumServerOptions = {}): Promise<PactumServer> {
  const host = options.host ?? DEFAULT_HOST;
  const configuredPort = options.port ?? DEFAULT_PORT;
  const attempts = configuredPort === 0 ? options.attempts ?? DEFAULT_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const port = configuredPort === 0 ? await reservePort(host) : configuredPort;
    try {
      await mock.setDefaults({ host, port });
      await mock.start();
      const url = `http://${host}:${port}`;
      await waitForHealth(url, options.healthTimeout ?? 5_000);
      let stopped = false;
      return Object.freeze({
        host,
        port,
        url,
        managementUrl: `${url}/api/pactum`,
        namespaceHeader: NAMESPACE_HEADER,
        async stop() {
          if (stopped) return;
          stopped = true;
          await mock.stop();
        }
      });
    } catch (error) {
      lastError = error;
      try { await mock.stop(); } catch {}
      if (configuredPort !== 0) break;
    }
  }
  throw new Error(`node-test-kit: Pactum mock server did not start: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

async function reservePort(host: string): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(DEFAULT_PORT, host, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!port) throw new Error(`could not reserve loopback port on ${host}`);
  return port;
}

async function waitForHealth(baseUrl: string, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/pactum/health`);
      if (response.ok) return;
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`health check timed out: ${lastError instanceof Error ? lastError.message : baseUrl}`);
}
