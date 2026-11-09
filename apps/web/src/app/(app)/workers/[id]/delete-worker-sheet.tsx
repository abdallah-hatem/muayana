'use client';

import { Archive, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  DomainErrorCode,
  WorkerIssuesSummarySchema,
  isClosed,
  type Issue,
  type Worker,
  type WorkerIssuesChoice,
  type WorkerIssuesSummary,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { Button } from '@/components/ui/button';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import { deleteWorker } from '@/lib/directory-endpoints';
import { cn } from '@/lib/utils';

/** What deleting him would touch, from his loaded issues (the same counts the API's 409 sends). */
export function issuesSummaryOf(issues: readonly Issue[]): WorkerIssuesSummary {
  const count = (status: 'solved' | 'cancelled') =>
    issues.filter((i) => i.status === status).length;
  return {
    open: issues.filter((i) => !isClosed(i.status)).length,
    solved: count('solved'),
    cancelled: count('cancelled'),
    total: issues.length,
    photos: issues.reduce((sum, i) => sum + i.photos.length, 0),
  };
}

type Step = 'choose' | 'destroy';

/**
 * Deleting a worker (business §3, §6.8). Without issues: a plain confirm. With issues: his counts
 * and two choices — keep the issues (unassign them), or delete them too, which is red and asks
 * once more before anything is sent. Cancel never sends a request; a double tap sends one. If the
 * plain confirm meets issues the page didn't know about (409 WORKER_HAS_ISSUES), the API's counts
 * turn it into the choice.
 */
export function DeleteWorkerSheet({
  worker,
  summary: known,
  open,
  onOpenChange,
  onDeleted,
}: {
  worker: Pick<Worker, 'id' | 'name'>;
  summary: WorkerIssuesSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (choice: WorkerIssuesChoice | null) => void;
}) {
  const t = useTranslations('workers.delete');
  const tCommon = useTranslations('common.actions');
  const errorText = useApiErrorText();
  const action = usePendingAction();
  const [step, setStep] = useState<Step>('choose');
  const [sending, setSending] = useState<WorkerIssuesChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<WorkerIssuesSummary | null>(null);
  const summary = found ?? known;

  function change(next: boolean) {
    if (action.pending) return;
    if (!next) {
      setStep('choose');
      setError(null);
    }
    onOpenChange(next);
  }

  async function remove(choice: WorkerIssuesChoice | null) {
    await action.run(async () => {
      setSending(choice);
      setError(null);
      const res = await deleteWorker(worker.id, choice ?? undefined);
      setSending(null);
      if (res.success) {
        onDeleted(choice);
        return;
      }
      const counts =
        res.error === DomainErrorCode.WORKER_HAS_ISSUES
          ? WorkerIssuesSummarySchema.safeParse(res.data)
          : null;
      if (counts?.success) {
        setFound(counts.data);
        setStep('choose');
      } else if (res.status !== 401) setError(errorText(res));
    });
  }

  if (summary.total === 0)
    return (
      <ConfirmSheet
        open={open}
        onOpenChange={change}
        title={t('title')}
        body={t('body')}
        confirmLabel={t('confirm')}
        destructive
        busy={action.pending}
        error={error}
        onConfirm={() => void remove(null)}
      />
    );

  const amounts = { issues: summary.total, photos: summary.photos };
  const alert = error && (
    <p role="alert" className="type-small font-bold text-destructive">
      {error}
    </p>
  );

  if (step === 'destroy')
    return (
      <BottomSheet
        open={open}
        onOpenChange={change}
        testId="delete-worker-destroy"
        title={t('destroyTitle')}
        description={t('destroyBody', { name: worker.name, ...amounts })}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={action.pending}
              onClick={() => setStep('choose')}
            >
              {t('back')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={action.pending}
              onClick={() => void remove('delete')}
            >
              {action.pending && (
                <Loader2 className="animate-spin" aria-hidden />
              )}
              {t('destroyConfirm')}
            </Button>
          </>
        }
      >
        {alert}
      </BottomSheet>
    );

  return (
    <BottomSheet
      open={open}
      onOpenChange={change}
      testId="delete-worker-choose"
      title={t('withIssuesTitle', { name: worker.name })}
      description={t('withIssuesBody', {
        issues: summary.total,
        open: summary.open,
        solved: summary.solved,
        cancelled: summary.cancelled,
      })}
      footer={
        <Button
          type="button"
          variant="outline"
          disabled={action.pending}
          onClick={() => change(false)}
        >
          {tCommon('cancel')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <ChoiceButton
          icon={
            sending === 'keep' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Archive aria-hidden />
            )
          }
          label={t('keep')}
          hint={t('keepHint')}
          disabled={action.pending}
          onClick={() => void remove('keep')}
        />
        <ChoiceButton
          destructive
          icon={<Trash2 aria-hidden />}
          label={t('destroy', amounts)}
          hint={t('destroyHint')}
          disabled={action.pending}
          onClick={() => {
            setError(null);
            setStep('destroy');
          }}
        />
        {alert}
      </div>
    </BottomSheet>
  );
}

/** One of the two answers: a full-width card button with a line saying what it does. */
function ChoiceButton({
  icon,
  label,
  hint,
  destructive = false,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  destructive?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-14 w-full cursor-pointer items-start gap-3 rounded-lg border-2 p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0',
        destructive
          ? 'border-destructive text-destructive hover:bg-destructive/10'
          : 'border-border bg-card hover:bg-accent',
      )}
    >
      {icon}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-bold break-words">{label}</span>
        <span
          className={cn(
            'type-small',
            destructive ? 'text-destructive/90' : 'text-muted-foreground',
          )}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}
