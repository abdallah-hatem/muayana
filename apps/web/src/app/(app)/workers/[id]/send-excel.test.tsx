import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ISSUE_EXPORT_COLUMNS,
  type Issue,
  type IssueExportColumn,
} from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ExcelRow } from '@/lib/contractor-excel';
import { writeExcel, type BuiltExcel } from '@/lib/contractor-excel-flow';
import { calls, routeApi, type ApiCall } from '@/test-utils/api-mock';
import {
  assignedIssue,
  fail,
  makeWorker,
  ok,
  withHistory,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { SendExcel } from './send-excel';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

// Photos are read as small thumbnails; the file itself is written by exceljs (tested on its own
// in lib/contractor-excel.test.ts). Here the file is a stand-in that records what went in.
vi.mock('@/lib/thumbnail', () => ({
  fetchThumbnail: vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    width: 320,
    height: 240,
  })),
}));
vi.mock('@/lib/contractor-excel-flow', async (actual) => ({
  ...(await actual<typeof import('@/lib/contractor-excel-flow')>()),
  writeExcel: vi.fn(),
}));

const write = vi.mocked(writeExcel);

const worker = makeWorker({ name: 'Sayed', phone: '+201001234567' });

/** A file for exactly the rows handed in, as writeExcel answers it. */
const fileFor = ({ rows }: { rows: readonly ExcelRow[] }): BuiltExcel => ({
  kind: 'file',
  file: new File([new Uint8Array(2048)], 'Sayed-2026-11-10.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }),
  issues: rows.map((r) => r.issue as Issue),
});

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

/** A detail read (the last-note column reads each issue's history). */
const detail = (list: () => Issue[]) => (call: ApiCall) => {
  const id = call.path.split('?')[0].split('/').pop();
  const issue = list().find((i) => i.id === id);
  return issue ? ok(withHistory(issue)) : fail(404, 'NOT_FOUND');
};

/** The reads the file needs: the paged list per status and each issue's detail. */
const reads = (list: Issue[]) => ({
  'GET /issues/': detail(() => list),
  'GET /issues': byStatus(() => list),
});

const many = (count: number, over: Partial<Issue> = {}): Issue[] =>
  Array.from({ length: count }, (_, i) =>
    assignedIssue(worker, { number: i + 1, ...over }),
  );

function setShare(share?: (data: ShareData) => Promise<void>) {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: share ? () => true : undefined,
  });
}

function renderSendExcel(onSent = vi.fn()) {
  renderWithIntl(<SendExcel worker={worker} onSent={onSent} />);
  return { user: userEvent.setup(), onSent };
}

/** Opens the sheet and prepares the file. */
async function prepare(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Send as Excel' }));
  await user.click(await screen.findByRole('button', { name: 'Prepare file' }));
}

const rowsWritten = (call = 0): Issue[] =>
  write.mock.calls[call][0].rows.map((r) => r.issue as Issue);

