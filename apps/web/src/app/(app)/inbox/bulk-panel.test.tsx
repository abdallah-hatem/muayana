import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi } from '@/test-utils/api-mock';
import { CAT_PLASTER, makeIssue, makePhoto, ok } from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { BulkPanel } from './bulk-panel';
import { mergeCheck } from './merge';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => makePhoto({ sortOrder: i }));

describe('BulkPanel', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('Merge offered only between two `new` issues; >10 photos blocked with message (§5.3)', async () => {
    const older = makeIssue({
      number: 3,
      capturedAt: '2026-11-04T08:00:00.000Z',
      photos: photos(6),
    });
    const newer = makeIssue({
      number: 4,
      capturedAt: '2026-11-04T09:00:00.000Z',
      photos: photos(4),
    });
    const big = makeIssue({ number: 5, photos: photos(5) });
    routeApi(clientFetch, { 'POST /issues/': () => ok(older) });
    const onChanged = vi.fn();
    renderWithIntl(
      <BulkPanel
        issues={[older, newer, big]}
        categories={[CAT_PLASTER]}
        onChanged={onChanged}
      />,
    );
    const user = userEvent.setup();
    const merge = screen.getByRole('button', { name: /Merge two/ });

    // One selected: not offered.
    await user.click(screen.getByRole('checkbox', { name: 'Select #3' }));
    expect(merge).toBeDisabled();

    // 6 + 5 photos: blocked, with the message.
    await user.click(screen.getByRole('checkbox', { name: 'Select #5' }));
    expect(merge).toBeDisabled();
    expect(
      screen.getByText(/more than 10 photos: they can't be merged/),
    ).toBeInTheDocument();

    // Three selected: not offered.
    await user.click(screen.getByRole('checkbox', { name: 'Select #4' }));
    expect(merge).toBeDisabled();

    // 6 + 4: allowed; the older capture keeps the photos.
    await user.click(screen.getByRole('checkbox', { name: 'Select #5' }));
    expect(merge).toBeEnabled();
    await user.click(merge);
    await user.click(await screen.findByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls(clientFetch, 'POST')).toEqual([
      {
        method: 'POST',
        path: `/issues/${older.id}/merge`,
        body: { sourceId: newer.id },
      },
    ]);
  });

  it('mergeCheck refuses an issue that already left `new`', () => {
    const a = makeIssue();
    const b = makeIssue({ status: 'unassigned' });
    expect(mergeCheck([a, b])).toEqual({ ok: false, reason: 'notNew' });
    expect(mergeCheck([a])).toEqual({ ok: false, reason: 'count' });
  });

  it('bulk category: one call with every selected id and the category; they stay in the inbox', async () => {
    const a = makeIssue({ number: 1 });
    const b = makeIssue({ number: 2 });
    routeApi(clientFetch, {
      'POST /issues/bulk': () => ok({ updated: 2, issues: [a, b] }),
    });
    const onChanged = vi.fn();
    renderWithIntl(
      <BulkPanel
        issues={[a, b]}
        categories={[CAT_PLASTER]}
        onChanged={onChanged}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Select #1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select #2' }));
    await user.click(screen.getByRole('button', { name: 'Category' }));
    await user.click(await screen.findByRole('button', { name: 'Plastering' }));
    await user.click(screen.getByRole('button', { name: 'Set category (2)' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls(clientFetch, 'POST')[0].body).toEqual({
      ids: [a.id, b.id],
      categoryId: CAT_PLASTER.id,
    });
  });
});
