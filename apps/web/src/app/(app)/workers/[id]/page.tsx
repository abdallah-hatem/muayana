import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { UuidSchema, type Worker } from '@muayana/shared';
import { serverFetch } from '@/lib/api-server';
import { WorkerView } from './worker-view';

/** One worker, read on the server so the first paint is the worker himself. */
export default async function WorkerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) notFound();

  const res = await serverFetch<Worker>(`/workers/${id}`);
  if (!res.success) {
    if (res.status === 404) notFound();
    const t = await getTranslations('workers');
    return (
      <p role="alert" className="type-body text-destructive">
        {t('loadFailed')}
      </p>
    );
  }
  return <WorkerView key={res.data.id} initial={res.data} />;
}
