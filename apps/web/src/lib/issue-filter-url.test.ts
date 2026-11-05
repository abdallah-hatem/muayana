import type { ParsedIssueFilter } from '@muayana/shared';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER,
  clearedFilter,
  filterParts,
  filterToSearchParams,
  issuesHref,
  searchParamsToFilter,
  withoutPart,
} from './issue-filter-url';

const SITE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const CATEGORY = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
const WORKER = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

const roundTrip = (filter: ParsedIssueFilter) =>
  searchParamsToFilter(new URLSearchParams(filterToSearchParams(filter)));

/** One filter per field, each with a non-default value. */
const ONE_FIELD: [string, ParsedIssueFilter][] = [
  ['siteId', { sort: 'newest', siteId: SITE }],
  ['categoryId', { sort: 'newest', categoryId: CATEGORY }],
  ['workerId', { sort: 'newest', workerId: WORKER }],
  ['status (one)', { sort: 'newest', status: ['sent'] }],
  [
    'status (several)',
    { sort: 'newest', status: ['assigned', 'sent', 'estimated'] },
  ],
  ['priority (several)', { sort: 'newest', priority: ['high', 'urgent'] }],
  ['overdue true', { sort: 'newest', overdue: true }],
  ['overdue false', { sort: 'newest', overdue: false }],
  ['capturedFrom', { sort: 'newest', capturedFrom: '2026-10-01' }],
  ['capturedTo', { sort: 'newest', capturedTo: '2026-10-31' }],
  ['solvedFrom', { sort: 'newest', solvedFrom: '2026-11-01' }],
  ['solvedTo', { sort: 'newest', solvedTo: '2026-11-05' }],
  ['q (Arabic, spaces, # and &)', { sort: 'newest', q: 'شرخ #38 & باب' }],
  ['sort oldest', { sort: 'oldest' }],
  ['sort priority', { sort: 'priority' }],
  ['sort estimate', { sort: 'estimate' }],
];

describe('URL ↔ filter round-trip is lossless for every filter field (§5.8)', () => {
  it.each(ONE_FIELD)('%s survives filter → URL → filter', (_, filter) => {
    expect(roundTrip(filter)).toEqual(filter);
  });

  it('every field at once survives the round-trip', () => {
    const all: ParsedIssueFilter = {
      siteId: SITE,
      categoryId: CATEGORY,
      workerId: WORKER,
      status: ['unassigned', 'in_progress', 'solved'],
      priority: ['low', 'normal', 'high', 'urgent'],
      overdue: true,
      capturedFrom: '2026-01-01',
      capturedTo: '2026-02-01',
      solvedFrom: '2026-03-01',
      solvedTo: '2026-04-01',
      q: 'crack',
      sort: 'estimate',
    };
    expect(roundTrip(all)).toEqual(all);
  });

  it('URL → filter → URL gives back the same address', () => {
    const qs =
      'siteId=' +
      SITE +
      '&status=assigned%2Csent&priority=urgent&overdue=true&capturedFrom=2026-10-01&q=crack&sort=oldest';
    expect(
      filterToSearchParams(
        searchParamsToFilter(new URLSearchParams(qs)),
      ).toString(),
    ).toBe(qs);
  });

  it('reads a page’s searchParams object as well as URLSearchParams', () => {
    expect(
      searchParamsToFilter({ status: 'sent,new', sort: 'oldest', page: '3' }),
    ).toEqual({ status: ['new', 'sent'], sort: 'oldest' });
  });

  it('the empty filter is the bare list address (default sort left out)', () => {
    expect(filterToSearchParams(EMPTY_FILTER).toString()).toBe('');
    expect(issuesHref({})).toBe('/issues');
    expect(searchParamsToFilter(new URLSearchParams())).toEqual(EMPTY_FILTER);
  });

  it('a hand-edited URL keeps its valid fields and drops the broken ones', () => {
    const filter = searchParamsToFilter(
      new URLSearchParams(
        'siteId=not-a-uuid&status=sent,bogus,sent&priority=nope&overdue=maybe&capturedFrom=2026-13-45&sort=sideways&q=%20%20',
      ),
    );
    expect(filter).toEqual({ status: ['sent'], sort: 'newest' });
  });
});

describe('filter chips', () => {
  const filter: ParsedIssueFilter = {
    sort: 'priority',
    siteId: SITE,
    status: ['sent', 'estimated'],
    overdue: true,
  };

  it('one chip per value, sort excluded', () => {
    expect(filterParts(filter)).toEqual([
      { key: 'siteId', value: SITE },
      { key: 'status', value: 'sent' },
      { key: 'status', value: 'estimated' },
      { key: 'overdue', value: 'true' },
    ]);
  });

  it('removing a chip drops only that value', () => {
    expect(withoutPart(filter, { key: 'status', value: 'sent' })).toEqual({
      ...filter,
      status: ['estimated'],
    });
    expect(
      withoutPart(filter, { key: 'siteId', value: SITE }),
    ).not.toHaveProperty('siteId');
  });

  it('clear all keeps only the sort', () => {
    expect(clearedFilter(filter)).toEqual({ sort: 'priority' });
  });
});
