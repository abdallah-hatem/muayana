import {
  ISSUE_STATUSES,
  IssueFilterSchema,
  PRIORITIES,
  type IssueStatus,
  type ParsedIssueFilter,
  type Priority,
} from '@muayana/shared';
import { ROUTES } from './routes';

/**
 * The issues list filter lives in the address (business §5.8): bookmarkable, survives reload,
 * and is exactly what the CSV export sends. This is the one place that turns a filter into
 * query parameters and back. Both directions validate each field with the contract's
 * `IssueFilterSchema` and drop what doesn't parse, so a hand-edited URL never breaks the page.
 *
 * Multi-value fields (status, priority) are written comma-separated, in lifecycle / rank order and
 * without repeats, so the same filter always makes the same URL.
 */

/** The filter fields, in the order they are written to the URL. */
export const ISSUE_FILTER_KEYS = [
  'siteId',
  'categoryId',
  'workerId',
  'status',
  'priority',
  'overdue',
  'capturedFrom',
  'capturedTo',
  'solvedFrom',
  'solvedTo',
  'q',
  'sort',
] as const satisfies readonly (keyof ParsedIssueFilter)[];

export type IssueFilterKey = (typeof ISSUE_FILTER_KEYS)[number];

const DEFAULT_SORT: ParsedIssueFilter['sort'] = 'newest';

/** The empty filter: everything, newest first. */
export const EMPTY_FILTER: ParsedIssueFilter = { sort: DEFAULT_SORT };

type ParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (typeof (source as URLSearchParams).get === 'function') {
    return (source as URLSearchParams).get(key) ?? undefined;
  }
  const value = (source as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Keeps the known values of a comma list, in the enum's order, each once. */
function canonicalList<T extends string>(
  values: readonly string[],
  order: readonly T[],
): T[] {
  const wanted = new Set(values);
  return order.filter((value) => wanted.has(value));
}

const shape = IssueFilterSchema.shape;

function parseField<K extends IssueFilterKey>(
  key: K,
  raw: string,
): ParsedIssueFilter[K] | undefined {
  switch (key) {
    case 'status': {
      const list = canonicalList(raw.split(','), ISSUE_STATUSES);
      return (list.length ? list : undefined) as ParsedIssueFilter[K];
    }
    case 'priority': {
      const list = canonicalList(raw.split(','), PRIORITIES);
      return (list.length ? list : undefined) as ParsedIssueFilter[K];
    }
    case 'q': {
      const parsed = shape.q.safeParse(raw);
      return (
        parsed.success && parsed.data ? parsed.data : undefined
      ) as ParsedIssueFilter[K];
    }
    default: {
      const parsed = shape[key].safeParse(raw);
      return (parsed.success ? parsed.data : undefined) as ParsedIssueFilter[K];
    }
  }
}

/** Reads the filter from the address (`useSearchParams()`, a page's `searchParams`, …). */
export function searchParamsToFilter(source: ParamSource): ParsedIssueFilter {
  const filter: ParsedIssueFilter = { ...EMPTY_FILTER };
  for (const key of ISSUE_FILTER_KEYS) {
    const raw = read(source, key);
    if (raw === undefined || raw === '') continue;
    const value = parseField(key, raw);
    if (value !== undefined) Object.assign(filter, { [key]: value });
  }
  return filter;
}

function serialise(
  key: IssueFilterKey,
  filter: ParsedIssueFilter,
): string | undefined {
  switch (key) {
    case 'status': {
      const list = canonicalList(filter.status ?? [], ISSUE_STATUSES);
      return list.length ? list.join(',') : undefined;
    }
    case 'priority': {
      const list = canonicalList(filter.priority ?? [], PRIORITIES);
      return list.length ? list.join(',') : undefined;
    }
    case 'overdue':
      return filter.overdue === undefined ? undefined : String(filter.overdue);
    case 'q': {
      const q = filter.q?.trim();
      return q ? q : undefined;
    }
    case 'sort':
      // The default stays out of the address: `/issues` and `/issues?sort=newest` are one list.
      return filter.sort && filter.sort !== DEFAULT_SORT
        ? filter.sort
        : undefined;
    default:
      return filter[key] || undefined;
  }
}

/** Writes the filter as query parameters; empty fields and the default sort are left out. */
export function filterToSearchParams(
  filter: Partial<ParsedIssueFilter>,
): URLSearchParams {
  const complete: ParsedIssueFilter = { ...EMPTY_FILTER, ...filter };
  const params = new URLSearchParams();
  for (const key of ISSUE_FILTER_KEYS) {
    const value = serialise(key, complete);
    if (value !== undefined) params.set(key, value);
  }
  return params;
}

/** The issues list showing `filter`. */
export function issuesHref(filter: Partial<ParsedIssueFilter>): string {
  const qs = filterToSearchParams(filter).toString();
  return qs ? `${ROUTES.issues}?${qs}` : ROUTES.issues;
}

/** One removable piece of the filter, as a chip shows it. */
export type FilterPart =
  | { key: 'status'; value: IssueStatus }
  | { key: 'priority'; value: Priority }
  | {
      key: Exclude<IssueFilterKey, 'status' | 'priority' | 'sort'>;
      value: string;
    };

/** Every active filter value, one chip each (sort is an order, not a filter). */
export function filterParts(filter: ParsedIssueFilter): FilterPart[] {
  const parts: FilterPart[] = [];
  for (const key of ISSUE_FILTER_KEYS) {
    if (key === 'sort') continue;
    if (key === 'status')
      for (const value of filter.status ?? []) parts.push({ key, value });
    else if (key === 'priority')
      for (const value of filter.priority ?? []) parts.push({ key, value });
    else {
      const value = serialise(key, filter);
      if (value !== undefined) parts.push({ key, value });
    }
  }
  return parts;
}

/** The filter without one chip's value. */
export function withoutPart(
  filter: ParsedIssueFilter,
  part: FilterPart,
): ParsedIssueFilter {
  const next: ParsedIssueFilter = { ...filter };
  if (part.key === 'status') {
    const rest = (filter.status ?? []).filter((s) => s !== part.value);
    next.status = rest.length ? rest : undefined;
  } else if (part.key === 'priority') {
    const rest = (filter.priority ?? []).filter((p) => p !== part.value);
    next.priority = rest.length ? rest : undefined;
  } else {
    delete next[part.key];
  }
  return next;
}

/** Clear all: no filter, the sort kept. */
export function clearedFilter(filter: ParsedIssueFilter): ParsedIssueFilter {
  return { sort: filter.sort };
}
