import pactum from 'pactum';

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

  constructor(private readonly config: RestClientOptions) {}

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

    const target = createRequestSpec(method, resolveUrl(this.config.baseUrl, path));
    const capture: RestCapture = { request: undefined };
    this.captures.push(capture);

    decorateHeaders(target, this.config);
    decorateExecution(target, capture, this.config);
    return target;
  }
}

export function createRestClient(options: RestClientOptions): RestClient {
  return new RestClient(options);
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

function decorateHeaders(target: PactumSpec, options: RestClientOptions): void {
  const withHeaders = target.withHeaders.bind(target);
  const decoratedWithHeaders = (...args: [string, unknown] | [object]) => {
    (withHeaders as (...values: unknown[]) => PactumSpec)(...args);
    withHeaders(options.namespaceHeader, options.namespace);
    return target;
  };
  target.withHeaders = decoratedWithHeaders as PactumSpec['withHeaders'];
  withHeaders(options.namespaceHeader, options.namespace);
}

function decorateExecution(target: PactumSpec, capture: RestCapture, options: RestClientOptions): void {
  const toss = target.toss.bind(target);
  target.toss = async () => {
    capture.request = readRequest(target);
    injectNamespace(target, options);

    try {
      const response = await toss();
      capture.response = response;
      return response;
    } catch (error) {
      capture.error = error;
      capture.response = getErrorResponse(error);
      throw error;
    }
  };
}

function injectNamespace(target: PactumSpec, options: RestClientOptions): void {
  target.withHeaders(options.namespaceHeader, options.namespace);
}

function readRequest(target: PactumSpec): unknown {
  const request = (target as unknown as { _request: unknown })._request;
  return structuredClone(request);
}

function resolveUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function getErrorResponse(error: unknown): unknown {
  return error && typeof error === 'object' && 'response' in error
    ? (error as { response?: unknown }).response
    : undefined;
}
