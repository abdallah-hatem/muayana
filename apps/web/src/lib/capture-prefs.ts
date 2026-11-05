import { readLastSiteId, writeLastSiteId } from './last-site';
/**
 * What the capture screen remembers on this phone (localStorage, per device): the last used site,
 * the active sites last fetched (so capture still works offline), and the last captured issue
 * (for "add to the previous issue"). Every read and write survives storage being unavailable.
 */

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

export const capturePrefs = {
  // One remembered site for the whole app (shared with the top-bar switcher, §5.1).
  lastSiteId: () => readLastSiteId(),
  setLastSiteId: (id: string | null) => writeLastSiteId(id),
  cachedSites: () => read(KEYS.sites, isSites),
  setCachedSites: (sites: SiteOption[]) => write(KEYS.sites, sites),
  lastIssue: () => read(KEYS.lastIssue, isLastIssue),
  setLastIssue: (value: LastIssue | null) => write(KEYS.lastIssue, value),
};
