import pactum from 'pactum';
import { randomUUID } from 'node:crypto';
import { CAPTURE_HEADER, PactumCaptureRegistry } from './pactum-capture-registry.js';

const { spec } = pactum;

export type PactumSpec = ReturnType<typeof spec>;

export interface RestCapture {
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export interface RestClientOptions {
  readonly baseUrl: string | null | undefined;
  readonly namespaceHeader: string;
  readonly namespace: string;
}

export class RestClient {
  readonly captures: RestCapture[] = [];
  private readonly captureKey = randomUUID();

  constructor(
    readonly config: RestClientOptions,
    private readonly captureRegistry: PactumCaptureRegistry
  ) {
    captureRegistry.register(this, this.captureKey);
  }

  get(path: string): PactumSpec { return this.createSpec('get', path); }
  post(path: string): PactumSpec { return this.createSpec('post', path); }
  put(path: string): PactumSpec { return this.createSpec('put', path); }
  patch(path: string): PactumSpec { return this.createSpec('patch', path); }
  delete(path: string): PactumSpec { return this.createSpec('delete', path); }
  head(path: string): PactumSpec { return this.createSpec('head', path); }
  options(path: string): PactumSpec { return this.createSpec('options', path); }
  trace(path: string): PactumSpec { return this.createSpec('trace', path); }

  private createSpec(method: HttpMethod, path: string): PactumSpec {
    if (!this.config.baseUrl) throw new Error('node-test-kit: backend URL is not configured');

    return createRequestSpec(method, resolveUrl(this.config.baseUrl, path))
      .withHeaders(CAPTURE_HEADER, this.captureKey)
      .withHeaders(this.config.namespaceHeader, this.config.namespace);
  }
}

const captureRegistry = new PactumCaptureRegistry();

export function createRestClient(options: RestClientOptions): RestClient {
  return new RestClient(options, captureRegistry);
}

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace';

function createRequestSpec(targetMethod: HttpMethod, url: string): PactumSpec {
  const target = spec();
  switch (targetMethod) {
    case 'get': return target.get(url);
    case 'post': return target.post(url);
    case 'put': return target.put(url);
    case 'patch': return target.patch(url);
    case 'delete': return target.delete(url);
    case 'head': return target.head(url);
    case 'options': return target.options(url);
    case 'trace': return target.trace(url);
  }
}

function resolveUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
