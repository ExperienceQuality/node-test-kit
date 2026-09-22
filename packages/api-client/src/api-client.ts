export interface RequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: T | undefined;
  readonly text: string;
}

export interface ApiClient {
  readonly baseUrl: string | null | undefined;
  get<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  post<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  put<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  patch<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  delete<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
}

export function createApiClient({ baseUrl, headers: defaultHeaders = {} }: { baseUrl?: string | null; headers?: Record<string, string> }): ApiClient {
  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    if (!baseUrl) throw new Error('node-test-kit: backend URL is not configured');

    const headers = {
      ...(options.data === undefined ? {} : { 'content-type': 'application/json' }),
      ...defaultHeaders,
      ...(options.headers ?? {})
    };
    const init: RequestInit = { method, headers };
    if (options.data !== undefined) init.body = JSON.stringify(options.data);
    const response = await fetch(new URL(path, `${baseUrl.replace(/\/$/, '')}/`), init);

    const text = await response.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : undefined; } catch {}

    return Object.freeze({
      status: response.status,
      headers: Object.freeze(Object.fromEntries(response.headers.entries())),
      body,
      text
    }) as ApiResponse<T>;
  }

  return Object.freeze({
    baseUrl,
    get: <T = unknown>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T = unknown>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
    put: <T = unknown>(path: string, options?: RequestOptions) => request<T>('PUT', path, options),
    patch: <T = unknown>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),
    delete: <T = unknown>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options)
  }) as ApiClient;
}
