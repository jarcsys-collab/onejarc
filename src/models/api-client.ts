/** OneJarc frontend snapshot from company-tool-hub/lib/api-client.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Single browser HTTP boundary. No business credentials, token persistence,
 * automatic retries, redirects, or raw backend messages are allowed here. */
import { validateBackendConfig, type BackendConfig } from './backend-config';
export type ApiResponse<T> =
  | { success: true; data: T; requestId: string }
  | {
      success: false;
      error: {
        code: string;
        message?: string;
        fields?: Record<string, string>;
      };
      requestId: string;
    };
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Review the highlighted fields before submitting.',
  UNAUTHORIZED: 'Your session expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'This item is no longer available.',
  CONFLICT: 'The data changed. Reload it before trying again.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.',
  BACKEND_ERROR:
    'The service is temporarily unavailable. Please try again later.',
  NETWORK_ERROR:
    'The service could not be reached. Check your connection and try again.',
  TIMEOUT: 'The request took too long. Check the result before retrying.',
  CANCELLED: 'The request was cancelled.',
  INVALID_RESPONSE:
    'The service returned an unexpected response. Please contact support.',
  NOT_CONFIGURED: 'Company API access is not configured yet.',
  INVALID_REQUEST:
    'This request could not be prepared. Please contact support.',
};
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 0,
    public requestId?: string,
    public fields: Record<string, string> = {},
    public retryAfterSeconds?: number,
  ) {
    super(messages[code] ?? messages.BACKEND_ERROR);
    this.name = 'ApiError';
  }
}
export type ApiDiagnostic = {
  method: HttpMethod;
  code: string;
  status: number;
  requestId?: string;
};
export type ApiRequestOptions = {
  signal?: AbortSignal;
  idempotencyKey?: string;
  revision?: number;
  query?: Record<string, string>;
};
type ClientDependencies = {
  getAccessToken: () => Promise<string | null>;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
  log?: (event: ApiDiagnostic) => void;
};
export type ApiClient = ReturnType<typeof createApiClient>;
const statusCodes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  412: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};
const statusCode = (status: number) => statusCodes[status] ?? 'BACKEND_ERROR';
const safeId = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
    ? value
    : undefined;
export const newRequestKey = () => crypto.randomUUID();
/** Safe UI error, with correlation details only in failure/support context. */
export function describeApiError(failure: unknown): string {
  if (!(failure instanceof ApiError))
    return 'The action could not be completed. Please try again.';
  const wait =
    failure.code === 'RATE_LIMITED' && failure.retryAfterSeconds
      ? ` Retry after ${failure.retryAfterSeconds} seconds.`
      : '';
  const fields = Object.values(failure.fields).join(' ');
  return (
    failure.message +
    (fields ? ' ' + fields : '') +
    wait +
    (failure.requestId ? ` Support reference: ${failure.requestId}.` : '')
  );
}
/** Display only allowlisted field codes, never backend SQL/stack traces or raw messages. */
function fieldMessages(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const codes: Record<string, string> = {
    REQUIRED: 'This field is required.',
    INVALID: 'Review this value.',
    TOO_LONG: 'This value is too long.',
    INVALID_URL: 'Use a valid HTTPS URL.',
    DUPLICATE: 'This value is already in use.',
  };
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, code]) =>
          /^[a-zA-Z][a-zA-Z0-9.]{0,79}$/.test(key) &&
          typeof code === 'string' &&
          Object.hasOwn(codes, code),
      )
      .map(([key, code]) => [key, codes[String(code)]]),
  );
}
function retryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds)
    ? Math.max(0, Math.min(86400, seconds))
    : undefined;
}

