import {
  OPEN_STATUSES,
  type Dashboard,
  type ParsedIssueFilter,
} from '@muayana/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { searchParamsToFilter } from '@/lib/issue-filter-url';
import { renderIntl } from '@/test-utils/render-intl';
import { LAST_SITE_KEY } from './dashboard-links';
import { DashboardScreen, DashboardView } from './dashboard-screen';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));
const fetchMock = vi.mocked(clientFetch);

const SITE_A = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SITE_B = '9b2f1c3e-2d4a-4b5c-8d6e-7f8a9b0c1d2e';
const PAINT = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
const ELEC = '2c5f39cb-3ab2-42e3-994f-1127e4ddb538';
const SAYED = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

const DATA: Dashboard = {
  byStatus: {
    new: 23,
    unassigned: 5,
    assigned: 9,
    sent: 12,
    estimated: 8,
    in_progress: 7,
    solved: 87,
    cancelled: 2,
  },
  overdue: 6,
  inbox: 23,
  byCategory: [
    {
      category: {
        id: PAINT,
        nameAr: 'نقاشة',
        nameEn: 'Painting',
        color: '#E5701F',
      },
      open: 14,
      overdue: 2,
    },
    {
      category: { id: ELEC, nameAr: 'كهرباء', nameEn: null, color: '#3B6FD8' },
      open: 9,
      overdue: 0,
    },
  ],
  byWorker: [
    {
      worker: { id: SAYED, name: 'Sayed', phone: '01012345678' },
      open: 11,
      overdue: 3,
    },
  ],
  bySite: [
    { site: { id: SITE_A, name: 'Palm Tower' }, open: 30, new: 20, overdue: 6 },
    { site: { id: SITE_B, name: 'Nile Villas' }, open: 11, new: 3, overdue: 0 },
  ],
};

const filterOf = (href: string | null): ParsedIssueFilter => {
  expect(href).toMatch(/^\/issues(\?|$)/);
  return searchParamsToFilter(new URLSearchParams(href!.split('?')[1] ?? ''));
};
const open = [...OPEN_STATUSES];

