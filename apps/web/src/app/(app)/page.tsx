import { getTranslations } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/shell/app-shell';

/** Dashboard placeholder until T12. */
export default async function DashboardPage() {
  const t = await getTranslations('shell');
  return (
    <PlaceholderScreen testId="screen-dashboard" body={t('placeholder.body')} />
  );
}
