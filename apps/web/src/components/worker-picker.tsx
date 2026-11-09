'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Worker, WorkerRef } from '@muayana/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { listWorkersForCategory } from '@/lib/issue-endpoints';

const NONE = '__none__';

/** What the picker shows of a worker: his name and how many open issues he holds. */
export type PickableWorker = Pick<Worker, 'id' | 'name'> & {
  counts: Pick<Worker['counts'], 'open'>;
};

/** Only the workers who may take an issue of this category: active and covering it (§5.4, §6.11). */
export const eligibleWorkers = <
  W extends Pick<Worker, 'active'> & { categories: readonly { id: string }[] },
>(
  workers: readonly W[],
  categoryId: string,
): W[] =>
  workers.filter(
    (w) => w.active && w.categories.some((c) => c.id === categoryId),
  );

/**
 * Chooses the worker for an issue: the active workers having its category, each with how many open
 * issues he holds (business §5.4). Disabled until a category is chosen. `onWorkersLoaded` tells the
 * caller who is eligible, so a category change can drop a worker who lacks it (§6.3).
 */
export function WorkerPicker({
  id,
  categoryId,
  value,
  onChange,
  onWorkersLoaded,
  currentWorker = null,
  disabled = false,
  invalid = false,
}: {
  id: string;
  categoryId: string | null;
  value: string | null;
  onChange: (worker: Worker | null) => void;
  onWorkersLoaded?: (workers: Worker[]) => void;
  /** The issue's worker as saved: still shown when he is no longer in the list (deactivated). */
  currentWorker?: WorkerRef | null;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const t = useTranslations('issue.workerPicker');
  const [loaded, setLoaded] = useState<{
    categoryId: string;
    workers: Worker[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!categoryId) return;
    let live = true;
    void listWorkersForCategory(categoryId).then((res) => {
      if (!live) return;
      const workers = res.success ? eligibleWorkers(res.data, categoryId) : [];
      setLoaded({ categoryId, workers, failed: !res.success });
      if (res.success) onWorkersLoaded?.(workers);
    });
    return () => {
      live = false;
    };
    // onWorkersLoaded is a callback prop: reload on category change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [categoryId]);

  if (!categoryId) return <WorkerNeedsCategory id={id} />;

  const current = loaded?.categoryId === categoryId ? loaded : null;
  if (!current) return <Skeleton className="h-12 w-full rounded-md" />;

  return (
    <WorkerSelect
      id={id}
      workers={current.workers}
      value={value}
      onChange={onChange}
      currentWorker={currentWorker}
      disabled={disabled}
      invalid={invalid}
      emptyText={current.failed ? t('loadFailed') : t('emptyForCategory')}
    />
  );
}

/**
 * The worker select itself, over a list the caller already has (the capture sheet's cached
 * contractors work offline): "no worker" first, then each worker with his open count.
 */
export function WorkerSelect<W extends PickableWorker>({
  id,
  workers,
  value,
  onChange,
  currentWorker = null,
  disabled = false,
  invalid = false,
  emptyText,
}: {
  id: string;
  workers: readonly W[];
  value: string | null;
  onChange: (worker: W | null) => void;
  currentWorker?: WorkerRef | null;
  disabled?: boolean;
  invalid?: boolean;
  /** Shown under the select when nobody can be chosen. */
  emptyText: string;
}) {
  const t = useTranslations('issue.workerPicker');
  const listed = value !== null && workers.some((w) => w.id === value);
  const keepCurrent =
    !listed && currentWorker !== null && currentWorker.id === value;

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={listed || keepCurrent ? (value ?? NONE) : NONE}
        onValueChange={(next) =>
          onChange(
            next === NONE ? null : (workers.find((w) => w.id === next) ?? null),
          )
        }
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={invalid || undefined}
          className="h-12 w-full"
        >
          <SelectValue placeholder={t('none')} />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={NONE}>{t('none')}</SelectItem>
          {keepCurrent && currentWorker && (
            <SelectItem value={currentWorker.id} disabled>
              <span className="truncate font-bold">{currentWorker.name}</span>
            </SelectItem>
          )}
          {workers.map((worker) => (
            <SelectItem key={worker.id} value={worker.id}>
              <span className="truncate font-bold">{worker.name}</span>
              <span className="type-small text-muted-foreground">
                {t('openCount', { count: worker.counts.open })}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {workers.length === 0 && (
        <p className="type-small text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

/** Stands where the worker select goes until a category is chosen. */
export function WorkerNeedsCategory({ id }: { id: string }) {
  const t = useTranslations('issue.workerPicker');
  return (
    <p
      id={id}
      className="flex h-12 items-center rounded-md border-2 border-dashed border-border px-4 type-small text-muted-foreground"
    >
      {t('needsCategory')}
    </p>
  );
}
