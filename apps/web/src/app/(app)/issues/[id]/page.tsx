import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { UuidSchema, type IssueDetail } from '@muayana/shared';
import { serverFetch } from '@/lib/api-server';
import { IssueView } from './issue-view';

/** One issue, read on the server so the first paint is the issue itself. */
export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) notFound();

  const res = await serverFetch<IssueDetail>(`/issues/${id}`);
  if (!res.success) {
    if (res.status === 404) notFound();
    const t = await getTranslations('issue.errors');
    return (
      <p role="alert" className="type-body text-destructive">
        {t(res.error === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'generic')}
      </p>
    );
  }
  return <IssueView key={res.data.id} initial={res.data} />;
}
