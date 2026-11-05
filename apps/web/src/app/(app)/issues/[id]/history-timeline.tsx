'use client';

import { useTranslations } from 'next-intl';
import { formatCairoDateTime, type StatusChange } from '@muayana/shared';
import { STATUS_DOT, StatusChip } from '@/components/status-chip';
import { cn } from '@/lib/utils';

/** Every status change of the issue, oldest first, with its note (invariant §6.7: append-only). */
export function HistoryTimeline({ history }: { history: StatusChange[] }) {
  const t = useTranslations('issue.history');
  const entries = [...history].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <section
      aria-labelledby="history-title"
      className="flex flex-col gap-4 rounded-lg border-2 border-border bg-card p-4"
    >
      <h2 id="history-title" className="type-heading">
        {t('title')}
      </h2>
      {entries.length === 0 ? (
        <p className="type-small text-muted-foreground">{t('empty')}</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < entries.length - 1 && (
                <span
                  aria-hidden
                  className="absolute start-[5px] top-4 bottom-0 w-0.5 bg-border"
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 size-3 shrink-0 rounded-full',
                  STATUS_DOT[entry.to],
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.from && (
                    <>
                      <StatusChip status={entry.from} className="opacity-70" />
                      <span aria-hidden className="flip-rtl">
                        →
                      </span>
                      <span className="sr-only">{t('to')}</span>
                    </>
                  )}
                  <StatusChip status={entry.to} />
                </div>
                <time
                  dateTime={entry.createdAt}
                  className="type-stencil type-small text-muted-foreground"
                  dir="ltr"
                >
                  {formatCairoDateTime(entry.createdAt)}
                </time>
                {entry.note && (
                  <p className="type-body break-words whitespace-pre-line">
                    {entry.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