describe('SendExcel (business §5.5, §7)', () => {
  let click: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    write.mockImplementation(async (input) => fileFor(input));
    URL.createObjectURL = vi.fn(() => 'blob:xlsx');
    URL.revokeObjectURL = vi.fn();
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    setShare(async () => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(clientFetch).mockReset();
    write.mockReset();
    setShare(undefined);
  });

  it("Default rows = contractor's `assigned` issues; every one, not a page (§5.5, §6.14)", async () => {
    const list = [...many(250), ...many(3, { status: 'sent' })];
    routeApi(clientFetch, { ...reads(list) });
    const { user } = renderSendExcel();
    await prepare(user);

    await screen.findByTestId('excel-ready');
    const rows = rowsWritten();
    expect(rows).toHaveLength(250);
    expect(rows.every((i) => i.status === 'assigned')).toBe(true);
    const asked = calls(clientFetch, 'GET', '/issues?').map((c) => c.path);
    expect(asked).toHaveLength(3); // 100 + 100 + 50
    expect(asked.every((p) => p.includes('status=assigned'))).toBe(true);
    expect(asked.every((p) => p.includes(`workerId=${worker.id}`))).toBe(true);
    // Columns: the same default as the issues CSV — all of §7, in order.
    expect(write.mock.calls[0][0].columns).toEqual([...ISSUE_EXPORT_COLUMNS]);
    expect(write.mock.calls[0][0].lang).toBe('en');
  });

  it('Chosen columns only, in order; header language ar/en (§7)', async () => {
    routeApi(clientFetch, { ...reads(many(1)) });
    const { user } = renderSendExcel();
    await user.click(screen.getByRole('button', { name: 'Send as Excel' }));
    // The shared chooser: labels from the one shared list, in the app language.
    await user.click(
      await screen.findByRole('button', { name: 'Select none' }),
    );
    await user.click(screen.getByLabelText('Status'));
    await user.click(screen.getByLabelText('Number'));
    await user.click(screen.getByRole('button', { name: 'Prepare file' }));
    await screen.findByTestId('excel-ready');
    const chosen: IssueExportColumn[] = ['number', 'status'];
    expect(write.mock.calls[0][0].columns).toEqual(chosen);
  });

  it('Share via canShare({files}) with .xlsx; fallback download (§5.5)', async () => {
    routeApi(clientFetch, { ...reads(many(2)) });
    const share = vi.fn<(data: ShareData) => Promise<void>>(
      async () => undefined,
    );
    setShare(share);
    const { user } = renderSendExcel();
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const files = share.mock.calls[0][0].files ?? [];
    expect(files).toHaveLength(1);
    expect(files[0].name).toMatch(/\.xlsx$/);
    expect(click).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    // No file sharing (a desktop): the file is downloaded instead.
    setShare(undefined);
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/\.xlsx$/);
  });

  it('After sharing, "Mark as sent?" yes → included `assigned` issues → sent in bulk (≤200 per call); no → unchanged (§5.5, §6.13)', async () => {
    const list = many(250);
    routeApi(clientFetch, {
      ...reads(list),
      'POST /issues/bulk': (call) =>
        ok({
          updated: (call.body as { ids: string[] }).ids.length,
          issues: [],
        }),
    });
    const { user, onSent } = renderSendExcel();

    // "Cancel" (not yet): nothing changes.
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    await screen.findByText('Mark as sent?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls(clientFetch, 'POST')).toHaveLength(0);
    expect(onSent).not.toHaveBeenCalled();

    // Yes: every assigned issue of the file, in bulk calls of at most 200.
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    const bulk = calls(clientFetch, 'POST', '/issues/bulk').map(
      (c) => c.body as { ids: string[]; status: string },
    );
    expect(bulk.map((b) => b.ids.length)).toEqual([200, 50]);
    expect(bulk.every((b) => b.status === 'sent')).toBe(true);
    expect(new Set(bulk.flatMap((b) => b.ids))).toEqual(
      new Set(list.map((i) => i.id)),
    );
  });

  it('Rows widened by the status filter → "Mark as sent" changes only the `assigned` ones (§5.5)', async () => {
    const assigned = many(2);
    const others = [
      ...many(1, { status: 'sent' }),
      ...many(1, { status: 'solved' }),
    ];
    routeApi(clientFetch, {
      ...reads([...assigned, ...others]),
      'POST /issues/bulk': () => ok({ updated: 2, issues: [] }),
    });
    const { user, onSent } = renderSendExcel();
    await user.click(screen.getByRole('button', { name: 'Send as Excel' }));
    await user.click(await screen.findByRole('button', { name: /^Sent/ }));
    await user.click(screen.getByRole('button', { name: /^Solved/ }));
    await user.click(screen.getByRole('button', { name: 'Prepare file' }));
    await screen.findByTestId('excel-ready');
    expect(rowsWritten().map((i) => i.status)).toEqual([
      'assigned',
      'assigned',
      'sent',
      'solved',
    ]);

    await user.click(screen.getByRole('button', { name: 'Share file' }));
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(calls(clientFetch, 'POST', '/issues/bulk')[0].body).toEqual({
      ids: assigned.map((i) => i.id),
      status: 'sent',
    });
  });

  it('Share cancelled → no prompt, no status change (§6.13)', async () => {
    routeApi(clientFetch, { ...reads(many(2)) });
    setShare(async () => {
      throw new DOMException('closed', 'AbortError');
    });
    const { user, onSent } = renderSendExcel();
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    // Still on the prepared file; no "Mark as sent?", nothing sent or downloaded.
    expect(await screen.findByTestId('excel-ready')).toBeInTheDocument();
    expect(screen.queryByText('Mark as sent?')).toBeNull();
    expect(calls(clientFetch, 'POST')).toHaveLength(0);
    expect(click).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('Bulk mark-as-sent where one issue breaks a rule → none change, error shown (§5.3)', async () => {
    // The server refuses the batch (all-or-nothing): the error shows, nothing is reported sent.
    routeApi(clientFetch, {
      ...reads(many(3)),
      'POST /issues/bulk': () => fail(409, 'ISSUE_REQUIREMENTS'),
    });
    const { user, onSent } = renderSendExcel();
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    expect(
      await screen.findByText('This issue is missing what that status needs.'),
    ).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('Bulk mark-as-sent where one issue breaks a rule (known on the phone) → no request, the issue named (§5.3)', async () => {
    const list = [
      ...many(2),
      assignedIssue(worker, { number: 77, description: null }),
    ];
    routeApi(clientFetch, { ...reads(list) });
    const { user, onSent } = renderSendExcel();
    await prepare(user);
    await user.click(await screen.findByRole('button', { name: 'Share file' }));
    await user.click(
      await screen.findByRole('button', { name: 'Yes, mark sent' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('77');
    expect(calls(clientFetch, 'POST')).toHaveLength(0);
    expect(onSent).not.toHaveBeenCalled();
  });

  it('File > ~15 MB → warning, offer fewer issues (§5.5)', async () => {
    routeApi(clientFetch, { ...reads(many(5)) });
    write.mockImplementationOnce(async () => ({
      kind: 'tooBig',
      size: 18 * 1024 * 1024,
      fit: 2,
      total: 5,
    }));
    const { user } = renderSendExcel();
    await prepare(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('18.0 MB');
    // Nothing to share yet.
    expect(screen.queryByRole('button', { name: 'Share file' })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Include the first 2 issues' }),
    );
    await screen.findByTestId('excel-ready');
    expect(rowsWritten(1).map((i) => i.number)).toEqual([1, 2]);
    // The issues were read once; the smaller file reuses them.
    expect(
      calls(clientFetch, 'GET', '/issues').filter((c) =>
        c.path.includes('page=1'),
      ),
    ).toHaveLength(1);
  });

  it('No issues in the chosen statuses → says so, no file', async () => {
    routeApi(clientFetch, { ...reads([]) });
    const { user } = renderSendExcel();
    await prepare(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No issues in the chosen statuses.',
    );
    expect(write).not.toHaveBeenCalled();
  });
});
