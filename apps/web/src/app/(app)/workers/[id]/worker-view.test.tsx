import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue, Worker } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi } from '@/test-utils/api-mock';
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
      'GET /issues': () => ok(issues),
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
      'GET /issues': () => ok(current),
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

  it('Deactivated worker: shown with a badge, no batch send, keeps his issues listed (§3)', async () => {
    routeApi(clientFetch, { 'GET /issues': () => ok(issues) });
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

  it('delete a worker with issues offers "Deactivate instead" and deletes nothing', async () => {
    routeApi(clientFetch, {
      'GET /issues': () => ok(issues),
      'PATCH /workers/': () => ok({ ...worker, active: false }),
    });
    const user = renderView();
    await screen.findByRole('region', { name: 'Assigned' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('This worker has issues'),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: 'Deactivate instead' }),
    );

    await waitFor(() =>
      expect(calls(clientFetch, 'PATCH')[0]?.body).toEqual({ active: false }),
    );
    expect(calls(clientFetch, 'DELETE')).toHaveLength(0);
    expect(await screen.findByText('Deactivated')).toBeInTheDocument();
  });

  it('delete a worker without issues removes him and goes back to the list', async () => {
    const fresh = makeWorker({
      counts: {
        assigned: 0,
        sent: 0,
        estimated: 0,
        in_progress: 0,
        solved: 0,
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
    expect(calls(clientFetch, 'DELETE', `/workers/${fresh.id}`)).toHaveLength(
      1,
    );
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
