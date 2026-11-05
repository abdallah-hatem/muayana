import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import { calls, deferred, routeApi } from '@/test-utils/api-mock';
import {
  assignedIssue,
  makeWorker,
  ok,
  withHistory,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { IssueView } from './issue-view';
import { StatusActions } from './status-actions';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const worker = makeWorker();

function renderActions(issue: Issue, onChanged = vi.fn()) {
  renderWithIntl(<StatusActions issue={issue} onChanged={onChanged} />);
  return { onChanged, user: userEvent.setup() };
}

const statusReturning = (issue: Issue) => (call: { body: unknown }) =>
  ok({ ...issue, status: (call.body as { status: Issue['status'] }).status });

describe('StatusActions', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('Status actions not allowed by `canMove` are disabled with the reason (§4)', () => {
    // Sorted, no worker yet: every move that needs a worker is refused.
    renderActions(
      assignedIssue(worker, { status: 'unassigned', worker: null }),
    );

    for (const name of [
      'Mark assigned',
      'Mark sent',
      'Mark in progress',
      'Mark solved',
    ]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription('Needs a worker.');
    }
    expect(screen.getByRole('button', { name: 'Cancel issue' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /Set the worker's date/ }),
    ).toBeDisabled();
  });

  it('the current status is disabled with its reason, and a worker blocks nothing he satisfies', () => {
    renderActions(assignedIssue(worker));
    const current = screen.getByRole('button', { name: 'Mark assigned' });
    expect(current).toBeDisabled();
    expect(current).toHaveAccessibleDescription(
      'It is already in this status.',
    );
    expect(screen.getByRole('button', { name: 'Mark sent' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Mark in progress' }),
    ).toBeEnabled();
  });

  it('double tap on a status → one change (§6.7)', async () => {
    const issue = assignedIssue(worker);
    const pending = deferred<ApiResult<Issue>>();
    routeApi(clientFetch, { 'POST /issues/': () => pending.promise });
    const { onChanged } = renderActions(issue);

    const button = screen.getByRole('button', { name: 'Mark in progress' });
    fireEvent.click(button);
    fireEvent.click(button);
    pending.resolve(ok({ ...issue, status: 'in_progress' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls(clientFetch, 'POST')).toEqual([
      {
        method: 'POST',
        path: `/issues/${issue.id}/status`,
        body: { status: 'in_progress' },
      },
    ]);
  });

  it('Solve with after-photos uploads them as `after`; cancel reason / solve note sent as the status note (§5.6)', async () => {
    const issue = assignedIssue(worker, { status: 'in_progress' });
    routeApi(clientFetch, {
      'POST /issues/': (call) =>
        call.path.endsWith('/photos')
          ? ok(issue)
          : statusReturning(issue)(call),
    });
    const { user, onChanged } = renderActions(issue);

    // Solve: an after photo and a note.
    await user.click(screen.getByRole('button', { name: 'Mark solved' }));
    const solve = await screen.findByRole('dialog');
    await user.type(within(solve).getByLabelText('Note'), 'Plastered');
    const fix = new File(['img'], 'fix.jpg', { type: 'image/jpeg' });
    await user.upload(within(solve).getByLabelText('After photos'), fix);
    expect(within(solve).getByText('fix.jpg')).toBeInTheDocument();
    await user.click(
      within(solve).getByRole('button', { name: 'Mark solved' }),
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    const [upload, solved] = calls(clientFetch, 'POST');
    expect(upload.path).toBe(`/issues/${issue.id}/photos`);
    const form = upload.body as FormData;
    expect(form.get('kind')).toBe('after');
    expect((form.get('photo') as File).name).toBe('fix.jpg');
    expect(solved).toEqual({
      method: 'POST',
      path: `/issues/${issue.id}/status`,
      body: { status: 'solved', note: 'Plastered' },
    });

    // Cancel: the reason is required, then sent as the note.
    await user.click(screen.getByRole('button', { name: 'Cancel issue' }));
    const cancel = await screen.findByRole('dialog');
    await user.click(
      within(cancel).getByRole('button', { name: 'Cancel issue' }),
    );
    expect(within(cancel).getByText('Write the reason.')).toBeInTheDocument();
    expect(calls(clientFetch, 'POST')).toHaveLength(2);

    await user.type(
      within(cancel).getByLabelText(/Reason/),
      'Duplicate of #12',
    );
    await user.click(
      within(cancel).getByRole('button', { name: 'Cancel issue' }),
    );
    await waitFor(() => expect(calls(clientFetch, 'POST')).toHaveLength(3));
    expect(calls(clientFetch, 'POST')[2].body).toEqual({
      status: 'cancelled',
      note: 'Duplicate of #12',
    });
  });

  it('reopen of a solved issue goes back to assigned when it has a worker (§4)', async () => {
    const issue = assignedIssue(worker, { status: 'solved' });
    routeApi(clientFetch, { 'POST /issues/': statusReturning(issue) });
    const { user, onChanged } = renderActions(issue);

    await user.click(screen.getByRole('button', { name: 'Reopen (Assigned)' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls(clientFetch, 'POST')[0].body).toEqual({ status: 'assigned' });
  });
});

describe('IssueView', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('Estimate date picker on assigned/sent → issue shows estimated (§4)', async () => {
    const issue = assignedIssue(worker, { status: 'sent' });
    let saved: Issue = issue;
    routeApi(clientFetch, {
      'PATCH /issues/': (call) => {
        const { estimatedDate } = call.body as { estimatedDate: string };
        saved = { ...issue, status: 'estimated', estimatedDate };
        return ok(saved);
      },
      'GET /issues/': () => ok(withHistory(saved)),
    });
    const { container } = renderWithIntl(
      <IssueView initial={withHistory(issue)} />,
    );
    const user = userEvent.setup();
    expect(container.querySelector('[data-status="sent"]')).not.toBeNull();

    await user.click(
      screen.getByRole('button', { name: /Set the worker's date/ }),
    );
    const grid = await screen.findByRole('grid');
    const days = within(grid)
      .getAllByRole('button')
      .filter((b) => !b.hasAttribute('disabled'));
    await user.click(days[days.length - 1]);

    await waitFor(() =>
      expect(
        container.querySelector('[data-status="estimated"]'),
      ).not.toBeNull(),
    );
    const [patch] = calls(clientFetch, 'PATCH');
    expect(patch.path).toBe(`/issues/${issue.id}`);
    expect(patch.body).toEqual({
      estimatedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
