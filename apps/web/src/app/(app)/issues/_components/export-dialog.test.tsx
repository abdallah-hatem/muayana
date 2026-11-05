import {
  ISSUE_EXPORT_COLUMNS,
  IssueExportQuerySchema,
  type ParsedIssueFilter,
} from '@muayana/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientFetchRaw } from '@/lib/api-client';
import { searchParamsToFilter } from '@/lib/issue-filter-url';
import { renderIntl } from '@/test-utils/render-intl';
import { ExportDialog, exportPath } from './export-dialog';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

const fetchRaw = vi.mocked(clientFetchRaw);

const FILTER: ParsedIssueFilter = {
  siteId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  status: ['sent', 'estimated'],
  priority: ['urgent'],
  overdue: true,
  capturedFrom: '2026-10-01',
  q: 'شرخ',
  sort: 'oldest',
};

function csvResponse(name = 'issues.csv') {
  return new Response('﻿number\n1\n', {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
    },
  });
}

/** Splits a requested path into its file and its query as the API reads it. */
function requested(call: number) {
  const path = fetchRaw.mock.calls[call][0];
  const [file, qs] = path.split('?');
  return { file, params: new URLSearchParams(qs) };
}

describe('Export request carries exactly the list’s filter + chosen columns + language (§7)', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fetchRaw.mockReset();
  });

  it('issues CSV: the same filter, the chosen columns in §7 order, lang = current locale', async () => {
    fetchRaw.mockResolvedValue(csvResponse());
    const user = userEvent.setup();
    renderIntl(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        filter={FILTER}
        total={18}
      />,
      'ar',
    );
    // Untick two columns (labels in Arabic: the dialog follows the app language).
    await user.click(screen.getByLabelText('هاتف العامل'));
    await user.click(screen.getByLabelText('آخر ملاحظة'));
    await user.click(screen.getByRole('button', { name: 'تنزيل' }));

    await waitFor(() => expect(fetchRaw).toHaveBeenCalledTimes(1));
    const { file, params } = requested(0);
    expect(file).toBe('/issues/export.csv');
    expect(searchParamsToFilter(params)).toEqual(FILTER);
    expect(params.get('columns')).toBe(
      ISSUE_EXPORT_COLUMNS.filter(
        (c) => c !== 'workerPhone' && c !== 'lastNote',
      ).join(','),
    );
    expect(params.get('lang')).toBe('ar');
    // And the API's own schema accepts it.
    expect(
      IssueExportQuerySchema.safeParse(Object.fromEntries(params)).success,
    ).toBe(true);
  });

  it('default columns are all of §7', async () => {
    fetchRaw.mockResolvedValue(csvResponse());
    const user = userEvent.setup();
    renderIntl(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        filter={FILTER}
        total={3}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(fetchRaw).toHaveBeenCalled());
    expect(requested(0).params.get('columns')?.split(',')).toEqual([
      ...ISSUE_EXPORT_COLUMNS,
    ]);
    expect(requested(0).params.get('lang')).toBe('en');
  });

  it('status-history CSV: the same filter and language, no columns', async () => {
    fetchRaw.mockResolvedValue(csvResponse('history.csv'));
    const user = userEvent.setup();
    renderIntl(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        filter={FILTER}
        total={3}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Status history' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(fetchRaw).toHaveBeenCalled());
    const { file, params } = requested(0);
    expect(file).toBe('/issues/history.csv');
    expect(searchParamsToFilter(params)).toEqual(FILTER);
    expect(params.has('columns')).toBe(false);
    expect(params.get('lang')).toBe('en');
  });

  it('no column chosen blocks the download with a message', async () => {
    const user = userEvent.setup();
    renderIntl(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        filter={FILTER}
        total={3}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Select none' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose at least one column.',
    );
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('shows how many rows the export holds', () => {
    renderIntl(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        filter={FILTER}
        total={18}
      />,
    );
    expect(screen.getByTestId('export-count')).toHaveTextContent(
      '18 matching issues',
    );
  });

  it('a pending download sends one request and saves the file under the server’s name', async () => {
    let resolve!: (r: Response) => void;
    fetchRaw.mockReturnValue(new Promise((r) => (resolve = r)));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderIntl(
      <ExportDialog
        open
        onOpenChange={onOpenChange}
        filter={FILTER}
        total={3}
      />,
    );
    const button = screen.getByRole('button', { name: 'Download' });
    await user.click(button);
    expect(
      screen.getByRole('button', { name: /Preparing file/ }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Preparing file/ }));
    resolve(csvResponse('muayana-issues.csv'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchRaw).toHaveBeenCalledTimes(1);
  });

  it('a failed export shows an error and keeps the dialog open', async () => {
    fetchRaw.mockResolvedValue(new Response('nope', { status: 500 }));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderIntl(
      <ExportDialog
        open
        onOpenChange={onOpenChange}
        filter={FILTER}
        total={3}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The export failed',
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('exportPath', () => {
  it('leaves the default sort and empty fields out, like the list URL', () => {
    expect(exportPath('history', { sort: 'newest' }, [], 'en')).toBe(
      '/issues/history.csv?lang=en',
    );
  });
});
