import {
  CategoryRefSchema,
  WorkerCountsSchema,
  WorkerSchema,
  type CategoryRef,
} from '@muayana/shared';
import { readLastSiteId, writeLastSiteId } from './last-site';
/**
 * What the capture screen remembers on this phone (localStorage, per device): the last used site,
 * the active sites, trades and contractors last fetched (so capture still works offline, §5.2),
 * and the last captured issue (for "add to the previous issue"). Every read and write survives
 * storage being unavailable.
 */

/** A contractor as the capture sheet keeps him: enough to filter by trade and show his open count. */
const CaptureWorkerSchema = WorkerSchema.pick({
  id: true,
  name: true,
  active: true,
  categories: true,
}).extend({ counts: WorkerCountsSchema.pick({ open: true }) });
export type CaptureWorker = ReturnType<typeof CaptureWorkerSchema.parse>;

const CategoriesCache = CategoryRefSchema.array();
const WorkersCache = CaptureWorkerSchema.array();

export interface SiteOption {
  id: string;
  name: string;
}

export interface LastIssue {
  issueId: string;
  siteId: string;
}

const KEYS = {
  site: 'muayana.capture.site',
  sites: 'muayana.capture.sites',
  lastIssue: 'muayana.capture.lastIssue',
  categories: 'muayana.capture.categories',
  workers: 'muayana.capture.workers',
} as const;

function read<T>(key: string, valid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the screen still works, it just won't remember.
  }
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isSite = (v: unknown): v is SiteOption =>
  typeof v === 'object' &&
  v !== null &&
  isString((v as SiteOption).id) &&
  isString((v as SiteOption).name);
const isSites = (v: unknown): v is SiteOption[] =>
  Array.isArray(v) && v.every(isSite);
const isLastIssue = (v: unknown): v is LastIssue =>
  typeof v === 'object' &&
  v !== null &&
  isString((v as LastIssue).issueId) &&
  isString((v as LastIssue).siteId);

const isCategories = (v: unknown): v is CategoryRef[] =>
  CategoriesCache.safeParse(v).success;
const isWorkers = (v: unknown): v is CaptureWorker[] =>
  WorkersCache.safeParse(v).success;

/** Only the fields the sheet needs, so the cache never carries phones or notes it doesn't use. */
const slimCategory = ({
  id,
  nameAr,
  nameEn,
  color,
}: CategoryRef): CategoryRef => ({
  id,
  nameAr,
  nameEn,
  color,
});
const slimWorker = (w: CaptureWorker): CaptureWorker => ({
  id: w.id,
  name: w.name,
  active: w.active,
  categories: w.categories.map(slimCategory),
  counts: { open: w.counts.open },
});

export const capturePrefs = {
  // One remembered site for the whole app (shared with the top-bar switcher, §5.1).
  lastSiteId: () => readLastSiteId(),
  setLastSiteId: (id: string | null) => writeLastSiteId(id),
  cachedSites: () => read(KEYS.sites, isSites),
  setCachedSites: (sites: SiteOption[]) => write(KEYS.sites, sites),
  lastIssue: () => read(KEYS.lastIssue, isLastIssue),
  setLastIssue: (value: LastIssue | null) => write(KEYS.lastIssue, value),
  cachedCategories: () => read(KEYS.categories, isCategories),
  setCachedCategories: (categories: readonly CategoryRef[]) =>
    write(KEYS.categories, categories.map(slimCategory)),
  cachedWorkers: () => read(KEYS.workers, isWorkers),
  setCachedWorkers: (workers: readonly CaptureWorker[]) =>
    write(KEYS.workers, workers.map(slimWorker)),
};
