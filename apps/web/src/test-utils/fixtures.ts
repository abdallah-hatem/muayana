import type {
  Category,
  Issue,
  IssueDetail,
  Photo,
  Site,
  Worker,
} from '@muayana/shared';
import type { ApiResult } from '@/lib/api-result';

/** Test data in the contract's shapes, with readable fixed ids. */

let seq = 0;
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const nextId = () => uuid(++seq);

export const CAT_PLASTER: Category = {
  id: uuid(901),
  nameAr: 'محارة',
  nameEn: 'Plastering',
  color: '#E5701F',
  sortOrder: 0,
  active: true,
  counts: { open: 3, workers: 2 },
};
export const CAT_ELECTRIC: Category = {
  id: uuid(902),
  nameAr: 'كهرباء',
  nameEn: 'Electrical',
  color: '#3B6FD8',
  sortOrder: 1,
  active: true,
  counts: { open: 1, workers: 1 },
};

export function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: nextId(),
    name: 'Sayed',
    phone: '+201001234567',
    notes: null,
    active: true,
    categories: [CAT_PLASTER],
    counts: {
      assigned: 1,
      sent: 1,
      estimated: 0,
      in_progress: 1,
      solved: 4,
      cancelled: 0,
      open: 3,
      overdue: 0,
    },
    ...overrides,
  };
}

export function makePhoto(overrides: Partial<Photo> = {}): Photo {
  const id = nextId();
  return {
    id,
    kind: 'before',
    url: `https://blob.test/photos/${id}.jpg`,
    width: 1600,
    height: 1200,
    sortOrder: 0,
    createdAt: '2026-11-04T08:00:00.000Z',
    ...overrides,
  };
}

export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: nextId(),
    siteId: uuid(801),
    site: { id: uuid(801), name: 'Palm Tower' },
    number: 38,
    status: 'new',
    priority: 'normal',
    description: null,
    location: null,
    category: null,
    worker: null,
    estimatedDate: null,
    capturedAt: '2026-11-04T08:00:00.000Z',
    createdAt: '2026-11-04T08:01:00.000Z',
    updatedAt: '2026-11-04T08:01:00.000Z',
    assignedAt: null,
    sentAt: null,
    solvedAt: null,
    overdue: false,
    photos: [makePhoto()],
    ...overrides,
  };
}

/** An issue sorted and assigned to `worker`. */
export function assignedIssue(
  worker: Worker,
  overrides: Partial<Issue> = {},
): Issue {
  return makeIssue({
    status: 'assigned',
    description: 'Crack next to the window',
    location: 'Floor 3',
    category: CAT_PLASTER,
    worker: { id: worker.id, name: worker.name, phone: worker.phone },
    ...overrides,
  });
}

export const withHistory = (issue: Issue): IssueDetail => ({
  ...issue,
  history: [],
});

export function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: nextId(),
    name: 'Palm Tower',
    address: null,
    notes: null,
    archived: false,
    createdAt: '2026-11-01T08:00:00.000Z',
    nextNumber: 40,
    counts: { open: 4, new: 2, overdue: 0, total: 6 },
    ...overrides,
  };
}

export const ok = <T>(data: T): ApiResult<T> => ({
  success: true,
  status: 200,
  data,
});

export const fail = (status: number, error: string): ApiResult<never> => ({
  success: false,
  status,
  error,
  message: error,
});
