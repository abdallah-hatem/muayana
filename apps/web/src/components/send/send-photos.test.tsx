import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkIssuesRequest, Issue, IssueStatus } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi } from '@/test-utils/api-mock';
import {
  assignedIssue,
  makePhoto,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { BatchSendToWorker, SendToWorker } from './send-to-worker';

/** N3 (spec F3): the photos themselves go through the share sheet; links only in the fallback. */

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const worker = makeWorker({ name: 'Sayed', phone: '+201001234567' });

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};
const nav = navigator as unknown as ShareNavigator;

/**
 * Web Share with files: `share` answers as given; `canShare` accepts at most `maxFiles` files
 * (`0` = refuses files altogether, like a desktop browser with `share` but no file support).
 */
function webShare(
  share: (data: ShareData) => Promise<void> = () => Promise.resolve(),
  maxFiles = Infinity,
) {
  nav.share = vi.fn(share);
  nav.canShare = vi.fn(
    (data: ShareData) => (data.files?.length ?? 0) <= maxFiles,
  );
  return { share: vi.mocked(nav.share), canShare: vi.mocked(nav.canShare) };
}

const shared = (share: ReturnType<typeof webShare>['share']) =>
  share.mock.calls.map(([data]) => ({
    names: (data.files ?? []).map((f) => f.name),
    types: (data.files ?? []).map((f) => f.type),
    text: data.text ?? '',
  }));

const photos = (n: number, number: number) =>
  Array.from({ length: n }, (_, i) =>
    makePhoto({
      url: `https://blob.test/photos/${number}-${i + 1}.jpg`,
      sortOrder: i,
    }),
  );

const issueWith = (number: number, photoCount = 2, status?: IssueStatus) =>
  assignedIssue(worker, {
    number,
    photos: photos(photoCount, number),
    ...(status ? { status } : {}),
  });

const sendButton = () =>
  screen.getByRole('button', { name: /Send on WhatsApp/ });

let open: ReturnType<typeof vi.fn>;
let photoFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  open = vi.fn();
  vi.stubGlobal('open', open);
  photoFetch = vi.fn(async (url: string) =>
    url.includes('broken')
      ? new Response(null, { status: 404 })
      : new Response(new Blob(['jpeg'], { type: 'image/jpeg' })),
  );
  vi.stubGlobal('fetch', photoFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete nav.share;
  delete nav.canShare;
  vi.mocked(clientFetch).mockReset();
});

