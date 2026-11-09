'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Issue } from '@muayana/shared';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { Button } from '@/components/ui/button';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import { deleteIssue } from '@/lib/issue-endpoints';
import { ROUTES } from '@/lib/routes';

/**
 * Delete permanently, in any status (business §3): a confirm naming the number and photo count,
 * then back to the list (the inbox for a `new` one) with a toast. Cancel sends nothing; a double
 * tap sends one request.
 */
export function DeleteIssue({ issue }: { issue: Issue }) {
  const t = useTranslations('issue.delete');
  const errorText = useApiErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = usePendingAction();

  async function remove() {
    await action.run(async () => {
      setError(null);
      const res = await deleteIssue(issue.id);
      if (res.success) {
        toast.success(t('done', { number: issue.number }));
        router.replace(issue.status === 'new' ? ROUTES.inbox : ROUTES.issues);
      } else if (res.status !== 401) setError(errorText(res));
    });
  }

  return (
    <section className="flex flex-col border-t-2 border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        className="self-start text-destructive"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden />
        {t('button')}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t('title', { number: issue.number })}
        body={t('body', { number: issue.number, count: issue.photos.length })}
        confirmLabel={t('confirm')}
        destructive
        busy={action.pending}
        error={error}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
