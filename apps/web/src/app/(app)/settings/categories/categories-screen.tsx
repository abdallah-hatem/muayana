'use client';

import {
  ArrowDown,
  ArrowUp,
  CircleOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Power,
  Tags,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Category } from '@muayana/shared';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { EmptyState } from '@/components/empty-state';
import { LoadError } from '@/components/load-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import { categoryName } from '@/lib/category-name';
import { nextFreeColor } from '@/lib/category-palette';
import {
  deleteCategory,
  listAllCategories,
  reorderCategories,
  updateCategory,
} from '@/lib/directory-endpoints';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { CategoryFormSheet } from './category-form-sheet';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; categories: Category[] };

type Editing = { category: Category | null; key: number } | null;

/** `list` with the item at `from` moved to `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const byOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder;

/**
 * Categories (business §3): add, rename, recolour, reorder (drag or up/down, saved as the whole
 * order), deactivate / activate, and delete only an unused one — one in use offers "Deactivate
 * instead".
 */
export function CategoriesScreen() {
  const t = useTranslations('categories');
  const locale = useLocale();
  const errorText = useApiErrorText();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [deleteInUse, setDeleteInUse] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const action = usePendingAction();
  const reorder = usePendingAction();
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    void listAllCategories().then((res) => {
      if (!live) return;
      setLoad(
        res.success
          ? { state: 'ready', categories: [...res.data].sort(byOrder) }
          : { state: 'error' },
      );
    });
    return () => {
      live = false;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const categories = load.state === 'ready' ? load.categories : [];

  function replace(updated: Category) {
    setLoad({
      state: 'ready',
      categories: categories.map((c) => (c.id === updated.id ? updated : c)),
    });
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= categories.length || from === to) return;
    const before = categories;
    const next = moveItem(before, from, to);
    setLoad({ state: 'ready', categories: next });
    await reorder.run(async () => {
      const res = await reorderCategories(next.map((c) => c.id));
      if (res.success)
        setLoad({ state: 'ready', categories: [...res.data].sort(byOrder) });
      else {
        setLoad({ state: 'ready', categories: before });
        if (res.status !== 401) toast.error(t('reorder.failed'));
      }
    });
  }

  async function setActive(category: Category, active: boolean) {
    await action.run(async () => {
      setBusyId(category.id);
      const res = await updateCategory(category.id, { active });
      setBusyId(null);
      if (res.success) {
        replace(res.data);
        setDeleting(null);
        toast.success(t(active ? 'toast.activated' : 'toast.deactivated'));
      } else if (res.status !== 401) toast.error(errorText(res));
    });
  }

  function askDelete(category: Category) {
    setDeleteError(null);
    setDeleteInUse(category.counts.open > 0 || category.counts.workers > 0);
    setDeleting(category);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await action.run(async () => {
      const res = await deleteCategory(deleting.id);
      if (res.success) {
        setLoad({
          state: 'ready',
          categories: categories.filter((c) => c.id !== deleting.id),
        });
        setDeleting(null);
        toast.success(t('toast.deleted'));
      } else if (res.status === 409) setDeleteInUse(true);
      else if (res.status !== 401) setDeleteError(errorText(res));
    });
  }

  const newButton = (
    <Button
      type="button"
      disabled={load.state !== 'ready'}
      onClick={() => setEditing({ category: null, key: Date.now() })}
    >
      <Plus aria-hidden />
      {t('new')}
    </Button>
  );

  return (
    <section
      data-testid="screen-categories"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
    >
      <PageHeader
        title={t('title')}
        back={{ href: ROUTES.settings, label: t('back') }}
        actions={newButton}
      />
      <p className="type-small text-muted-foreground">{t('hint')}</p>

      {load.state === 'loading' ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : load.state === 'error' ? (
        <LoadError
          message={t('loadFailed')}
          onRetry={() => {
            setLoad({ state: 'loading' });
            reload();
          }}
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={t('empty.title')}
          body={t('empty.body')}
          action={newButton}
        />
      ) : (
        <ol
          aria-label={t('title')}
          aria-busy={reorder.pending}
          className="flex flex-col gap-2"
        >
          {categories.map((category, index) => {
            const name = categoryName(category, locale);
            const other = locale === 'en' ? category.nameAr : category.nameEn;
            return (
              <li
                key={category.id}
                data-testid="category-row"
                draggable={!reorder.pending}
                onDragStart={(e) => {
                  dragFrom.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragFrom.current !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  if (from !== null) void move(from, index);
                }}
                onDragEnd={() => (dragFrom.current = null)}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border-2 border-border bg-card p-3 shadow-card md:flex-row md:items-center',
                  !category.active && 'bg-muted',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <GripVertical
                    className="hidden size-5 shrink-0 cursor-grab text-muted-foreground md:block"
                    aria-label={t('reorder.handle', { name })}
                  />
                  <span
                    className="size-8 shrink-0 rounded-md border-2 border-border"
                    style={{ backgroundColor: category.color }}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 type-body font-bold break-words">
                        {name}
                      </span>
                      {!category.active && (
                        <span className="shrink-0 rounded-sm bg-background px-2 py-0.5 type-micro font-bold text-muted-foreground uppercase">
                          {t('inactiveBadge')}
                        </span>
                      )}
                    </div>
                    {other && other !== name && (
                      <span className="truncate type-small text-muted-foreground">
                        {other}
                      </span>
                    )}
                    <span className="type-small text-muted-foreground">
                      {t('counts', {
                        open: category.counts.open,
                        workers: category.counts.workers,
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('reorder.up', { name })}
                    disabled={reorder.pending || index === 0}
                    onClick={() => void move(index, index - 1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('reorder.down', { name })}
                    disabled={
                      reorder.pending || index === categories.length - 1
                    }
                    onClick={() => void move(index, index + 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ category, key: Date.now() })}
                  >
                    <Pencil aria-hidden />
                    {t('actions.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={action.pending}
                    onClick={() => void setActive(category, !category.active)}
                  >
                    {busyId === category.id ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : category.active ? (
                      <CircleOff aria-hidden />
                    ) : (
                      <Power aria-hidden />
                    )}
                    {t(
                      category.active
                        ? 'actions.deactivate'
                        : 'actions.activate',
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => askDelete(category)}
                  >
                    <Trash2 aria-hidden />
                    {t('actions.delete')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <CategoryFormSheet
          key={editing.key}
          open
          category={editing.category}
          defaultColor={nextFreeColor(categories.map((c) => c.color))}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            toast.success(t(created ? 'toast.created' : 'toast.saved'));
            if (created)
              setLoad({ state: 'ready', categories: [...categories, saved] });
            else replace(saved);
          }}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t(deleteInUse ? 'delete.inUseTitle' : 'delete.title')}
        body={t(deleteInUse ? 'delete.inUseBody' : 'delete.body')}
        confirmLabel={t('delete.confirm')}
        destructive
        busy={action.pending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        alternative={
          !deleteInUse ? undefined : deleting?.active ? (
            <Button
              type="button"
              disabled={action.pending}
              onClick={() => void setActive(deleting, false)}
            >
              {action.pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <CircleOff aria-hidden />
              )}
              {t('delete.deactivateInstead')}
            </Button>
          ) : null
        }
      />
    </section>
  );
}
