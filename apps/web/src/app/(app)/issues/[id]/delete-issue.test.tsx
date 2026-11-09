import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi } from '@/test-utils/api-mock';
import { fail, makeIssue, makePhoto, ok } from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { DeleteIssue } from './delete-issue';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const solved = makeIssue({
  number: 14,
  status: 'solved',
  photos: [makePhoto(), makePhoto(), makePhoto({ kind: 'after' })],
});

describe('DeleteIssue (D1)', () => {
  afterEach(() => {
    vi.mocked(clientFetch).mockReset();
    replace.mockReset();
  });

  it('Web: confirm shows number + photo count; cancel → nothing deleted; double tap → one request (§6.8)', async () => {
    let answer: () => void = () => undefined;
    routeApi(clientFetch, {
      'DELETE /issues/': () =>
        new Promise((resolve) => {
          answer = () => resolve(ok({ id: solved.id }));
        }) as never,
    });
    renderWithIntl(<DeleteIssue issue={solved} />);
    const user = userEvent.setup();

    // Offered in any status, here a solved one.
    await user.click(screen.getByRole('button', { name: 'Delete issue' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete issue #14?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "#14 and its 3 photos will be deleted permanently, with its history. This can't be undone.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls(clientFetch, 'DELETE')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Delete issue' }));
    dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', {
      name: 'Delete permanently',
    });
    await user.dblClick(confirm);
    await user.click(confirm);
    expect(calls(clientFetch, 'DELETE').map((c) => c.path)).toEqual([
      `/issues/${solved.id}`,
    ]);
    answer();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/issues'));
  });

  it('a new issue goes back to the inbox; a refusal stays open with the error (§3)', async () => {
    const fresh = makeIssue({ number: 3, status: 'new' });
    routeApi(clientFetch, { 'DELETE /issues/': () => ok({ id: fresh.id }) });
    renderWithIntl(<DeleteIssue issue={fresh} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete issue' }));
    expect(
      screen.getByText(
        "#3 and its 1 photo will be deleted permanently, with its history. This can't be undone.",
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/inbox'));

    replace.mockReset();
    routeApi(clientFetch, {
      'DELETE /issues/': () => fail(404, 'NOT_FOUND'),
    });
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This issue no longer exists.',
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
