import pactum from 'pactum';

const { spec } = pactum;
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

export type PactumSpec = ReturnType<typeof spec>;

export interface RestCommand {
  readonly name: string;
  readonly args: readonly unknown[];
}

export interface RestCapture {
  readonly commands: RestCommand[];
  response?: unknown;
  error?: unknown;
}

export interface RestClient {
  readonly captures: readonly RestCapture[];
  get(path: string): PactumSpec;
  post(path: string): PactumSpec;
  put(path: string): PactumSpec;
  patch(path: string): PactumSpec;
  delete(path: string): PactumSpec;
  head(path: string): PactumSpec;
  options(path: string): PactumSpec;
  trace(path: string): PactumSpec;
}

export interface RestClientOptions {
  readonly baseUrl: string | null | undefined;
  readonly namespaceHeader: string;
  readonly namespace: string;
}

export function createRestClient(options: RestClientOptions): RestClient {
  const captures: RestCapture[] = [];
  const factory = {} as RestClient;

  return new Proxy(factory, {
    get(_, property: string | symbol) {
      if (property === 'captures') return captures;
      if (typeof property !== 'string' || !HTTP_METHODS.has(property)) return undefined;

      return (path: string): PactumSpec => {
        if (!options.baseUrl) throw new Error('node-test-kit: backend URL is not configured');
        const capture: RestCapture = { commands: [{ name: property, args: [path] }] };
        captures.push(capture);

        const target = spec();
        const request = applyHttpMethod(target, property, resolveUrl(options.baseUrl, path));
        injectNamespace(request, options);
        return proxySpec(request, capture, options);
      };
    }
  });
}

function applyHttpMethod(target: PactumSpec, method: string, url: string): PactumSpec {
  switch (method) {
    case 'get': return target.get(url);
    case 'post': return target.post(url);
    case 'put': return target.put(url);
    case 'patch': return target.patch(url);
    case 'delete': return target.delete(url);
    case 'head': return target.head(url);
    case 'options': return target.options(url);
    case 'trace': return target.trace(url);
    default: throw new Error(`node-test-kit: unsupported REST method ${method}`);
  }
}

function proxySpec(target: PactumSpec, capture: RestCapture, options: RestClientOptions): PactumSpec {
  let proxy: PactumSpec;

  proxy = new Proxy(target, {
    get(specTarget, property, receiver) {
      if (property === 'toss') {
        return async (...args: unknown[]) => {
          injectNamespace(specTarget, options);
          try {
            const response = await Reflect.apply(specTarget.toss, specTarget, args);
            capture.response = response;
            return response;
          } catch (error) {
            capture.error = error;
            capture.response = getErrorResponse(error);
            throw error;
          }
        };
      }

      if (property === 'then') {
        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          injectNamespace(specTarget, options);
          return specTarget.then(
            (response: unknown) => {
              capture.response = response;
              return onFulfilled ? onFulfilled(response) : response;
            },
            (error: unknown) => {
              capture.error = error;
              capture.response = getErrorResponse(error);
              if (onRejected) return onRejected(error);
              throw error;
            }
          );
        };
      }

      const value = Reflect.get(specTarget, property, receiver);
      if (typeof value !== 'function') return value;

      return (...args: unknown[]) => {
        capture.commands.push({ name: String(property), args });
        const result = Reflect.apply(value, specTarget, args);
        if (property === 'withHeaders') injectNamespace(specTarget, options);
        return result === specTarget ? proxy : result;
      };
    }
  });

  return proxy;
}

function injectNamespace(target: PactumSpec, options: RestClientOptions): void {
  target.withHeaders(options.namespaceHeader, options.namespace);
}

function resolveUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function getErrorResponse(error: unknown): unknown {
  return error && typeof error === 'object' && 'response' in error
    ? (error as { response?: unknown }).response
    : undefined;
}
