/**
 * The response envelope every JSON endpoint returns (contract, header). CSV endpoints are the
 * only routes outside it.
 */

/** Pagination metadata: exactly what the API's BaseRepository returns besides `data`. */
export interface Meta {
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> extends Meta {
  data: T[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  /** An English sentence for logs and fallbacks; the web shows the translated `error` code. */
  message: string;
  statusCode: number;
  data?: T;
  meta?: Meta;
  /** A stable machine code: see `ErrorCode` and `DomainErrorCode`. */
  error?: string;
  timestamp: string;
  path?: string;
}

/** Page sizes from the contract: 20 by default, never more than 100. */
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 100;
