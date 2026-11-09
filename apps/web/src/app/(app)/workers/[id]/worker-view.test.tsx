import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue, Worker } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi, type ApiCall } from '@/test-utils/api-mock';
import {
  assignedIssue,
  CAT_PLASTER,
  fail,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { WorkerView } from './worker-view';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const worker = makeWorker({ name: 'Sayed', phone: '+201001234567' });
const issues: Issue[] = [
  assignedIssue(worker, { number: 11 }),
  assignedIssue(worker, { number: 12, status: 'sent' }),
  assignedIssue(worker, { number: 13 }),
  assignedIssue(worker, { number: 14, status: 'solved' }),
];

/** GET /issues as the API answers it: one status, one page of `limit`, with its meta. */
const byStatus = (list: () => Issue[]) => (call: ApiCall) => {
  const q = new URL(call.path, 'http://api.test').searchParams;
  const status = q.get('status');
  const page = Number(q.get('page') ?? 1);
  const limit = Number(q.get('limit') ?? 20);
  const all = list().filter((i) => !status || i.status === status);
  return {
    ...ok(all.slice((page - 1) * limit, page * limit)),
    meta: {
      total: all.length,
      page,
      limit,
      hasNextPage: page * limit < all.length,
      hasPreviousPage: page > 1,
    },
  };
};

function renderView(w: Worker = worker) {
  renderWithIntl(<WorkerView initial={w} />);
  return userEvent.setup();
}

const group = (name: string) => screen.getByRole('region', { name });
const batchButton = () =>
  screen.findByRole('button', {
    name: /Send \d+ assigned issues? on WhatsApp/,
  });

describe('WorkerView', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn();
    vi.stubGlobal('open', open);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(clientFetch).mockReset();
    push.mockReset();
  });

  it("Batch send: only the worker's `assigned` issues are included (§5.5)", async () => {
    routeApi(clientFetch, {
      'GET /issues': byStatus(() => issues),
      'POST /issues/bulk': () => ok({ updated: 2, issues: [] }),
      'GET /workers/': () => ok(worker),
    });
    const user = renderView();

    const send = await batchButton();
    expect(send).toHaveAccessibleName('Send 2 assigned issues on WhatsApp');
    await user.click(send);

    const text =
      new URL(open.mock.calls[0][0] as string).searchParams.get('text') ?? '';
    expect(text).toContain('#11');
    expect(text).toContain('#13');
    expect(text).not.toContain('#12');
    expect(text).not.toContain('#14');
    expect(calls(clientFetch, 'GET', '/issues')[0].path).toContain(
      `workerId=${worker.id}`,
    );
  });

  it('Batch "Mark as sent?" yes → all included issues become sent in one bulk call; no → nothing changes (§5.5)', async () => {
    let current = issues;
    routeApi(clientFetch, {
      'GET /issues': byStatus(() => current),
      'POST /issues/bulk': () => {
        current = current.map((i) =>
          i.status === 'assigned' ? { ...i, status: 'sent' as const } : i,
        );
        return ok({ updated: 2, issues: current });
      },
      'GET /workers/': () => ok(worker),
    });
    const user = renderView();
    const send = await batchButton();

    // "Not yet": nothing is sent, the groups stay as they were.
    await user.click(send);
    await user.click(await screen.findByRole('button', { name: 'Not yet' }));
    expect(calls(clientFetch, 'POST')).toHaveLength(0);
    expect(within(group('Assigned')).getAllByRole('link')).toHaveLength(2);

    // Yes: one bulk call with both assigned issues; they move to Sent.
    await user.click(send);
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(1),
    );
    expect(calls(clientFetch, 'POST')[0].body).toEqual({
      ids: [issues[0].id, issues[2].id],
      status: 'sent',
    });
    await waitFor(() =>
      expect(within(group('Sent')).getAllByRole('link')).toHaveLength(3),
    );
    expect(screen.queryByRole('region', { name: 'Assigned' })).toBeNull();
  });

  it('more than 100 issues: every group and the batch count them all, page after page', async () => {
    const many: Issue[] = [
      ...Array.from({ length: 130 }, (_, i) =>
        assignedIssue(worker, { number: i + 1, status: 'solved' }),
      ),
      ...Array.from({ length: 120 }, (_, i) =>
        assignedIssue(worker, { number: 200 + i }),
      ),
    ];
    routeApi(clientFetch, { 'GET /issues': byStatus(() => many) });
    renderView();

    const send = await batchButton();
    expect(send).toHaveAccessibleName('Send 120 assigned issues on WhatsApp');
    expect(within(group('Solved')).getAllByRole('link')).toHaveLength(130);
    expect(within(group('Assigned')).getAllByRole('link')).toHaveLength(120);
    const gets = calls(clientFetch, 'GET', '/issues').map((c) => c.path);
    expect(gets).toContainEqual(expect.stringMatching(/status=solved.*page=2/));
    expect(gets).toContainEqual(
      expect.stringMatching(/status=assigned.*page=2/),
    );
  });

  it('Deactivated worker: shown with a badge, no batch send, keeps his issues listed (§3)', async () => {
    routeApi(clientFetch, { 'GET /issues': byStatus(() => issues) });
    renderView({ ...worker, active: false });

    expect(await batchButton()).toBeDisabled();
    expect(screen.getByText('This worker is deactivated.')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(within(group('Assigned')).getAllByRole('link')).toHaveLength(2);
    expect(within(group('Sent')).getAllByRole('link')).toHaveLength(1);
    expect(within(group('Solved')).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled();
  });

  it('call and WhatsApp open the worker’s phone', async () => {
    routeApi(clientFetch, { 'GET /issues': () => ok([] as Issue[]) });
    renderView();

    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute(
      'href',
      'tel:+201001234567',
    );
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/201001234567',
    );
    expect(await screen.findByText('No issues yet.')).toBeInTheDocument();
  });

  it('Web: sheet shows counts, both choices; destructive choice needs a second confirm; cancel → nothing (§6.8)', async () => {
    routeApi(clientFetch, {
      'GET /issues': byStatus(() => issues),
      'DELETE /workers/': () => ok({ id: worker.id }),
    });
    const user = renderView();
    await screen.findByRole('region', { name: 'Assigned' });

    // Cancel at the first step sends nothing.
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sayed has issues')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '4 issues: 3 open, 1 solved, 0 cancelled. What happens to them?',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Keep the issues/ }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The destructive choice asks once more; Back and closing send nothing.
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', {
        name: /Delete his 4 issues and 4 photos too/,
      }),
    );
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete everything?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Sayed, his 4 issues and 4 photos will be deleted permanently. This can't be undone.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(
      within(screen.getByRole('dialog')).getByText('Sayed has issues'),
    ).toBeInTheDocument();
    expect(calls(clientFetch, 'DELETE')).toHaveLength(0);

    // Confirmed: one request with issues=delete, then back to the list.
    await user.click(
      screen.getByRole('button', { name: /Delete his 4 issues/ }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/workers'));
    expect(calls(clientFetch, 'DELETE').map((c) => c.path)).toEqual([
      `/workers/${worker.id}?issues=delete`,
    ]);
  });

  it('keep the issues: one tap sends one request with issues=keep, double tap included (§6.8)', async () => {
    let answer: (value: unknown) => void = () => undefined;
    routeApi(clientFetch, {
      'GET /issues': byStatus(() => issues),
      'DELETE /workers/': () =>
        new Promise((resolve) => {
          answer = () => resolve(ok({ id: worker.id }));
        }) as never,
    });
    const user = renderView();
    await screen.findByRole('region', { name: 'Assigned' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const keep = within(screen.getByRole('dialog')).getByRole('button', {
      name: /Keep the issues/,
    });
    await user.dblClick(keep);
    await user.click(keep);
    expect(calls(clientFetch, 'DELETE').map((c) => c.path)).toEqual([
      `/workers/${worker.id}?issues=keep`,
    ]);
    answer(undefined);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/workers'));
  });

  it('plain confirm meeting issues the page did not know (409 WORKER_HAS_ISSUES) turns into the choice with the API counts', async () => {
    const fresh = makeWorker({ name: 'Omar' });
    routeApi(clientFetch, {
      'GET /issues': () => ok([] as Issue[]),
      'DELETE /workers/': () => ({
        ...fail(409, 'WORKER_HAS_ISSUES'),
        data: { open: 1, solved: 0, cancelled: 1, total: 2, photos: 5 },
      }),
    });
    const user = renderView(fresh);
    await screen.findByText('No issues yet.');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    const dialog = await screen.findByTestId('delete-worker-choose');
    expect(
      within(dialog).getByText(
        '2 issues: 1 open, 0 solved, 1 cancelled. What happens to them?',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', {
        name: /Delete his 2 issues and 5 photos too/,
      }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('delete a worker without issues removes him and goes back to the list', async () => {
    const fresh = makeWorker({
      counts: {
        assigned: 0,
        sent: 0,
        estimated: 0,
        in_progress: 0,
        solved: 0,
        cancelled: 0,
        open: 0,
        overdue: 0,
      },
    });
    routeApi(clientFetch, {
      'GET /issues': () => ok([] as Issue[]),
      'DELETE /workers/': () => ok({ id: fresh.id }),
    });
    const user = renderView(fresh);
    await screen.findByText('No issues yet.');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith('/workers'));
    expect(calls(clientFetch, 'DELETE').map((c) => c.path)).toEqual([
      `/workers/${fresh.id}`,
    ]);
  });

  it('edit: saving the sheet shows the new name', async () => {
    routeApi(clientFetch, {
      'GET /issues': () => ok([] as Issue[]),
      'GET /categories': () => ok([CAT_PLASTER]),
      'PATCH /workers/': (call) =>
        ok({ ...worker, ...(call.body as Partial<Worker>) }),
    });
    const user = renderView();
    await screen.findByText('No issues yet.');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/Name/);
    await user.clear(name);
    await user.type(name, 'Am Sayed');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(calls(clientFetch, 'PATCH')[0].body).toMatchObject({
      name: 'Am Sayed',
      phone: '+201001234567',
      categoryIds: [CAT_PLASTER.id],
    });
    expect(screen.getAllByText('Am Sayed').length).toBeGreaterThan(0);
  });

  it('his issues failing to load shows the error with a retry', async () => {
    routeApi(clientFetch, { 'GET /issues': () => fail(500, 'INTERNAL_ERROR') });
    renderView();
    expect(
      await screen.findByText("Couldn't load his issues."),
    ).toBeInTheDocument();
  });
});
