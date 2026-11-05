import type { Mock } from 'vitest';
import type { ClientFetchOptions } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';

/**
 * The API boundary in component tests. A test file mocks the module:
 *   vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));
 * then routes calls with `routeApi(...)` and reads what was sent with `calls(...)`.
 */

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (
  call: ApiCall,
) => ApiResult<unknown> | Promise<ApiResult<unknown>>;

/** `'PATCH /issues/'` matches by method and path prefix; the first matching route answers. */
export function routeApi(
  clientFetch: unknown,
  routes: Record<string, Handler>,
): void {
  (clientFetch as Mock).mockImplementation(
    async (path: string, options: ClientFetchOptions = {}) => {
      const call: ApiCall = {
        method: (options.method ?? 'GET').toUpperCase(),
        path,
        body: options.body,
      };
      for (const [key, handler] of Object.entries(routes)) {
        const [method, prefix] = key.split(' ');
        if (method === call.method && path.startsWith(prefix))
          return handler(call);
      }
      throw new Error(`Unrouted API call: ${call.method} ${path}`);
    },
  );
}

/** Every call the screen sent, optionally only one method and path prefix. */
export function calls(
  clientFetch: unknown,
  method?: string,
  prefix = '',
): ApiCall[] {
  const sent = (
    clientFetch as Mock<(path: string, options?: ClientFetchOptions) => unknown>
  ).mock.calls;
  return sent
    .map(([path, options = {}]) => ({
      method: (options.method ?? 'GET').toUpperCase(),
      path,
      body: options.body,
    }))
    .filter(
      (c) => (!method || c.method === method) && c.path.startsWith(prefix),
    );
}

/** A promise the test resolves when it chooses (to hold a request pending). */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

export const resetApi = (clientFetch: unknown) =>
  (clientFetch as Mock).mockReset();
