import { PAGE_LIMIT_MAX } from '@muayana/shared';
import type { ApiResult } from './api-result';

/**
 * Every row of a paginated list: asks for page 1, 2, … at the largest page size until the API says
 * there is no next page. The first failure is returned as is (no partial list is ever shown as
 * the whole). A response without `meta` is treated as the last page.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<ApiResult<T[]>>,
): Promise<ApiResult<T[]>> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const res = await fetchPage(page, PAGE_LIMIT_MAX);
    if (!res.success) return res;
    rows.push(...res.data);
    if (!res.meta?.hasNextPage || res.data.length === 0)
      return { ...res, data: rows };
  }
}

/** `items` cut into consecutive groups of at most `size` (the last one may be shorter). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    groups.push(items.slice(i, i + size));
  return groups;
}
