import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteProvider } from '@/components/site/site-context';
import { clientFetch } from '@/lib/api-client';
import { LAST_SITE_KEY } from '@/lib/last-site';
import { calls, routeApi } from '@/test-utils/api-mock';
import { CAT_PLASTER, fail, makeIssue, ok } from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { InboxScreen } from './inbox-screen';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const SITE = '00000000-0000-4000-8000-000000000801';

function renderInbox() {
  renderWithIntl(
    <SiteProvider>
      <InboxScreen />
    </SiteProvider>,
  );
  return userEvent.setup();
}

describe('InboxScreen', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it("asks for the chosen site's `new` issues, oldest first, and sorts them one at a time", async () => {
    window.localStorage.setItem(LAST_SITE_KEY, SITE);
    const first = makeIssue({ number: 7 });
    const second = makeIssue({ number: 8 });
    routeApi(clientFetch, {
      'GET /issues': () => ok([first, second]),
      'GET /categories': () => ok([CAT_PLASTER]),
      'GET /workers': () => ok([]),
      'PATCH /issues/': () => ok({ ...first, status: 'unassigned' }),
    });
    const user = renderInbox();

    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    const query = new URLSearchParams(
      calls(clientFetch, 'GET', '/issues')[0].path.split('?')[1],
    );
    expect(Object.fromEntries(query)).toMatchObject({
      status: 'new',
      sort: 'oldest',
      siteId: SITE,
    });

    await user.click(screen.getByRole('button', { name: 'Plastering' }));
    await user.type(screen.getByLabelText(/Description/), 'Wall crack');
    await user.click(screen.getByRole('button', { name: /Save & next/ }));

    expect(await screen.findByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: '#8' })).toBeInTheDocument();
  });

  it('skip moves on without saving; an empty inbox says so', async () => {
    routeApi(clientFetch, {
      'GET /issues': () =>
        ok([makeIssue({ number: 1 }), makeIssue({ number: 2 })]),
      'GET /categories': () => ok([CAT_PLASTER]),
    });
    const user = renderInbox();
    await screen.findByRole('form', { name: '#1' });
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByRole('form', { name: '#2' })).toBeInTheDocument();
    expect(calls(clientFetch, 'PATCH')).toHaveLength(0);
  });

  it('shows the empty state when nothing is left to sort', async () => {
    routeApi(clientFetch, {
      'GET /issues': () => ok([]),
      'GET /categories': () => ok([CAT_PLASTER]),
    });
    renderInbox();
    expect(await screen.findByText('Inbox is clear')).toBeInTheDocument();
  });

  it('a failed load shows the error and retries', async () => {
    let attempt = 0;
    routeApi(clientFetch, {
      'GET /issues': () =>
        ++attempt === 1 ? fail(0, 'NETWORK_ERROR') : ok([]),
      'GET /categories': () => ok([CAT_PLASTER]),
    });
    const user = renderInbox();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The inbox couldn't be loaded.",
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByText('Inbox is clear')).toBeInTheDocument(),
    );
  });
});
