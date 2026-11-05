'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import type { Category } from '@muayana/shared';
import { LoadError } from '@/components/load-error';
import { PageHeader } from '@/components/page-header';
import { ShellTitle } from '@/components/shell/shell-title';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { listActiveCategories } from '@/lib/issue-endpoints';
import { ROUTES } from '@/lib/routes';
import { WorkerForm } from '../worker-form';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; categories: Category[] };

/** The new-worker page: the form with its active categories; saved → the worker's page. */
export function NewWorkerScreen() {
  const t = useTranslations('workers');
  const router = useRouter();
  const formId = useId();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const onPendingChange = useCallback((p: boolean) => setPending(p), []);

  useEffect(() => {
    let live = true;
    void listActiveCategories().then((res) => {
      if (live)
        setLoad(
          res.success
            ? { state: 'ready', categories: res.data }
            : { state: 'error' },
        );
    });
    return () => {
      live = false;
    };
  }, [version]);

  return (
    <section
      data-testid="screen-worker-new"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
    >
      <ShellTitle title={t('form.createTitle')} />
      <PageHeader
        title={t('form.createTitle')}
        back={{ href: ROUTES.workers, label: t('form.back') }}
      />
      {load.state === 'loading' ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : load.state === 'error' ? (
        <LoadError
          message={t('loadFailed')}
          onRetry={() => {
            setLoad({ state: 'loading' });
            setVersion((v) => v + 1);
          }}
        />
      ) : (
        <div className="rounded-lg border-2 border-border bg-card p-4 shadow-card md:p-6">
          <WorkerForm
            formId={formId}
            worker={null}
            categories={load.categories}
            onPendingChange={onPendingChange}
            onSaved={(worker) => {
              toast.success(t('toast.created'));
              router.push(`${ROUTES.workers}/${worker.id}`);
            }}
          >
            <Button
              type="submit"
              disabled={pending}
              className="w-full md:w-auto"
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? t('form.saving') : t('form.create')}
            </Button>
          </WorkerForm>
        </div>
      )}
    </section>
  );
}
