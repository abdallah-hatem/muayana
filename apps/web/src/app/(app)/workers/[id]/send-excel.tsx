'use client';

import {
  type Issue,
  type IssueExportColumn,
  type IssueStatus,
  type Locale,
  type Worker,
} from '@muayana/shared';
import { FileSpreadsheet, Loader2, Share2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/bottom-sheet';
import { ConfirmSheet } from '@/components/confirm-sheet';
import {
  ExportColumnChooser,
  defaultExportColumns,
} from '@/components/export-column-chooser';
import { Button } from '@/components/ui/button';
import { useApiErrorText } from '@/components/use-api-error-text';
import type { ExcelRow } from '@/lib/contractor-excel';
import {
  contractorIssues,
  excelRows,
  markExcelIssuesSent,
  markableIssues,
  refusedNumbers,
  writeExcel,
  type Progress,
} from '@/lib/contractor-excel-flow';
import { shareOrDownload } from '@/lib/share-file';
import { cn } from '@/lib/utils';

/** The statuses a contractor's issue can be in, offered as the file's filter (default `assigned`). */
export const EXCEL_STATUSES: readonly IssueStatus[] = [
  'assigned',
  'sent',
  'estimated',
  'in_progress',
  'solved',
  'cancelled',
];

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'photos'; progress: Progress }
  | { kind: 'ready'; file: File; issues: Issue[] }
  | { kind: 'tooBig'; size: number; fit: number; total: number }
  | { kind: 'error'; message: string };

/** Megabytes with one decimal; a small file reads 0.1, never 0.0. */
const megabytes = (bytes: number): string =>
  Math.max(0.1, bytes / 1024 / 1024).toFixed(1);

/**
 * "Send as Excel" on a contractor's page (business §5.5, §7): his issues in the chosen statuses
 * (default `assigned`, every one of them), the columns picked like the issues CSV, photos embedded
 * in the rows. The file goes through the share sheet (or is downloaded), then "Mark as sent?" asks
 * about the `assigned` issues it held — only a yes changes them; backing out of the share changes
 * nothing and asks nothing.
 */
