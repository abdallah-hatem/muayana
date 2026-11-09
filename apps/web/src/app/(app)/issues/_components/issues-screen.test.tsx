import type { Issue } from '@muayana/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { searchParamsToFilter } from '@/lib/issue-filter-url';
import { renderIntl } from '@/test-utils/render-intl';
import { IssuesScreen } from './issues-screen';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.push }),
  usePathname: () => '/issues',
  useSearchParams: () => nav.params,
}));
vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));
const fetchMock = vi.mocked(clientFetch);

const SITE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function issue(n: number, patch: Partial<Issue> = {}): Issue {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    siteId: SITE,
    site: { id: SITE, name: 'Palm Tower' },
    number: n,
    status: 'sent',
    priority: 'normal',
    description: `Crack near window ${n}`,
    location: '3rd floor',
    category: null,
    worker: {
      id: '6fa459ea-ee8a-4ca4-894e-db77e160355e',
      name: 'Sayed',
      phone: '01012345678',
    },
    formerWorkerName: null,
    estimatedDate: null,
    capturedAt: '2026-11-01T08:00:00Z',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    assignedAt: null,
    sentAt: null,
    solvedAt: null,
    overdue: false,
    photos: [],
    ...patch,
  };
}

/** Answers list requests with `pages` (by page number); other lists come back empty. */
function serve(pages: Issue[][], total = pages.flat().length) {
  fetchMock.mockImplementation(async (path: string) => {
    if (!path.startsWith('/issues?'))
      return { success: true, status: 200, data: [] };
    const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
    return {
      success: true,
      status: 200,
      data: pages[page - 1] ?? [],
      meta: {
        total,
        page,
        limit: 24,
        hasNextPage: page < pages.length,
        hasPreviousPage: page > 1,
      },
    };
  });
}

const listCalls = () =>
  fetchMock.mock.calls.map(([p]) => p).filter((p) => p.startsWith('/issues?'));

/** The URL the screen pushed last, read back as a filter. */
const pushedFilter = () => {
  const href = nav.push.mock.calls.at(-1)?.[0] as string;
  return searchParamsToFilter(new URLSearchParams(href.split('?')[1] ?? ''));
};