describe('SendToWorker — photo files', () => {
  it('canShare({files}) → share called with photo Files and caption text containing no photo URLs (§5.5)', async () => {
    const web = webShare();
    renderWithIntl(<SendToWorker issue={issueWith(14)} onSent={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(sendButton());

    await waitFor(() => expect(web.share).toHaveBeenCalledTimes(1));
    const [only] = shared(web.share);
    expect(only.names).toEqual(['#14-1.jpg', '#14-2.jpg']);
    expect(only.types).toEqual(['image/jpeg', 'image/jpeg']);
    expect(only.text).toContain('#14');
    expect(only.text).not.toMatch(/https?:\/\//);
    expect(open).not.toHaveBeenCalled();
  });

  it("canShare false → wa.me to the contractor's number with text + photo links (§5.5, §6.10)", async () => {
    const web = webShare(undefined, 0);
    renderWithIntl(<SendToWorker issue={issueWith(14)} onSent={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(sendButton());

    expect(web.share).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/201001234567');
    const text = url.searchParams.get('text') ?? '';
    expect(text).toContain('#14');
    expect(text).toContain('https://blob.test/photos/14-1.jpg');
    expect(text).toContain('https://blob.test/photos/14-2.jpg');
    expect(await screen.findByText('Mark as sent?')).toBeInTheDocument();
  });

  it('Share cancelled → no "Mark as sent?" prompt / no status change (§6.13)', async () => {
    const web = webShare(() =>
      Promise.reject(new DOMException('Share canceled', 'AbortError')),
    );
    const onSent = vi.fn();
    renderWithIntl(<SendToWorker issue={issueWith(14)} onSent={onSent} />);
    const user = userEvent.setup();

    await user.click(sendButton());

    await waitFor(() => expect(web.share).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(screen.queryByText('Mark as sent?')).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    expect(clientFetch).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('Photo fetch fails for one file → share the rest, caption notes the missing one (spec F3)', async () => {
    const web = webShare();
    const issue = assignedIssue(worker, {
      number: 14,
      photos: [
        makePhoto({ url: 'https://blob.test/photos/ok.jpg', sortOrder: 0 }),
        makePhoto({ url: 'https://blob.test/photos/broken.jpg', sortOrder: 1 }),
      ],
    });
    renderWithIntl(<SendToWorker issue={issue} onSent={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(sendButton());

    await waitFor(() => expect(web.share).toHaveBeenCalledTimes(1));
    const [only] = shared(web.share);
    expect(only.names).toEqual(['#14-1.jpg']);
    const lastLine = only.text.split('\n').at(-1) ?? '';
    expect(lastLine).toContain('#14');
    expect(lastLine).toContain('تعذّر إرفاق صورة');
    expect(only.text).not.toMatch(/https?:\/\//);
  });

  it('Mark-as-sent flow unchanged after a successful share (§6.13)', async () => {
    webShare();
    const issue = issueWith(14);
    routeApi(clientFetch, {
      'POST /issues/': () => ok({ ...issue, status: 'sent' }),
    });
    const onSent = vi.fn();
    renderWithIntl(<SendToWorker issue={issue} onSent={onSent} />);
    const user = userEvent.setup();

    await user.click(sendButton());
    const yes = await screen.findByRole('button', { name: 'Yes, mark sent' });
    fireEvent.click(yes);
    fireEvent.click(yes);

    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(onSent.mock.calls[0][0]).toMatchObject({ status: 'sent' });
    expect(calls(clientFetch, 'POST')).toEqual([
      {
        method: 'POST',
        path: `/issues/${issue.id}/status`,
        body: { status: 'sent' },
      },
    ]);
  });

  it('Re-sending an issue already `sent` or later → no prompt, status unchanged (§5.5)', async () => {
    const web = webShare();
    const user = userEvent.setup();
    const later: IssueStatus[] = ['sent', 'estimated', 'in_progress', 'solved'];

    for (const status of later) {
      const view = renderWithIntl(
        <SendToWorker issue={issueWith(20, 1, status)} onSent={vi.fn()} />,
      );
      await user.click(sendButton());
      await waitFor(() => expect(sendButton()).toBeEnabled());
      expect(screen.queryByText('Mark as sent?')).not.toBeInTheDocument();
      view.unmount();
    }

    expect(web.share).toHaveBeenCalledTimes(later.length);
    expect(clientFetch).not.toHaveBeenCalled();
  });
});

describe('BatchSendToWorker — photo files', () => {
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

  const bulkRoute = (all: readonly Issue[]) => ({
    'POST /issues/bulk': (call: { body?: unknown }) => {
      const { ids } = call.body as BulkIssuesRequest;
      const sent = all
        .filter((i) => ids.includes(i.id))
        .map((i) => ({ ...i, status: 'sent' as const }));
      return ok({ updated: sent.length, issues: sent });
    },
  });

  it('Batch with files → all photos of all `assigned` issues; too many/too large → split into several shares (§5.5)', async () => {
    // The browser takes at most 4 files per share.
    const web = webShare(undefined, 4);
    const issues = [
      issueWith(1),
      issueWith(2, 2, 'sent'),
      issueWith(3),
      issueWith(4),
    ];
    routeApi(clientFetch, bulkRoute(issues));
    renderWithIntl(<BatchPage initial={issues} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /Send 3 assigned issues/ }),
    );
    // Part 1 went out; the next part waits for its own tap, and no question yet.
    const next = await screen.findByRole('button', {
      name: 'Share part 2 of 2',
    });
    expect(screen.queryByText('Mark as sent?')).not.toBeInTheDocument();
    await user.click(next);
    expect(await screen.findByText('Mark as sent?')).toBeInTheDocument();

    const parts = shared(web.share);
    expect(parts.map((p) => p.names)).toEqual([
      ['#1-1.jpg', '#1-2.jpg', '#3-1.jpg', '#3-2.jpg'],
      ['#4-1.jpg', '#4-2.jpg'],
    ]);
    expect(parts[0].text.split('\n')[0]).toBe('(1/2)');
    expect(parts[1].text.split('\n')[0]).toBe('(2/2)');
    expect(parts[0].text).toContain('#3');
    expect(parts[1].text).toContain('#4');
    for (const p of parts) {
      expect(p.text).not.toContain('#2');
      expect(p.text).not.toMatch(/https?:\/\//);
    }
    expect(open).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, mark sent' }));
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(1),
    );
    expect(
      (calls(clientFetch, 'POST', '/issues/bulk')[0].body as BulkIssuesRequest)
        .ids,
    ).toEqual([issues[0].id, issues[2].id, issues[3].id]);
  });

  it('Batch share refused for size → split in two, the rest shared on the next taps (§5.5)', async () => {
    // canShare says yes, but the share itself fails on more than 2 files.
    const web = webShare((data) =>
      (data.files?.length ?? 0) > 2
        ? Promise.reject(new DOMException('Too large', 'NotAllowedError'))
        : Promise.resolve(),
    );
    const issues = [issueWith(1), issueWith(2)];
    renderWithIntl(<BatchPage initial={issues} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /Send 2 assigned issues/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Share part 1 of 2' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Share part 2 of 2' }),
    );
    expect(await screen.findByText('Mark as sent?')).toBeInTheDocument();

    expect(shared(web.share).map((p) => p.names)).toEqual([
      ['#1-1.jpg', '#1-2.jpg', '#2-1.jpg', '#2-2.jpg'],
      ['#1-1.jpg', '#1-2.jpg'],
      ['#2-1.jpg', '#2-2.jpg'],
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it('Share cancelled → no "Mark as sent?" prompt / no status change (§6.13) — batch, mid-way', async () => {
    let n = 0;
    webShare(
      () =>
        (n += 1) === 2
          ? Promise.reject(new DOMException('Share canceled', 'AbortError'))
          : Promise.resolve(),
      2,
    );
    renderWithIntl(<BatchPage initial={[issueWith(1), issueWith(2)]} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /Send 2 assigned issues/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Share part 2 of 2' }),
    );

    // Back to the start: no question, nothing sent.
    expect(
      await screen.findByRole('button', { name: /Send 2 assigned issues/ }),
    ).toBeEnabled();
    expect(screen.queryByText('Mark as sent?')).not.toBeInTheDocument();
    expect(clientFetch).not.toHaveBeenCalled();
  });

  it('Batch over 200 assigned issues → shares + bulk calls in batches of ≤200 (§5.5)', async () => {
    const web = webShare();
    const many = Array.from({ length: 230 }, (_, i) => issueWith(i + 1, 1));
    routeApi(clientFetch, bulkRoute(many));
    renderWithIntl(<BatchPage initial={many} />);
    const user = userEvent.setup();

    /** Taps through every share of the current batch (10 files each), then says yes. */
    async function sendBatch(count: number, parts: number) {
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(`Send ${count} assigned issues`),
        }),
      );
      for (let part = 2; part <= parts; part += 1)
        await user.click(
          await screen.findByRole('button', {
            name: `Share part ${part} of ${parts}`,
          }),
        );
      await user.click(
        await screen.findByRole('button', { name: 'Yes, mark sent' }),
      );
    }

    await sendBatch(200, 20);
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(1),
    );
    await sendBatch(30, 3);
    await waitFor(() =>
      expect(calls(clientFetch, 'POST', '/issues/bulk')).toHaveLength(2),
    );

    const bulks = calls(clientFetch, 'POST', '/issues/bulk').map(
      (c) => (c.body as BulkIssuesRequest).ids,
    );
    expect(bulks.map((ids) => ids.length)).toEqual([200, 30]);
    const files = shared(web.share).flatMap((p) => p.names);
    expect(web.share).toHaveBeenCalledTimes(23);
    expect(files).toHaveLength(230);
    expect(new Set(files).size).toBe(230);
    expect(open).not.toHaveBeenCalled();
  });

  it('Batch fallback (no file sharing) → wa.me text with links (§5.5)', async () => {
    const issues = [issueWith(1), issueWith(2, 1, 'in_progress'), issueWith(3)];
    renderWithIntl(<BatchPage initial={issues} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /Send 2 assigned issues/ }),
    );

    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/201001234567');
    const text = url.searchParams.get('text') ?? '';
    for (const link of [
      'https://blob.test/photos/1-1.jpg',
      'https://blob.test/photos/3-2.jpg',
    ])
      expect(text).toContain(link);
    expect(text).not.toContain('photos/2-1.jpg');
    expect(photoFetch).not.toHaveBeenCalled();
    expect(await screen.findByText('Mark as sent?')).toBeInTheDocument();
  });
});
