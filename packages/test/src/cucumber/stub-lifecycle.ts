import { StubClient, startPactumServer, type PactumServer } from '@experiencequality/stub';

const STUB_URL_ENV = 'XQ_TEST_STUB_URL';
const STUB_ENABLED_ENV = 'XQ_TEST_STUB_ENABLED';
const STUB_PORT_ENV = 'XQ_TEST_STUB_PORT';

export interface CucumberStubRuntime {
  readonly url: string;
  readonly namespaceHeader: string;
  readonly server?: PactumServer;
}

let runtime: CucumberStubRuntime | undefined;
let previousStubUrl: string | undefined;

export async function startCucumberStub(force = false): Promise<CucumberStubRuntime | undefined> {
  if (runtime) return runtime;

  const externalUrl = process.env[STUB_URL_ENV]?.trim();
  const enabled = readEnabled();
  if (!externalUrl && !enabled && !force) return undefined;

  previousStubUrl = process.env[STUB_URL_ENV];
  try {
    if (externalUrl) {
      const url = validateUrl(externalUrl);
      runtime = { url, namespaceHeader: 'x-node-test-kit-namespace' };
    } else {
      const port = readPort();
      const server = await startPactumServer(port === undefined ? {} : { port });
      runtime = { url: server.url, namespaceHeader: server.namespaceHeader, server };
    }
    process.env[STUB_URL_ENV] = runtime.url;
    return runtime;
  } catch (error) {
    previousStubUrl = undefined;
    throw new Error(`node-test-kit: Cucumber stub setup failed: ${formatError(error)}`, { cause: error });
  }
}

export function getCucumberStubRuntime(): CucumberStubRuntime | undefined {
  return runtime;
}

export async function stopCucumberStub(): Promise<void> {
  const server = runtime?.server;
  runtime = undefined;
  try {
    await server?.stop();
  } finally {
    if (previousStubUrl === undefined) delete process.env[STUB_URL_ENV];
    else process.env[STUB_URL_ENV] = previousStubUrl;
    previousStubUrl = undefined;
  }
}

function readEnabled(): boolean {
  const value = process.env[STUB_ENABLED_ENV]?.trim().toLowerCase();
  if (!value) return true;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`node-test-kit: ${STUB_ENABLED_ENV} must be true or false`);
}

function readPort(): number | undefined {
  const value = process.env[STUB_PORT_ENV]?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`node-test-kit: ${STUB_PORT_ENV} must be an integer from 0 to 65535`);
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error(`node-test-kit: ${STUB_PORT_ENV} must be an integer from 0 to 65535`);
  }
  return port;
}

function validateUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`node-test-kit: ${STUB_URL_ENV} must be a valid HTTP(S) URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`node-test-kit: ${STUB_URL_ENV} must be a valid HTTP(S) URL`);
  }
  return url.toString().replace(/\/$/, '');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createCucumberStubClient(namespace: string): StubClient | undefined {
  const current = getCucumberStubRuntime();
  return current ? new StubClient({
    baseUrl: current.url,
    namespace,
    namespaceHeader: current.namespaceHeader
  }) : undefined;
}
