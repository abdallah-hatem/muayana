import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Site } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import { calls, deferred, routeApi } from '@/test-utils/api-mock';
import { fail, makeSite, ok } from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { SitesScreen } from './sites-screen';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

function renderSites() {
  renderWithIntl(<SitesScreen />);
  return userEvent.setup();
}

const dialog = () => screen.getByRole('dialog');

describe('SitesScreen', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('empty states: no sites yet, and no archived sites', async () => {
    routeApi(clientFetch, { 'GET /sites': () => ok([] as Site[]) });
    const user = renderSites();

    expect(await screen.findByText('No sites yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Archived' }));
    expect(await screen.findByText('No archived sites')).toBeInTheDocument();
    expect(calls(clientFetch, 'GET', '/sites?archived=true')).toHaveLength(1);
  });

  it('duplicate name → the error is shown inline on the name field', async () => {
    routeApi(clientFetch, {
      'GET /sites': () => ok([makeSite({ name: 'Palm Tower' })]),
      'POST /sites': () => fail(409, 'DUPLICATE'),
    });
    const user = renderSites();
    await screen.findByText('Palm Tower');

    await user.click(screen.getAllByRole('button', { name: 'New site' })[0]);
    await user.type(within(dialog()).getByLabelText(/Name/), 'Palm Tower');
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));

    const name = within(dialog()).getByLabelText(/Name/);
    expect(
      await within(dialog()).findByText('Another site already has this name.'),
    ).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
  });

  it('a blank name is refused inline and nothing is sent', async () => {
    routeApi(clientFetch, { 'GET /sites': () => ok([] as Site[]) });
    const user = renderSites();
    await screen.findByText('No sites yet');

    await user.click(screen.getAllByRole('button', { name: 'New site' })[0]);
    await user.type(within(dialog()).getByLabelText(/Name/), '   ');
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      within(dialog()).getByText("Enter the site's name."),
    ).toBeInTheDocument();
    expect(calls(clientFetch, 'POST')).toHaveLength(0);
  });

  it('double submit blocked: two taps on Save send one request', async () => {
    const pending = deferred<ApiResult<Site>>();
    routeApi(clientFetch, {
      'GET /sites': () => ok([] as Site[]),
      'POST /sites': () => pending.promise,
    });
    const user = renderSites();
    await screen.findByText('No sites yet');

    await user.click(screen.getAllByRole('button', { name: 'New site' })[0]);
    await user.type(within(dialog()).getByLabelText(/Name/), 'Nile View');
    const save = within(dialog()).getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.click(save);

    expect(calls(clientFetch, 'POST', '/sites')).toHaveLength(1);
    expect(
      within(dialog()).getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    pending.resolve(ok(makeSite({ name: 'Nile View' })));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(calls(clientFetch, 'POST', '/sites')[0].body).toEqual({
      name: 'Nile View',
    });
  });

  it('delete on a site with issues shows "Archive instead", which archives it and deletes nothing', async () => {
    const site = makeSite({
      name: 'Palm Tower',
      counts: { open: 2, new: 0, overdue: 0, total: 5 },
    });
    routeApi(clientFetch, {
      'GET /sites': () => ok([site]),
      'PATCH /sites/': () => ok({ ...site, archived: true }),
    });
    const user = renderSites();
    await screen.findByText('Palm Tower');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      within(dialog()).getByText('This site has issues'),
    ).toBeInTheDocument();
    expect(
      within(dialog()).queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    await user.click(
      within(dialog()).getByRole('button', { name: 'Archive instead' }),
    );

    await waitFor(() =>
      expect(calls(clientFetch, 'PATCH', `/sites/${site.id}`)).toHaveLength(1),
    );
    expect(calls(clientFetch, 'PATCH')[0].body).toEqual({ archived: true });
    expect(calls(clientFetch, 'DELETE')).toHaveLength(0);
  });

  it('delete refused by the API as in use (409) switches to "Archive instead"', async () => {
    const site = makeSite({
      name: 'Palm Tower',
      counts: { open: 0, new: 0, overdue: 0, total: 0 },
    });
    routeApi(clientFetch, {
      'GET /sites': () => ok([site]),
      'DELETE /sites/': () => fail(409, 'IN_USE'),
    });
    const user = renderSites();
    await screen.findByText('Palm Tower');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog()).findByRole('button', { name: 'Archive instead' }),
    ).toBeInTheDocument();
  });

  it('archive / restore send the archived flag and reload the list', async () => {
    const site = makeSite({ name: 'Palm Tower' });
    routeApi(clientFetch, {
      'GET /sites': () => ok([site]),
      'PATCH /sites/': () => ok({ ...site, archived: true }),
    });
    const user = renderSites();
    await screen.findByText('Palm Tower');

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(calls(clientFetch, 'GET', '/sites')).toHaveLength(2),
    );
    expect(calls(clientFetch, 'PATCH')[0].body).toEqual({ archived: true });
  });
});