export function createApiClient(
  config: BackendConfig,
  dependencies: ClientDependencies,
) {
  validateBackendConfig(config);
  /** Restrict calls to the configured base path; endpoint IDs cannot select a host. */
  function endpoint(path: string, query?: Record<string, string>) {
    if (!/^\/(?!\/)/.test(path) || /[\\?#]/.test(path))
      throw new ApiError('INVALID_REQUEST');
    try {
      for (const segment of path.split('/')) {
        const decoded = decodeURIComponent(segment);
        if (['.', '..'].includes(decoded) || /[\\/#?%]/.test(decoded))
          throw new Error();
      }
      const base = new URL(config.apiBaseUrl.replace(/\/+$/, '') + '/');
      const url = new URL(path.slice(1), base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        throw new Error();
      for (const [key, value] of Object.entries(query ?? {}))
        url.searchParams.set(key, value);
      return url.href;
    } catch {
      throw new ApiError('INVALID_REQUEST');
    }
  }
  async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options: ApiRequestOptions = {},
    decode?: (data: unknown) => T,
  ): Promise<T> {
    if (config.dataSource !== 'api' || !config.apiBaseUrl)
      throw new ApiError('NOT_CONFIGURED');
    const url = endpoint(path, options.query);
    const requestId = newRequestKey();
    const controller = new AbortController();
    let stop: (failure: ApiError) => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      stop = reject;
    });
    function cancel() {
      controller.abort();
      stop(new ApiError('CANCELLED', 0, requestId));
    }
    const timer = setTimeout(() => {
      controller.abort();
      stop(new ApiError('TIMEOUT', 0, requestId));
    }, config.timeoutMs);
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    try {
      return await Promise.race([
        aborted,
        (async () => {
          const token = await dependencies.getAccessToken();
          if (!token) throw new ApiError('UNAUTHORIZED', 401, requestId);
          if (token.length > 16384 || /\s/.test(token))
            throw new ApiError('NOT_CONFIGURED');
          if (controller.signal.aborted) throw new ApiError('CANCELLED');
          const headers: Record<string, string> = {
            Accept: 'application/json',
            Authorization: 'Bearer ' + token,
            'X-Request-ID': requestId,
          };
          if (body !== undefined) headers['Content-Type'] = 'application/json';
          if (method !== 'GET') {
            if (options.idempotencyKey && !safeId(options.idempotencyKey))
              throw new ApiError('INVALID_REQUEST');
            headers['Idempotency-Key'] =
              options.idempotencyKey ?? newRequestKey();
          }
          if (options.revision !== undefined) {
            if (!Number.isSafeInteger(options.revision) || options.revision < 0)
              throw new ApiError('INVALID_REQUEST');
            headers['If-Match'] = '"' + options.revision + '"';
          }
          let serialized: string | undefined;
          try {
            serialized = body === undefined ? undefined : JSON.stringify(body);
          } catch {
            throw new ApiError('INVALID_REQUEST');
          }
          const response = await (dependencies.fetchImpl ?? fetch)(url, {
            method,
            headers,
            body: serialized,
            signal: controller.signal,
            credentials: 'omit',
            mode: 'cors',
            redirect: 'error',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
          });
          let payload: unknown;
          if (response.status !== 204) {
            const content = await response.text();
            if (
              content.length <= 2_000_000 &&
              /application\/(?:[a-z.+-]*\+)?json/i.test(
                response.headers.get('Content-Type') ?? '',
              )
            ) {
              try {
                payload = JSON.parse(content);
              } catch {
                /* Invalid responses become safe errors below. */
              }
            }
          }
          const envelope = payload as Partial<ApiResponse<unknown>> | undefined;
          const correlation =
            safeId(envelope?.requestId) ??
            safeId(response.headers.get('X-Request-ID')) ??
            requestId;
          if (!response.ok)
            throw new ApiError(
              statusCode(response.status),
              response.status,
              correlation,
              response.status === 400 || response.status === 422
                ? fieldMessages(
                    envelope?.success === false
                      ? envelope.error?.fields
                      : undefined,
                  )
                : {},
              retryAfter(response.headers.get('Retry-After')),
            );
          if (response.status === 204 && !decode) return undefined as T;
          if (
            envelope?.success !== true ||
            !Object.hasOwn(envelope, 'data') ||
            !safeId(envelope.requestId)
          )
            throw new ApiError(
              'INVALID_RESPONSE',
              response.status,
              correlation,
            );
          try {
            return decode ? decode(envelope.data) : (envelope.data as T);
          } catch {
            throw new ApiError(
              'INVALID_RESPONSE',
              response.status,
              correlation,
            );
          }
        })(),
      ]);
    } catch (failure) {
      const error =
        failure instanceof ApiError
          ? failure
          : new ApiError('NETWORK_ERROR', 0, requestId);
      try {
        if (error.status === 401) dependencies.onUnauthorized?.();
      } catch {
        /* Do not mask the HTTP failure. */
      }
      // Intentionally omit URLs, bodies, tokens, roles and backend exception text.
      try {
        dependencies.log?.({
          method,
          code: error.code,
          status: error.status,
          requestId: error.requestId,
        });
      } catch {
        /* Diagnostics cannot change request results. */
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  return {
    environment: config.environment,
    request,
    get: <T>(
      path: string,
      options?: ApiRequestOptions,
      decode?: (data: unknown) => T,
    ) => request('GET', path, undefined, options, decode),
    post: <T>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
      decode?: (data: unknown) => T,
    ) => request('POST', path, body, options, decode),
    put: <T>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
      decode?: (data: unknown) => T,
    ) => request('PUT', path, body, options, decode),
    patch: <T>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
      decode?: (data: unknown) => T,
    ) => request('PATCH', path, body, options, decode),
    delete: <T>(
      path: string,
      options?: ApiRequestOptions,
      decode?: (data: unknown) => T,
    ) => request('DELETE', path, undefined, options, decode),
  };
}
