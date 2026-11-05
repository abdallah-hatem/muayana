'use client';

import { Combine, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  PHOTOS_PER_KIND_MAX,
  type Category,
  type Issue,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { CategoryChips } from '@/components/category-chips';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useApiErrorText } from '@/components/use-api-error-text';
import type { ApiResult } from '@/lib/api-result';
import { bulkIssues, mergeIssues } from '@/lib/issue-endpoints';
import { photosOf } from '@/lib/issue-state';
import { cn } from '@/lib/utils';
import { mergeCheck } from './merge';

/**
 * Bulk mode of the inbox (business §5.3): select several issues and give them one category (they
 * stay `new` until each gets a description), or merge two captures of the same defect.
 */
export function BulkPanel({
  issues,
  categories,
  onChanged,
}: {
  issues: readonly Issue[];
  categories: readonly Category[];
  /** Something changed on the server: reload the inbox. */
  onChanged: () => void;
}) {
  const t = useTranslations('inbox.bulk');
  const tCommon = useTranslations('common');
  const errorText = useApiErrorText();
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'category' | 'merge' | null>(null);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const inFlight = useRef(false);

  const chosen = issues.filter((i) => selected.includes(i.id));
  const merge = mergeCheck(chosen);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));

  async function run(
    kind: 'category' | 'merge',
    call: () => Promise<ApiResult<unknown>>,
    doneText: string,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    setError(null);
    setDone(null);
    const res = await call();
    inFlight.current = false;
    setBusy(null);
    if (!res.success) {
      setError(errorText(res));
      return;
    }
    setSelected([]);
    setConfirmMerge(false);
    setDone(doneText);
    onChanged();
  }

  const mergeReason =
    chosen.length === 2 && !merge.ok
      ? merge.reason === 'tooManyPhotos'
        ? t('mergeTooManyPhotos', { max: PHOTOS_PER_KIND_MAX })
        : t('mergeNotNew')
      : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="type-small text-muted-foreground">{t('hint')}</p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {issues.map((issue) => {
          const cover = photosOf(issue.photos, 'before')[0];
          const on = selected.includes(issue.id);
          const label = tCommon('labels.issueNumber', { number: issue.number });
          return (
            <li key={issue.id}>
              <label
                className={cn(
                  'relative flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-card',
                  on ? 'border-primary ring-3 ring-primary' : 'border-border',
                )}
              >
                <span className="relative aspect-square bg-muted">
                  {cover && (
                    <Image
                      src={cover.url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 200px, 50vw"
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 p-2">
                  <span className="type-stencil type-small" dir="ltr">
                    {label}
                  </span>
                  <span className="type-micro text-muted-foreground">
                    {tCommon('labels.photos', {
                      count: photosOf(issue.photos, 'before').length,
                    })}
                  </span>
                </span>
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => toggle(issue.id, v === true)}
                  aria-label={t('select', { number: issue.number })}
                  className="absolute end-2 top-2 size-6 bg-card"
                />
              </label>
            </li>
          );
        })}
      </ul>

      <section className="sticky bottom-24 z-10 -mx-4 flex flex-col gap-3 border-t-2 border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-lg md:border-2">
        <p className="type-small font-bold" aria-live="polite">
          {t('selected', { count: selected.length })}
        </p>
        <CategoryChips
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          disabled={busy !== null}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={
              selected.length === 0 || categoryId === null || busy !== null
            }
            onClick={() =>
              void run(
                'category',
                () =>
                  bulkIssues({ ids: selected, categoryId: categoryId ?? '' }),
                t('categoryDone', { count: selected.length }),
              )
            }
          >
            {busy === 'category' && (
              <Loader2 className="animate-spin" aria-hidden />
            )}
            {t('setCategory', { count: selected.length })}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!merge.ok || busy !== null}
            aria-describedby={mergeReason ? 'merge-reason' : undefined}
            onClick={() => setConfirmMerge(true)}
          >
            <Combine aria-hidden />
            {t('merge')}
          </Button>
        </div>
        {mergeReason && (
          <p id="merge-reason" className="type-small text-destructive">
            {mergeReason}
          </p>
        )}
        {error && (
          <p role="alert" className="type-small text-destructive">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="type-small text-success">
            {done}
          </p>
        )}
      </section>

      {merge.ok && (
        <BottomSheet
          open={confirmMerge}
          onOpenChange={(open) => !busy && setConfirmMerge(open)}
          title={t('mergeTitle')}
          description={t('mergeBody', {
            target: merge.target.number,
            source: merge.source.number,
          })}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => setConfirmMerge(false)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    'merge',
                    () => mergeIssues(merge.target.id, merge.source.id),
                    t('mergeDone', { number: merge.target.number }),
                  )
                }
              >
                {busy === 'merge' && (
                  <Loader2 className="animate-spin" aria-hidden />
                )}
                {t('mergeConfirm')}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
