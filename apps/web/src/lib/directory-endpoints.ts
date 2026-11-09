import type {
  Category,
  CreateCategoryRequest,
  CreateSiteRequest,
  CreateWorkerRequest,
  Deleted,
  Issue,
  IssueStatus,
  Locale,
  Site,
  UpdateCategoryRequest,
  UpdateSiteRequest,
  UpdateWorkerRequest,
  Worker,
  WorkerIssuesChoice,
} from '@muayana/shared';
import { fetchAllPages } from './all-pages';
import { clientFetch, clientFetchRaw } from './api-client';
import { toQuery } from './query-string';

/**
 * The sites, categories and workers endpoints of the contract (docs/specs/…-contract.md), as typed
 * calls over `clientFetch`. Tests mock `@/lib/api-client`.
 */

// Sites

export type SiteTab = 'active' | 'archived';

export const listSites = (
  tab: SiteTab,
  page: number,
  limit: number,
  signal?: AbortSignal,
) =>
  clientFetch<Site[]>(
    `/sites${toQuery({ archived: tab === 'archived' ? 'true' : 'false', page, limit })}`,
    { signal },
  );

export const createSite = (body: CreateSiteRequest) =>
  clientFetch<Site>('/sites', { method: 'POST', body });

export const updateSite = (id: string, body: UpdateSiteRequest) =>
  clientFetch<Site>(`/sites/${id}`, { method: 'PATCH', body });

export const deleteSite = (id: string) =>
  clientFetch<Deleted>(`/sites/${id}`, { method: 'DELETE' });

// Categories

/** Every category, active and not, in their order. */
export const listAllCategories = () =>
  clientFetch<Category[]>('/categories?active=all');

export const createCategory = (body: CreateCategoryRequest) =>
  clientFetch<Category>('/categories', { method: 'POST', body });

export const updateCategory = (id: string, body: UpdateCategoryRequest) =>
  clientFetch<Category>(`/categories/${id}`, { method: 'PATCH', body });

/** All ids, in the new order. */
export const reorderCategories = (ids: string[]) =>
  clientFetch<Category[]>('/categories/order', {
    method: 'PUT',
    body: { ids },
  });

export const deleteCategory = (id: string) =>
  clientFetch<Deleted>(`/categories/${id}`, { method: 'DELETE' });

// Workers

export type WorkerActivity = 'true' | 'false';

export interface WorkerFilter {
  search: string;
  categoryId: string | null;
  active: WorkerActivity;
}

const workerFilterParams = (f: WorkerFilter) => ({
  search: f.search.trim(),
  categoryId: f.categoryId ?? undefined,
  active: f.active,
});

export const listWorkers = (
  filter: WorkerFilter,
  page: number,
  limit: number,
  signal?: AbortSignal,
) =>
  clientFetch<Worker[]>(
    `/workers${toQuery({ ...workerFilterParams(filter), page, limit })}`,
    { signal },
  );

export const getWorker = (id: string) => clientFetch<Worker>(`/workers/${id}`);

export const createWorker = (body: CreateWorkerRequest) =>
  clientFetch<Worker>('/workers', { method: 'POST', body });

export const updateWorker = (id: string, body: UpdateWorkerRequest) =>
  clientFetch<Worker>(`/workers/${id}`, { method: 'PATCH', body });

/**
 * Deletes a worker permanently. `issues` says what happens to his issues (business §3) — needed
 * only when he has some; without it the API refuses 409 WORKER_HAS_ISSUES with their counts.
 */
export const deleteWorker = (id: string, issues?: WorkerIssuesChoice) =>
  clientFetch<Deleted>(`/workers/${id}${toQuery({ issues })}`, {
    method: 'DELETE',
  });

/** The workers CSV for the list's filter, headers in `lang` (contract: export.csv). */
export const exportWorkersCsv = (filter: WorkerFilter, lang: Locale) =>
  clientFetchRaw(
    `/workers/export.csv${toQuery({ ...workerFilterParams(filter), lang })}`,
  );

/**
 * Every one of the worker's issues in one status, newest first — all pages, not just the first
 * 100 (business §5.5 batch send needs every `assigned` one; §5.7 groups show every issue).
 */
export const listWorkerIssues = (workerId: string, status: IssueStatus) =>
  fetchAllPages((page, limit) =>
    clientFetch<Issue[]>(
      `/issues${toQuery({ workerId, status, sort: 'newest', page, limit })}`,
    ),
  );
