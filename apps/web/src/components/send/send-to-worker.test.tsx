import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkIssuesRequest, Issue } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import { calls, deferred, routeApi } from '@/test-utils/api-mock';
import {
  assignedIssue,
  makePhoto,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { BatchSendToWorker, SendToWorker } from './send-to-worker';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const worker = makeWorker({ name: 'Sayed', phone: '+201001234567' });
const photo = makePhoto({ url: 'https://blob.test/photos/crack.jpg' });

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** Gives the browser (or takes away) Web Share with files. */
function webShare(share: ((data: ShareData) => Promise<void>) | null) {
  const nav = navigator as unknown as ShareNavigator;
  if (share) {
    nav.share = vi.fn(share);
    nav.canShare = vi.fn(() => true);
  } else {
    delete nav.share;
    delete nav.canShare;
  }
  return nav;
}

function renderSend(issue: Issue, onSent = vi.fn()) {
  renderWithIntl(<SendToWorker issue={issue} onSent={onSent} />);
  return { onSent, user: userEvent.setup() };
}

const sendButton = () =>
  screen.getByRole('button', { name: /Send on WhatsApp/ });

/** The first tap only downloads the photos (§5.5); once ready, the same button shares. */
async function prepare(
  user: ReturnType<typeof userEvent.setup>,
  ready: RegExp = /Send on WhatsApp/,
) {
  await user.click(
    screen.getByRole('button', { name: /^Prepare \d+ photos? to send$/ }),
  );
  return screen.findByRole('button', { name: ready });
}

describe('SendToWorker', () => {
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    open = vi.fn();
    vi.stubGlobal('open', open);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['x'], { type: 'image/jpeg' }))),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    webShare(null);
    vi.mocked(clientFetch).mockReset();
  });

  it('"Mark as sent?" answered no / share cancelled → status unchanged, no request (§5.5)', async () => {
    const issue = assignedIssue(worker, { photos: [photo] });

    // Share sheet closed without sending: no question, no request.
    webShare(() =>
      Promise.reject(new DOMException('Share canceled', 'AbortError')),
    );
    const first = renderSend(issue);
    await first.user.click(await prepare(first.user));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(screen.queryByText('Mark as sent?')).not.toBeInTheDocument();

    // Shared, then "Not yet": the sheet closes and nothing is sent.
    webShare(() => Promise.resolve());
    await first.user.click(sendButton());
    await first.user.click(
      await screen.findByRole('button', { name: 'Not yet' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Mark as sent?')).not.toBeInTheDocument(),
    );

    expect(clientFetch).not.toHaveBeenCalled();
    expect(first.onSent).not.toHaveBeenCalled();
  });

  it('Yes → exactly one status request even on double tap (§6.7)', async () => {
    const issue = assignedIssue(worker, { photos: [photo] });
    const pending = deferred<ApiResult<Issue>>();
    routeApi(clientFetch, { 'POST /issues/': () => pending.promise });
    webShare(null);
    const { user, onSent } = renderSend(issue);

    await user.click(sendButton());
    const yes = await screen.findByRole('button', { name: 'Yes, mark sent' });
    fireEvent.click(yes);
    fireEvent.click(yes);
    pending.resolve(ok({ ...issue, status: 'sent' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    const posts = calls(clientFetch, 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      method: 'POST',
      path: `/issues/${issue.id}/status`,
      body: { status: 'sent' },
    });
  });

  it('Web Share with files unavailable → wa.me link opened with photo links (§5.5)', async () => {
    const issue = assignedIssue(worker, { number: 38, photos: [photo] });
    webShare(null);
    const { user } = renderSend(issue);

    await user.click(sendButton());

    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/201001234567');
    const text = url.searchParams.get('text') ?? '';
    expect(text).toContain('#38');
    expect(text).toContain('https://blob.test/photos/crack.jpg');
    expect(await screen.findByText('Mark as sent?')).toBeInTheDocument();
  });

  it('with Web Share files available, the photos go to the share sheet as files', async () => {
    const issue = assignedIssue(worker, { photos: [photo] });
    const nav = webShare(() => Promise.resolve());
    const { user } = renderSend(issue);

    await user.click(await prepare(user));

    await waitFor(() => expect(nav.share).toHaveBeenCalledTimes(1));
    const data = vi.mocked(nav.share!).mock.calls[0][0];
    expect(data.files).toHaveLength(1);
    expect(data.text).toContain('#38');
    expect(open).not.toHaveBeenCalled();
  });

  it('an issue without a worker cannot be sent', () => {
    renderSend(assignedIssue(worker, { status: 'unassigned', worker: null }));
    expect(sendButton()).toBeDisabled();
    expect(
      screen.getByText('Choose a worker to send it to.'),
    ).toBeInTheDocument();
  });
});

describe('BatchSendToWorker', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn();
    vi.stubGlobal('open', open);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(clientFetch).mockReset();
  });

  const issues = [
    assignedIssue(worker, { number: 11 }),
    assignedIssue(worker, { number: 12, status: 'sent' }),
    assignedIssue(worker, { number: 13 }),
    assignedIssue(worker, { number: 14, status: 'in_progress' }),
  ];

  it("Batch send: only the worker's `assigned` issues are included (§5.5)", async () => {
    routeApi(clientFetch, {
      'POST /issues/bulk': () => ok({ updated: 2, issues: [] }),
    });
    renderWithIntl(
      <BatchSendToWorker worker={worker} issues={issues} onSent={vi.fn()} />,
    );
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /Send 2 assigned issues/ }),
    );

    const text =
      new URL(open.mock.calls[0][0] as string).searchParams.get('text') ?? '';
    expect(text).toContain('#11');
    expect(text).toContain('#13');
    expect(text).not.toContain('#12');
    expect(text).not.toContain('#14');

    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() => expect(calls(clientFetch, 'POST')).toHaveLength(1));
    expect(calls(clientFetch, 'POST')[0].body).toEqual({
      ids: [issues[0].id, issues[2].id],
      status: 'sent',
    });
  });

  it('Batch "Mark as sent?" yes → all included issues become sent in one bulk call; no → nothing changes (§5.5)', async () => {
    const sentIssues = [issues[0], issues[2]].map((i) => ({
      ...i,
      status: 'sent' as const,
    }));
    routeApi(clientFetch, {
      'POST /issues/bulk': () => ok({ updated: 2, issues: sentIssues }),
    });
    const onSent = vi.fn();
    renderWithIntl(
      <BatchSendToWorker worker={worker} issues={issues} onSent={onSent} />,
    );
    const user = userEvent.setup();
    const send = screen.getByRole('button', { name: /Send 2 assigned issues/ });

    await user.click(send);
    await user.click(await screen.findByRole('button', { name: 'Not yet' }));
    expect(clientFetch).not.toHaveBeenCalled();

    await user.click(send);
    const yes = await screen.findByRole('button', { name: 'Yes, mark sent' });
    fireEvent.click(yes);
    fireEvent.click(yes);
    await waitFor(() => expect(onSent).toHaveBeenCalledWith(sentIssues));
    expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(1);
  });

  /** The page around the button: a yes moves the sent issues out of `assigned`. */
  function BatchPage({ initial }: { initial: Issue[] }) {
    const [list, setList] = useState(initial);
    return (
      <BatchSendToWorker
        worker={worker}
        issues={list}
        onSent={(sent) => {
          const ids = new Set(sent.map((i) => i.id));
          setList((l) =>
            l.map((i) => (ids.has(i.id) ? { ...i, status: 'sent' } : i)),
          );
        }}
      />
    );
  }

  /** The issue numbers a wa.me message carries. */
  const numbersIn = (call: unknown[]) =>
    new Set(
      [
        ...(new URL(call[0] as string).searchParams.get('text') ?? '').matchAll(
          /#(\d+)/g,
        ),
      ].map((m) => Number(m[1])),
    );

  it('230 assigned issues → two batches, 200 then 30: one message and one bulk call each (§5.5)', async () => {
    const many = Array.from({ length: 230 }, (_, i) =>
      assignedIssue(worker, { number: i + 1 }),
    );
    routeApi(clientFetch, {
      'POST /issues/bulk': (call) => {
        const { ids } = call.body as BulkIssuesRequest;
        const sent = many
          .filter((i) => ids.includes(i.id))
          .map((i) => ({ ...i, status: 'sent' as const }));
        return ok({ updated: sent.length, issues: sent });
      },
    });
    renderWithIntl(<BatchPage initial={many} />);
    const user = userEvent.setup();

    // First batch: the first 200.
    expect(screen.getByText(/Batch 1 of 2: 230 assigned issues/)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /Send 200 assigned issues/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(1),
    );

    // Second batch: the 30 left.
    await user.click(
      await screen.findByRole('button', { name: /Send 30 assigned issues/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(2),
    );

    const bulks = calls(clientFetch, 'POST', '/issues/bulk').map(
      (c) => (c.body as BulkIssuesRequest).ids,
    );
    expect(bulks.map((ids) => ids.length)).toEqual([200, 30]);
    expect(new Set([...bulks[0], ...bulks[1]])).toEqual(
      new Set(many.map((i) => i.id)),
    );
    expect(open).toHaveBeenCalledTimes(2);
    expect(numbersIn(open.mock.calls[0]).size).toBe(200);
    expect(numbersIn(open.mock.calls[1]).size).toBe(30);
    expect(
      screen.getByRole('button', { name: /Send 0 assigned issues/ }),
    ).toBeDisabled();
  });

  it('more than one batch: "Not yet" moves the next tap on to the next batch', async () => {
    const many = Array.from({ length: 201 }, (_, i) =>
      assignedIssue(worker, { number: i + 1 }),
    );
    renderWithIntl(<BatchPage initial={many} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /Send 200 assigned issues/ }),
    );
    await user.click(await screen.findByRole('button', { name: 'Not yet' }));

    await user.click(
      await screen.findByRole('button', { name: /Send 1 assigned issue on/ }),
    );
    expect([...numbersIn(open.mock.calls[1])]).toEqual([201]);
    expect(clientFetch).not.toHaveBeenCalled();
  });

  it('issues in other statuses are never in a batch, however many there are', async () => {
    const mixed = [
      ...Array.from({ length: 150 }, (_, i) =>
        assignedIssue(worker, { number: i + 1, status: 'sent' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        assignedIssue(worker, { number: 500 + i }),
      ),
      assignedIssue(worker, { number: 600, status: 'in_progress' }),
    ];
    routeApi(clientFetch, {
      'POST /issues/bulk': () => ok({ updated: 3, issues: [] }),
    });
    renderWithIntl(
      <BatchSendToWorker worker={worker} issues={mixed} onSent={vi.fn()} />,
    );
    const user = userEvent.setup();

    expect(screen.queryByText(/Batch 1 of/)).toBeNull();
    await user.click(
      screen.getByRole('button', { name: /Send 3 assigned issues/ }),
    );
    expect(numbersIn(open.mock.calls[0])).toEqual(new Set([500, 501, 502]));
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(1),
    );
    expect(
      (calls(clientFetch, 'POST')[0].body as BulkIssuesRequest).ids,
    ).toEqual(mixed.slice(150, 153).map((i) => i.id));
  });

  it('Deactivated worker: no batch send', () => {
    renderWithIntl(
      <BatchSendToWorker
        worker={{ ...worker, active: false }}
        issues={issues}
        onSent={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Send 2 assigned issues/ }),
    ).toBeDisabled();
    expect(screen.getByText('This worker is deactivated.')).toBeInTheDocument();
  });
});