describe('IssuesScreen', () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
    nav.push.mockReset();
  });
  afterEach(() => fetchMock.mockReset());

  it('filters survive reload: the list requests exactly the filter in the URL and shows its chips', async () => {
    nav.params = new URLSearchParams(
      `siteId=${SITE}&status=sent,estimated&overdue=true&sort=oldest`,
    );
    serve([[issue(38)]]);
    renderIntl(<IssuesScreen />);
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    const sent = new URLSearchParams(listCalls()[0].split('?')[1]);
    expect(searchParamsToFilter(sent)).toEqual({
      siteId: SITE,
      status: ['sent', 'estimated'],
      overdue: true,
      sort: 'oldest',
    });
    expect(sent.get('page')).toBe('1');
    const chips = screen
      .getAllByTestId('filter-chip')
      .map((c) => c.textContent);
    expect(chips).toEqual(['Unknown', 'Sent', 'Estimated', 'Overdue']);
  });

  it('empty filter result state offers to clear the filter', async () => {
    nav.params = new URLSearchParams('status=solved&q=nothing');
    serve([[]], 0);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    const empty = await screen.findByTestId('issues-empty');
    expect(empty).toHaveTextContent('Nothing matches this filter');
    await user.click(within(empty).getByRole('button', { name: 'Clear all' }));
    expect(nav.push).toHaveBeenCalledWith('/issues', { scroll: false });
  });

  it('no issues at all shows the first-use empty state, without "clear all"', async () => {
    serve([[]], 0);
    renderIntl(<IssuesScreen />);
    const empty = await screen.findByTestId('issues-empty');
    expect(empty).toHaveTextContent('Captured issues show up here');
    expect(within(empty).queryByRole('button')).toBeNull();
  });

  it('clear all removes every filter but keeps the sort, without scrolling', async () => {
    nav.params = new URLSearchParams(
      `siteId=${SITE}&priority=urgent&capturedFrom=2026-10-01&sort=priority`,
    );
    serve([[issue(1)]]);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    await screen.findAllByTestId('issue-card');
    const chips = screen.getByRole('group', { name: 'Active filters' });
    await user.click(within(chips).getByRole('button', { name: 'Clear all' }));
    expect(nav.push).toHaveBeenLastCalledWith('/issues?sort=priority', {
      scroll: false,
    });
  });

  it('removing one chip drops only that value', async () => {
    nav.params = new URLSearchParams('status=sent,estimated&priority=urgent');
    serve([[issue(1)]]);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    await screen.findAllByTestId('issue-card');
    await user.click(
      screen.getByRole('button', { name: 'Remove filter: Sent' }),
    );
    expect(pushedFilter()).toEqual({
      status: ['estimated'],
      priority: ['urgent'],
      sort: 'newest',
    });
  });

  it('a status picked in the side panel goes into the URL', async () => {
    serve([[issue(1)]]);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    await screen.findAllByTestId('issue-card');
    const panel = within(screen.getByTestId('filter-panel'));
    await user.click(panel.getByRole('button', { name: 'In progress' }));
    expect(pushedFilter()).toEqual({ status: ['in_progress'], sort: 'newest' });
  });

  it('search is written to the URL after typing stops', async () => {
    serve([[issue(1)]]);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    await screen.findAllByTestId('issue-card');
    await user.type(screen.getByLabelText('Search issues'), 'crack');
    await waitFor(() =>
      expect(pushedFilter()).toEqual({ q: 'crack', sort: 'newest' }),
    );
    expect(nav.push).toHaveBeenCalledTimes(1);
  });

  it('the phone sheet applies its draft only on "show results"', async () => {
    serve([[issue(1)]]);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    await screen.findAllByTestId('issue-card');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const sheet = within(await screen.findByRole('dialog'));
    await user.click(sheet.getByRole('button', { name: 'Urgent' }));
    await user.click(sheet.getByRole('switch', { name: 'Overdue only' }));
    expect(nav.push).not.toHaveBeenCalled();
    await user.click(sheet.getByRole('button', { name: 'Show results' }));
    expect(pushedFilter()).toEqual({
      priority: ['urgent'],
      overdue: true,
      sort: 'newest',
    });
  });

  it('infinite scroll: "load more" appends the next page of the same filter', async () => {
    nav.params = new URLSearchParams('status=sent');
    serve([[issue(1), issue(2)], [issue(3)]]);
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    expect(await screen.findAllByTestId('issue-card')).toHaveLength(2);
    expect(screen.getByTestId('issues-count')).toHaveTextContent('3 issues');
    await user.click(screen.getByTestId('load-more'));
    await waitFor(() =>
      expect(screen.getAllByTestId('issue-card')).toHaveLength(3),
    );
    const second = new URLSearchParams(listCalls()[1].split('?')[1]);
    expect(second.get('page')).toBe('2');
    expect(second.get('status')).toBe('sent');
    expect(screen.queryByTestId('load-more')).toBeNull();
  });

  it('the sentinel loads the next page when it scrolls into view', async () => {
    let fire: (() => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          fire = () =>
            cb(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as never,
            );
        }
        observe() {}
        disconnect() {}
      },
    );
    serve([[issue(1)], [issue(2)]]);
    renderIntl(<IssuesScreen />);
    await screen.findAllByTestId('issue-card');
    act(() => fire?.());
    await waitFor(() =>
      expect(screen.getAllByTestId('issue-card')).toHaveLength(2),
    );
    vi.unstubAllGlobals();
  });

  it('a failed load shows an error and retry loads again', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path.startsWith('/issues?')
        ? { success: false, status: 500, message: 'x' }
        : { success: true, status: 200, data: [] },
    );
    const user = userEvent.setup();
    renderIntl(<IssuesScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load the issues.",
    );
    serve([[issue(7)]]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('issue-card')).toHaveLength(1);
  });

  it('a long unbroken description and RTL render without losing the card', async () => {
    serve([[issue(1, { description: 'x'.repeat(220) })]]);
    renderIntl(<IssuesScreen />, 'ar');
    const card = (await screen.findAllByTestId('issue-card'))[0];
    expect(card).toHaveAccessibleName('فتح الملاحظة #1');
    expect(card).toHaveTextContent('x'.repeat(220));
  });
});
