'use client';

import {
  CircleOff,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Power,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import {
  ISSUE_STATUSES,
  type Category,
  type Issue,
  type IssueStatus,
  type Worker,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { IssueRow } from '@/components/issue-row';
import { LoadError } from '@/components/load-error';
import { PageHeader } from '@/components/page-header';
import { BatchSendToWorker } from '@/components/send/send-to-worker';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import { categoryName } from '@/lib/category-name';
import {
  deleteWorker,
  getWorker,
  listWorkerIssues,
  updateWorker,
} from '@/lib/directory-endpoints';
import { listActiveCategories } from '@/lib/issue-endpoints';
import { ROUTES } from '@/lib/routes';
import { telUrl, whatsappChatUrl } from '@/lib/whatsapp-share';
import { WorkerForm } from '../worker-form';
import { InactiveBadge, WorkerAvatar, WorkerCountChips } from '../worker-bits';

type IssuesLoad =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; issues: Issue[] };

/** The worker's issues grouped by status, in workflow order; empty groups left out (§5.7). */
export function groupByStatus(
  issues: readonly Issue[],
): { status: IssueStatus; issues: Issue[] }[] {
  return ISSUE_STATUSES.map((status) => ({
    status,
    issues: issues.filter((i) => i.status === status),
  })).filter((g) => g.issues.length > 0);
}

/**
 * A worker's page (business §5.7): call and WhatsApp, categories, notes, counts, his issues by
 * status, and the batch send of his `assigned` issues (§5.5). Edit, deactivate / activate, and
 * delete only without issues — one with issues offers "Deactivate instead" (invariant §6.8).
 */
export function WorkerView({ initial }: { initial: Worker }) {
  const t = useTranslations('workers');
  const tStatus = useTranslations('common.status');
  const locale = useLocale();
  const router = useRouter();
  const errorText = useApiErrorText();
  const [worker, setWorker] = useState(initial);
  const [issues, setIssues] = useState<IssuesLoad>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Category[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteInUse, setDeleteInUse] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const action = usePendingAction();
  const openingEdit = usePendingAction();

  useEffect(() => {
    let live = true;
    void listWorkerIssues(worker.id).then((res) => {
      if (live)
        setIssues(
          res.success
            ? { state: 'ready', issues: res.data }
            : { state: 'error' },
        );
    });
    return () => {
      live = false;
    };
  }, [worker.id, version]);

  const reloadIssues = useCallback(() => setVersion((v) => v + 1), []);

  async function refreshWorker() {
    const res = await getWorker(worker.id);
    if (res.success) setWorker(res.data);
  }

  async function setActive(active: boolean) {
    await action.run(async () => {
      const res = await updateWorker(worker.id, { active });
      if (res.success) {
        setWorker(res.data);
        setDeleting(false);
        toast.success(t(active ? 'toast.activated' : 'toast.deactivated'));
      } else if (res.status !== 401) toast.error(errorText(res));
    });
  }

  async function openEdit() {
    await openingEdit.run(async () => {
      const res = await listActiveCategories();
      if (res.success) setEditing(res.data);
      else if (res.status !== 401) toast.error(errorText(res));
    });
  }

  const issueCount =
    issues.state === 'ready'
      ? issues.issues.length
      : worker.counts.open + worker.counts.solved;

  function askDelete() {
    setDeleteError(null);
    setDeleteInUse(issueCount > 0);
    setDeleting(true);
  }

  async function confirmDelete() {
    await action.run(async () => {
      const res = await deleteWorker(worker.id);
      if (res.success) {
        toast.success(t('toast.deleted'));
        router.push(ROUTES.workers);
      } else if (res.status === 409) setDeleteInUse(true);
      else if (res.status !== 401) setDeleteError(errorText(res));
    });
  }

  return (
    <section
      data-testid="screen-worker"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
    >
      <PageHeader
        title={worker.name}
        back={{ href: ROUTES.workers, label: t('form.back') }}
      />

      <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <WorkerAvatar name={worker.name} className="size-14" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-small font-bold text-muted-foreground">
                {t('detail.openCount', { count: worker.counts.open })}
              </span>
              {!worker.active && <InactiveBadge />}
            </div>
            <span className="font-mono type-body" dir="ltr">
              {worker.phone}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <a href={telUrl(worker.phone)}>
              <Phone aria-hidden />
              {t('call')}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={whatsappChatUrl(worker.phone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="text-success" aria-hidden />
              {t('whatsappButton')}
            </a>
          </Button>
        </div>
        <WorkerCountChips counts={worker.counts} withSolved />
        <div className="flex flex-col gap-2">
          <h3 className="type-small font-bold">{t('detail.categories')}</h3>
          <ul className="flex flex-wrap gap-2">
            {worker.categories.map((category) => (
              <li
                key={category.id}
                className="inline-flex h-9 items-center gap-2 rounded-md border-2 border-border px-3 type-small font-bold"
              >
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                {categoryName(category, locale)}
              </li>
            ))}
          </ul>
        </div>
        {worker.notes && (
          <div className="flex flex-col gap-1">
            <h3 className="type-small font-bold">{t('detail.notes')}</h3>
            <p className="type-body break-words whitespace-pre-line">
              {worker.notes}
            </p>
          </div>
        )}
      </div>

      {issues.state === 'ready' ? (
        <BatchSendToWorker
          worker={worker}
          issues={issues.issues}
          onSent={() => {
            reloadIssues();
            void refreshWorker();
          }}
        />
      ) : (
        <Skeleton className="h-12 w-full rounded-md" />
      )}

      <div className="flex flex-col gap-3">
        <h3 className="type-heading">{t('detail.issues')}</h3>
        {issues.state === 'loading' ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : issues.state === 'error' ? (
          <LoadError
            message={t('detail.issuesFailed')}
            onRetry={() => {
              setIssues({ state: 'loading' });
              reloadIssues();
            }}
          />
        ) : issues.issues.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-border p-4 type-body text-muted-foreground">
            {t('detail.noIssues')}
          </p>
        ) : (
          groupByStatus(issues.issues).map((group) => (
            <section
              key={group.status}
              data-group={group.status}
              aria-label={tStatus(group.status)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <StatusChip status={group.status} />
                <span className="type-stencil text-muted-foreground">
                  {group.issues.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {group.issues.map((issue) => (
                  <li key={issue.id}>
                    <IssueRow issue={issue} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t-2 border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={openingEdit.pending}
          onClick={() => void openEdit()}
        >
          {openingEdit.pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Pencil aria-hidden />
          )}
          {t('actions.edit')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={action.pending}
          onClick={() => void setActive(!worker.active)}
        >
          {action.pending && !deleting ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : worker.active ? (
            <CircleOff aria-hidden />
          ) : (
            <Power aria-hidden />
          )}
          {t(worker.active ? 'actions.deactivate' : 'actions.activate')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          onClick={askDelete}
        >
          <Trash2 aria-hidden />
          {t('actions.delete')}
        </Button>
      </div>

      {editing && (
        <EditWorkerSheet
          worker={worker}
          categories={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setWorker(saved);
            setEditing(null);
            toast.success(t('toast.saved'));
          }}
        />
      )}

      <ConfirmSheet
        open={deleting}
        onOpenChange={setDeleting}
        title={t(deleteInUse ? 'delete.inUseTitle' : 'delete.title')}
        body={t(deleteInUse ? 'delete.inUseBody' : 'delete.body')}
        confirmLabel={t('delete.confirm')}
        destructive
        busy={action.pending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        alternative={
          !deleteInUse ? undefined : worker.active ? (
            <Button
              type="button"
              disabled={action.pending}
              onClick={() => void setActive(false)}
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

function EditWorkerSheet({
  worker,
  categories,
  onClose,
  onSaved,
}: {
  worker: Worker;
  categories: Category[];
  onClose: () => void;
  onSaved: (worker: Worker) => void;
}) {
  const t = useTranslations('workers.form');
  const tCommon = useTranslations('common.actions');
  const formId = useId();
  const [pending, setPending] = useState(false);
  const onPendingChange = useCallback((p: boolean) => setPending(p), []);

  return (
    <BottomSheet
      open
      onOpenChange={(open) => !open && !pending && onClose()}
      title={t('editTitle')}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t('saving') : t('save')}
          </Button>
        </>
      }
    >
      <WorkerForm
        formId={formId}
        worker={worker}
        categories={categories}
        onPendingChange={onPendingChange}
        onSaved={onSaved}
      />
    </BottomSheet>
  );
}
