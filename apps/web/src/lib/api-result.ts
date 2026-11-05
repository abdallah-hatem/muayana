import type { ApiResponse, Meta } from '@muayana/shared';

/**
 * What both fetch helpers return. They never throw for an API failure: callers check
 * `success` (and `status === 401` when it matters) and show the translated `error` code.
 */
export type ApiSuccess<T> = {
  success: true;
  status: number;
  data: T;
  meta?: Meta;
};

export type ApiFailure = {
  success: false;
  /** HTTP status; 0 when the API (or the network) couldn't be reached. */
  status: number;
  /** The API's stable code (INVALID_CREDENTIALS, VALIDATION_FAILED, …). */
  error?: string;
  /** The API's English sentence: logs and fallbacks only, never shown as is. */
  message: string;
  /** Extra data the API sent with the error (e.g. retryAfterSeconds). */
  data?: unknown;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export const NETWORK_FAILURE: ApiFailure = {
  success: false,
  status: 0,
  error: 'NETWORK_ERROR',
  message: 'Network error',
};

/** Reads the API's envelope from a Response into an ApiResult. */
export async function readEnvelope<T>(res: Response): Promise<ApiResult<T>> {
  const isJson = res.headers.get('content-type')?.includes('json');
  const body = (isJson ? await res.json().catch(() => null) : null) as Partial<
    ApiResponse<T>
  > | null;
  if (res.ok)
    return {
      success: true,
      status: res.status,
      data: body?.data as T,
      meta: body?.meta,
    };
  return {
    success: false,
    status: res.status,
    error: typeof body?.error === 'string' ? body.error : undefined,
    message:
      typeof body?.message === 'string' ? body.message : 'Request failed',
    data: body?.data,
  };
}