export function SendExcel({
  worker,
  onSent,
}: {
  worker: Pick<Worker, 'id' | 'name' | 'counts'>;
  onSent: () => void;
}) {
  const t = useTranslations('excel');
  const tStatus = useTranslations('common.status');
  const locale = useLocale() as Locale;
  const errorText = useApiErrorText();
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<IssueStatus[]>(['assigned']);
  const [columns, setColumns] =
    useState<IssueExportColumn[]>(defaultExportColumns);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [sharing, setSharing] = useState(false);
  const [asking, setAsking] = useState<Issue[] | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  // The rows of the last build, so "fewer issues" rebuilds without reading them again.
  const rows = useRef<ExcelRow[]>([]);

  const busy = phase.kind === 'reading' || phase.kind === 'photos';
  const invalid = statuses.length === 0 || columns.length === 0;

  /** A changed choice makes a prepared file stale. */
  const changed =
    <T,>(set: (v: T) => void) =>
    (value: T) => {
      set(value);
      setPhase({ kind: 'idle' });
    };

  async function write(selected: ExcelRow[]) {
    const built = await writeExcel({
      rows: selected,
      columns,
      lang: locale,
      now: new Date(),
      workerName: worker.name,
    });
    setPhase(
      built.kind === 'file'
        ? { kind: 'ready', file: built.file, issues: built.issues }
        : built,
    );
  }

  async function build() {
    if (busy || invalid) return;
    setPhase({ kind: 'reading' });
    try {
      const list = await contractorIssues(worker.id, statuses);
      if (!list.success) {
        setPhase({ kind: 'error', message: errorText(list) });
        return;
      }
      if (list.data.length === 0) {
        setPhase({ kind: 'error', message: t('empty') });
        return;
      }
      const built = await excelRows(list.data, columns, (progress) =>
        setPhase({ kind: 'photos', progress }),
      );
      if (!built.success) {
        setPhase({ kind: 'error', message: errorText(built) });
        return;
      }
      rows.current = built.data;
      await write(built.data);
    } catch {
      setPhase({ kind: 'error', message: t('failed') });
    }
  }

  async function fewer(count: number) {
    setPhase({ kind: 'reading' });
    try {
      await write(rows.current.slice(0, count));
    } catch {
      setPhase({ kind: 'error', message: t('failed') });
    }
  }

  async function share(file: File, issues: Issue[]) {
    if (sharing) return;
    setSharing(true);
    const outcome = await shareOrDownload(file);
    setSharing(false);
    if (outcome === 'cancelled') return;
    setOpen(false);
    setPhase({ kind: 'idle' });
    const markable = markableIssues(issues);
    if (markable.length > 0) {
      setMarkError(null);
      setAsking(markable);
    }
  }

  async function markSent(issues: Issue[]) {
    if (marking) return;
    const refused = refusedNumbers(issues);
    if (refused.length > 0) {
      setMarkError(t('confirm.refused', { numbers: refused.join('، ') }));
      return;
    }
    setMarking(true);
    setMarkError(null);
    const res = await markExcelIssuesSent(issues);
    setMarking(false);
    if (!res.success) {
      const partly = (res.data as { updated?: number } | undefined)?.updated;
      setMarkError(
        partly
          ? `${errorText(res)} ${t('confirm.partly', { count: partly })}`
          : errorText(res),
      );
      if (partly) onSent();
      return;
    }
    setAsking(null);
    toast.success(t('toast.marked', { count: res.data.updated }));
    onSent();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-auto min-h-12 w-full py-2 whitespace-normal"
        onClick={() => setOpen(true)}
      >
        <FileSpreadsheet aria-hidden />
        {t('button')}
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => !busy && !sharing && setOpen(next)}
        title={t('title')}
        description={t('subtitle')}
        footer={
          phase.kind === 'ready' ? (
            <Button
              type="button"
              disabled={sharing}
              onClick={() => void share(phase.file, phase.issues)}
            >
              {sharing ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Share2 aria-hidden />
              )}
              {t('share')}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy || invalid}
              onClick={() => void build()}
            >
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet aria-hidden />
              )}
              {busy ? t('building') : t('build')}
            </Button>
          )
        }
      >
        <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
          {phase.kind === 'reading' && (
            <p className="type-small text-muted-foreground">{t('reading')}</p>
          )}
          {phase.kind === 'photos' && (
            <p className="type-small text-muted-foreground">
              {t('progress', phase.progress)}
            </p>
          )}
          {phase.kind === 'ready' && (
            <p
              data-testid="excel-ready"
              className="rounded-md border-2 border-success bg-success/10 p-3 type-small font-bold"
            >
              {t('ready', {
                count: phase.issues.length,
                size: megabytes(phase.file.size),
              })}
            </p>
          )}
          {phase.kind === 'tooBig' && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-md border-2 border-destructive bg-destructive/10 p-3"
            >
              <p className="type-small font-bold">
                {t('tooBig', {
                  size: megabytes(phase.size),
                  fit: phase.fit,
                  total: phase.total,
                })}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void fewer(phase.fit)}
              >
                {t('fewer', { count: phase.fit })}
              </Button>
            </div>
          )}
          {phase.kind === 'error' && (
            <p role="alert" className="type-small text-destructive">
              {phase.message}
            </p>
          )}
        </div>
        <StatusPicker
          value={statuses}
          counts={worker.counts}
          label={t('statuses.label')}
          statusLabel={(s) => tStatus(s)}
          disabled={busy}
          onChange={changed(setStatuses)}
        />
        {statuses.length === 0 && (
          <p role="alert" className="type-small text-destructive">
            {t('statuses.none')}
          </p>
        )}
        <ExportColumnChooser
          value={columns}
          onChange={changed(setColumns)}
          target="excel"
        />
      </BottomSheet>

      <ConfirmSheet
        open={asking !== null}
        onOpenChange={(next) => {
          if (!next) setAsking(null);
        }}
        title={t('confirm.title')}
        body={t('confirm.body', { count: asking?.length ?? 0 })}
        confirmLabel={t('confirm.yes')}
        cancelLabel={t('confirm.no')}
        busy={marking}
        error={markError}
        onConfirm={() => asking && void markSent(asking)}
      />
    </>
  );
}

function StatusPicker({
  value,
  counts,
  label,
  statusLabel,
  disabled,
  onChange,
}: {
  value: readonly IssueStatus[];
  counts: Worker['counts'];
  label: string;
  statusLabel: (status: IssueStatus) => string;
  disabled: boolean;
  onChange: (statuses: IssueStatus[]) => void;
}) {
  const countOf = (status: IssueStatus): number | null =>
    status in counts ? counts[status as keyof typeof counts] : null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 type-small font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {EXCEL_STATUSES.map((status) => {
          const on = value.includes(status);
          const count = countOf(status);
          return (
            <button
              key={status}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() =>
                onChange(
                  EXCEL_STATUSES.filter((s) =>
                    s === status ? !on : value.includes(s),
                  ),
                )
              }
              className={cn(
                'inline-flex min-h-11 press cursor-pointer items-center gap-2 rounded-md border-2 px-3 type-small font-bold disabled:cursor-not-allowed disabled:opacity-60',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:border-foreground/40',
              )}
            >
              {statusLabel(status)}
              {count !== null && (
                <span className="type-stencil opacity-80">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
