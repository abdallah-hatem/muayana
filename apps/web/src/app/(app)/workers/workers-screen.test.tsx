import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worker } from '@muayana/shared';
import { clientFetch, clientFetchRaw } from '@/lib/api-client';
import { calls, routeApi } from '@/test-utils/api-mock';
import {
  CAT_ELECTRIC,
  CAT_PLASTER,
  fail,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { WorkersScreen } from './workers-screen';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

const sayed = makeWorker({
  name: 'Sayed',
  phone: '+201001234567',
  categories: [CAT_PLASTER],
  counts: {
    assigned: 3,
    sent: 0,
    estimated: 0,
    in_progress: 2,
    solved: 9,
    open: 5,
    overdue: 1,
  },
});

function renderWorkers(workers: Worker[] = [sayed]) {
  routeApi(clientFetch, {
    'GET /categories': () => ok([CAT_PLASTER, CAT_ELECTRIC]),
    'GET /workers': () => ok(workers),
  });
  renderWithIntl(<WorkersScreen />);
  return userEvent.setup();
}

const workerCalls = () => calls(clientFetch, 'GET', '/workers');
const lastQuery = () =>
  new URLSearchParams(workerCalls().at(-1)!.path.split('?')[1]);

describe('WorkersScreen', () => {
  afterEach(() => {
    vi.mocked(clientFetch).mockReset();
    vi.mocked(clientFetchRaw).mockReset();
  });

  it('empty state: no workers yet, with the way to add one', async () => {
    renderWorkers([]);
    expect(await screen.findByText('No workers yet')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'New worker' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/workers/new',
      '/workers/new',
    ]);
  });

  it('a card shows the open issues by status, the overdue count and WhatsApp', async () => {
    renderWorkers();
    const card = (await screen.findAllByTestId('worker-card'))[0];

    expect(within(card).getByText('Assigned 3')).toBeInTheDocument();
    expect(within(card).getByText('In progress 2')).toBeInTheDocument();
    expect(within(card).getByText('Overdue 1')).toBeInTheDocument();
    expect(within(card).queryByText(/Sent/)).toBeNull();
    expect(
      within(card).getByRole('link', { name: 'WhatsApp Sayed' }),
    ).toHaveAttribute('href', 'https://wa.me/201001234567');
    expect(within(card).getByRole('link', { name: 'Sayed' })).toHaveAttribute(
      'href',
      `/workers/${sayed.id}`,
    );
  });

  it('search, category chip and the deactivated tab re-query the list', async () => {
    const user = renderWorkers();
    await screen.findAllByTestId('worker-card');
    expect(lastQuery().get('active')).toBe('true');

    await user.type(screen.getByRole('searchbox'), 'say');
    await waitFor(() => expect(lastQuery().get('search')).toBe('say'));

    await user.click(await screen.findByRole('button', { name: 'Electrical' }));
    await waitFor(() =>
      expect(lastQuery().get('categoryId')).toBe(CAT_ELECTRIC.id),
    );

    await user.click(screen.getByRole('tab', { name: 'Deactivated' }));
    await waitFor(() => expect(lastQuery().get('active')).toBe('false'));
    expect(lastQuery().get('page')).toBe('1');
  });

  it('a filter with no match says so instead of "no workers yet"', async () => {
    const user = renderWorkers([]);
    await screen.findByText('No workers yet');
    await user.click(await screen.findByRole('button', { name: 'Plastering' }));
    expect(await screen.findByText('No workers match')).toBeInTheDocument();
  });

  it('Export CSV downloads the same filter in the UI language', async () => {
    const createObjectURL = vi.fn(() => 'blob:workers');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.mocked(clientFetchRaw).mockResolvedValue(
      new Response('﻿name\nSayed', {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition':
            'attachment; filename="workers-2026-11-05.csv"',
        },
      }),
    );
    const user = renderWorkers();
    await screen.findAllByTestId('worker-card');
    await user.click(screen.getByRole('button', { name: 'Plastering' }));
    await waitFor(() =>
      expect(lastQuery().get('categoryId')).toBe(CAT_PLASTER.id),
    );

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const path = vi.mocked(clientFetchRaw).mock.calls[0][0];
    const query = new URLSearchParams(path.split('?')[1]);
    expect(path.startsWith('/workers/export.csv?')).toBe(true);
    expect(query.get('categoryId')).toBe(CAT_PLASTER.id);
    expect(query.get('active')).toBe('true');
    expect(query.get('lang')).toBe('en');
    expect(query.has('page')).toBe(false);
    click.mockRestore();
  });

  it('the list failing to load shows the error with a retry', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([]),
      'GET /workers': () => fail(0, 'NETWORK_ERROR'),
    });
    renderWithIntl(<WorkersScreen />);
    expect(
      await screen.findByText("Couldn't load the workers."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('WorkersScreen pagination', () => {
  beforeEach(() => {
    vi.mocked(clientFetch).mockReset();
  });

  it('the pager is shown even when everything fits on one page', async () => {
    renderWorkers();
    await screen.findAllByTestId('worker-card');
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
