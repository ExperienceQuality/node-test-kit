import pactum from 'pactum';

const { spec } = pactum;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface ApiRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  readonly pathParams?: Readonly<Record<string, string | number>>;
  readonly body?: unknown;
}

export type ApiRequestOptions = Omit<ApiRequest, 'method' | 'path'> & {
  /** @deprecated Use body. */
  readonly data?: unknown;
};

export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: T | undefined;
  readonly text: string;
}

export interface OpenApiClient {
  readonly baseUrl: string | null | undefined;
  request<T = unknown>(request: ApiRequest): Promise<ApiResponse<T>>;
  get<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  post<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  put<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  patch<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  delete<T = unknown>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
}

/** @deprecated Use OpenApiClient. */
export type ApiClient = OpenApiClient;

/** @deprecated Use ApiRequestOptions. */
export type RequestOptions = ApiRequestOptions;

export function createOpenApiClient({
  baseUrl,
  headers: defaultHeaders = {}
}: {
  baseUrl?: string | null;
  headers?: Readonly<Record<string, string>>;
}): OpenApiClient {
  async function request<T>({ method, path, headers = {}, query, pathParams, body }: ApiRequest): Promise<ApiResponse<T>> {
    if (!baseUrl) throw new Error('node-test-kit: backend URL is not configured');
    let requestSpec = spec()[method.toLowerCase() as 'get'](resolveUrl(baseUrl, path));

    if (pathParams !== undefined) requestSpec = requestSpec.withPathParams(pathParams);
    if (query !== undefined) requestSpec = requestSpec.withQueryParams({ ...query });
    requestSpec = requestSpec.withHeaders({ ...defaultHeaders, ...headers });
    if (body !== undefined) {
      requestSpec = body !== null && typeof body === 'object'
        ? requestSpec.withJson(body)
        : requestSpec.withBody(body);
    }

    const response = await requestSpec;
    const text = typeof response.text === 'string' ? response.text : stringifyBody(response.body);
    const parsedBody = parseBody(response.body, text);

    return Object.freeze({
      status: response.statusCode,
      headers: Object.freeze(normalizeHeaders(response.headers)),
      body: parsedBody as T | undefined,
      text
    });
  }

  const client: OpenApiClient = {
    baseUrl,
    request,
    get: (path, options) => requestFromOptions('GET', path, options),
    post: (path, options) => requestFromOptions('POST', path, options),
    put: (path, options) => requestFromOptions('PUT', path, options),
    patch: (path, options) => requestFromOptions('PATCH', path, options),
    delete: (path, options) => requestFromOptions('DELETE', path, options)
  };

  function requestFromOptions<T>(method: HttpMethod, path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    const { data, ...rest } = options ?? {};
    return request({ method, path, ...rest, ...(rest.body === undefined && data !== undefined ? { body: data } : {}) });
  }

  return Object.freeze(client);
}

/** @deprecated Use createOpenApiClient. */
export const createApiClient = createOpenApiClient;

function resolveUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
}

function parseBody(body: unknown, text: string): unknown {
  if (body !== undefined && typeof body !== 'string') return body;
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

function stringifyBody(body: unknown): string {
  if (body === undefined) return '';
  return typeof body === 'string' ? body : JSON.stringify(body);
}