describe('Each dashboard number links to the list with the matching filter (§5.9)', () => {
  afterEach(() => fetchMock.mockReset());

  it('status tiles: open, sent, solved', () => {
    renderIntl(<DashboardView data={DATA} />);
    expect(screen.getByTestId('stat-open')).toHaveTextContent('41');
    expect(
      filterOf(screen.getByTestId('stat-open').getAttribute('href')),
    ).toEqual({
      sort: 'newest',
      status: open,
    });
    expect(
      filterOf(screen.getByTestId('stat-sent').getAttribute('href')),
    ).toEqual({
      sort: 'newest',
      status: ['sent'],
    });
    expect(
      filterOf(screen.getByTestId('stat-solved').getAttribute('href')),
    ).toEqual({
      sort: 'newest',
      status: ['solved'],
    });
  });

  it('overdue tile', () => {
    renderIntl(<DashboardView data={DATA} />);
    expect(
      filterOf(screen.getByTestId('stat-overdue').getAttribute('href')),
    ).toEqual({
      sort: 'newest',
      overdue: true,
    });
  });

  it('category bars (open and overdue)', () => {
    renderIntl(<DashboardView data={DATA} />);
    const group = within(screen.getByTestId('bars-category'));
    expect(
      filterOf(
        group
          .getByRole('link', { name: 'Painting: 14 open' })
          .getAttribute('href'),
      ),
    ).toEqual({ sort: 'newest', categoryId: PAINT, status: open });
    expect(
      filterOf(
        group
          .getByRole('link', { name: 'Painting: 2 overdue' })
          .getAttribute('href'),
      ),
    ).toEqual({ sort: 'newest', categoryId: PAINT, overdue: true });
    // No English name: the Arabic one stands in.
    expect(
      group.getByRole('link', { name: 'كهرباء: 9 open' }),
    ).toBeInTheDocument();
  });

  it('worker bars', () => {
    renderIntl(<DashboardView data={DATA} />);
    const group = within(screen.getByTestId('bars-worker'));
    expect(
      filterOf(
        group
          .getByRole('link', { name: 'Sayed: 11 open' })
          .getAttribute('href'),
      ),
    ).toEqual({ sort: 'newest', workerId: SAYED, status: open });
    expect(
      filterOf(
        group
          .getByRole('link', { name: 'Sayed: 3 overdue' })
          .getAttribute('href'),
      ),
    ).toEqual({ sort: 'newest', workerId: SAYED, overdue: true });
  });

  it('site bars', () => {
    renderIntl(<DashboardView data={DATA} />);
    const group = within(screen.getByTestId('bars-site'));
    expect(
      filterOf(
        group
          .getByRole('link', { name: 'Nile Villas: 11 open' })
          .getAttribute('href'),
      ),
    ).toEqual({ sort: 'newest', siteId: SITE_B, status: open });
    expect(
      filterOf(
        group
          .getByRole('link', { name: 'Palm Tower: 6 overdue' })
          .getAttribute('href'),
      ),
    ).toEqual({ sort: 'newest', siteId: SITE_A, overdue: true });
  });

  it('inbox: the count and "start sorting" go to the sort inbox', () => {
    renderIntl(<DashboardView data={DATA} />);
    expect(screen.getByTestId('inbox-count')).toHaveTextContent('23');
    expect(screen.getByRole('link', { name: /Start sorting/ })).toHaveAttribute(
      'href',
      '/inbox',
    );
  });

  it('with a site chosen, every number stays inside that site', () => {
    renderIntl(<DashboardView data={DATA} siteId={SITE_A} />);
    for (const id of ['stat-open', 'stat-overdue', 'stat-sent', 'stat-solved'])
      expect(filterOf(screen.getByTestId(id).getAttribute('href')).siteId).toBe(
        SITE_A,
      );
    const painting = within(screen.getByTestId('bars-category')).getByRole(
      'link',
      {
        name: 'Painting: 14 open',
      },
    );
    expect(filterOf(painting.getAttribute('href'))).toEqual({
      sort: 'newest',
      siteId: SITE_A,
      categoryId: PAINT,
      status: open,
    });
  });
});

describe('dashboard loading', () => {
  afterEach(() => fetchMock.mockReset());

  it('uses the site switcher’s last site, and "show all sites" drops it', async () => {
    window.localStorage.setItem(LAST_SITE_KEY, SITE_A);
    fetchMock.mockResolvedValue({ success: true, status: 200, data: DATA });
    const user = userEvent.setup();
    renderIntl(<DashboardScreen />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/dashboard?siteId=${SITE_A}`),
    );
    expect(
      await screen.findByText('Showing Palm Tower only'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show all sites/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/dashboard'),
    );
  });

  it('no remembered site (or a broken value) loads every site', async () => {
    window.localStorage.setItem(LAST_SITE_KEY, 'garbage');
    fetchMock.mockResolvedValue({ success: true, status: 200, data: DATA });
    renderIntl(<DashboardScreen />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('an error shows a message and retry loads again', async () => {
    fetchMock.mockResolvedValueOnce({
      success: false,
      status: 0,
      error: 'NETWORK_ERROR',
      message: 'x',
    });
    fetchMock.mockResolvedValueOnce({ success: true, status: 200, data: DATA });
    const user = userEvent.setup();
    renderIntl(<DashboardScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load the dashboard.",
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('stat-open')).toHaveTextContent('41');
  });

  it('bars with nothing open say so instead of drawing empty bars', () => {
    renderIntl(<DashboardView data={{ ...DATA, byWorker: [] }} />);
    expect(
      within(screen.getByTestId('bars-worker')).getByText('Nothing open here.'),
    ).toBeInTheDocument();
  });
});
