import type {
  BulkIssuesRequest,
  BulkIssuesResponse,
  Category,
  ChangeStatusRequest,
  Deleted,
  Issue,
  IssueDetail,
  IssueSort,
  PhotoKind,
  Site,
  UpdateIssueRequest,
  Worker,
} from '@muayana/shared';
import { PAGE_LIMIT_MAX } from '@muayana/shared';
import { clientFetch } from './api-client';
import type { ApiResult } from './api-result';
import { toQuery } from './query-string';

/**
 * The issue endpoints of the contract (docs/specs/…-contract.md "Issues"), and the lookups the
 * sort / issue / send screens need, as typed calls over `clientFetch`. Tests mock `clientFetch`.
 */

/** The sort inbox: `new` issues, oldest first, optionally one site (business §5.3). */
export const listInboxIssues = (siteId: string | null) =>
  clientFetch<Issue[]>(
    `/issues${toQuery({
      status: 'new',
      sort: 'oldest' satisfies IssueSort,
      siteId: siteId ?? undefined,
      limit: PAGE_LIMIT_MAX,
    })}`,
  );

export const getIssue = (id: string) =>
  clientFetch<IssueDetail>(`/issues/${id}`);

export const patchIssue = (id: string, body: UpdateIssueRequest) =>
  clientFetch<Issue>(`/issues/${id}`, { method: 'PATCH', body });

export const changeIssueStatus = (id: string, body: ChangeStatusRequest) =>
  clientFetch<Issue>(`/issues/${id}/status`, { method: 'POST', body });

export const bulkIssues = (body: BulkIssuesRequest) =>
  clientFetch<BulkIssuesResponse>('/issues/bulk', { method: 'POST', body });

/** Moves the source's photos into the target and removes the source (both `new`, §5.3). */
export const mergeIssues = (targetId: string, sourceId: string) =>
  clientFetch<Issue>(`/issues/${targetId}/merge`, {
    method: 'POST',
    body: { sourceId },
  });

export const deleteIssue = (id: string) =>
  clientFetch<Deleted>(`/issues/${id}`, { method: 'DELETE' });

export function addIssuePhoto(
  id: string,
  photo: Blob,
  kind: PhotoKind,
): Promise<ApiResult<Issue>> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('photo', photo);
  return clientFetch<Issue>(`/issues/${id}/photos`, {
    method: 'POST',
    body: form,
  });
}

/** Active categories (the ones that can be chosen, invariant §6.11). */
export const listActiveCategories = () =>
  clientFetch<Category[]>('/categories?active=true');

/** Active workers having the category, with their open counts (business §5.4). */
export const listWorkersForCategory = (categoryId: string) =>
  clientFetch<Worker[]>(
    `/workers${toQuery({ categoryId, active: 'true', limit: PAGE_LIMIT_MAX })}`,
  );

/** Sites that can receive captures (not archived). */
export const listActiveSites = () =>
  clientFetch<Site[]>(
    `/sites${toQuery({ archived: 'false', limit: PAGE_LIMIT_MAX })}`,
  );
