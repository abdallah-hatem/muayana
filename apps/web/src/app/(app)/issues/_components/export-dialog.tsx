'use client';

import {
  ISSUE_EXPORT_COLUMNS,
  todayInCairo,
  type IssueExportColumn,
  type Locale,
  type ParsedIssueFilter,
} from '@muayana/shared';
import { Download, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  ExportColumnChooser,
  defaultExportColumns,
} from '@/components/export-column-chooser';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clientFetchRaw } from '@/lib/api-client';
import { saveResponse } from '@/lib/download';
import { filterToSearchParams } from '@/lib/issue-filter-url';
import { cn } from '@/lib/utils';

export type ExportKind = 'issues' | 'history';

/**
 * The CSV request for the list's filter (§7): exactly the same filter parameters, the chosen
 * columns in their §7 order (issues only), and the header language.
 */
export function exportPath(
  kind: ExportKind,
  filter: ParsedIssueFilter,
  columns: readonly IssueExportColumn[],
  lang: Locale,
): string {
  const params = filterToSearchParams(filter);
  if (kind === 'issues') {
    const chosen = ISSUE_EXPORT_COLUMNS.filter((c) => columns.includes(c));
    params.set('columns', chosen.join(','));
  }
  params.set('lang', lang);
  const file = kind === 'issues' ? 'export.csv' : 'history.csv';
  return `/issues/${file}?${params.toString()}`;
}

/** Issues CSV (pick columns, all by default) or status-history CSV, for the current filter. */
export function ExportDialog({
  open,
  onOpenChange,
  filter,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: ParsedIssueFilter;
  /** Issues matching the filter, as the list counted them (null while it loads). */
  total: number | null;
}) {
  const t = useTranslations('export');
  const locale = useLocale() as Locale;
  const [kind, setKind] = useState<ExportKind>('issues');
  const [columns, setColumns] =
    useState<IssueExportColumn[]>(defaultExportColumns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noColumns = kind === 'issues' && columns.length === 0;

  async function download() {
    if (busy || noColumns) return;
    setBusy(true);
    setError(null);
    const res = await clientFetchRaw(exportPath(kind, filter, columns, locale));
    if (!res) {
      setError(t('errors.NETWORK_ERROR'));
    } else if (!res.ok) {
      if (res.status !== 401) setError(t('errors.failed'));
    } else {
      const name = `${kind === 'issues' ? 'issues' : 'status-history'}-${todayInCairo(new Date())}.csv`;
      await saveResponse(res, name);
      onOpenChange(false);
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b-2 p-5 pe-12 text-start">
          <DialogTitle className="type-title">{t('title')}</DialogTitle>
          <DialogDescription className="type-small">
            {t('subtitle')}{' '}
            {total !== null && (
              <span
                data-testid="export-count"
                className="font-bold text-foreground"
              >
                {t('count', { count: total })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex scrollbar-clean min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5">
          <KindPicker value={kind} onChange={setKind} />

          {kind === 'issues' ? (
            <ExportColumnChooser value={columns} onChange={setColumns} />
          ) : (
            <p className="type-body text-muted-foreground">
              {t('historyHint')}
            </p>
          )}

          {error && (
            <p role="alert" className="type-small text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t-2 p-5">
          <Button
            type="button"
            data-testid="export-download"
            onClick={() => void download()}
            disabled={busy || noColumns}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Download aria-hidden />
            )}
            {busy ? t('downloading') : t('download')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KindPicker({
  value,
  onChange,
}: {
  value: ExportKind;
  onChange: (kind: ExportKind) => void;
}) {
  const t = useTranslations('export.kind');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 type-small font-bold">{t('label')}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(['issues', 'history'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={value === kind}
            onClick={() => onChange(kind)}
            className={cn(
              'min-h-12 press cursor-pointer rounded-md border-2 px-3 type-small font-bold',
              value === kind
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:border-foreground/40',
            )}
          >
            {t(kind)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
