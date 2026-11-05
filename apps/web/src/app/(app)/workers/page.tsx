import { getTranslations } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/shell/app-shell';

/** Placeholder until its screen lands; the shell and nav already lead here. */
export default async function Page() {
  const t = await getTranslations('shell');
  return (
    <PlaceholderScreen testId="screen-workers" body={t('placeholder.body')} />
  );
}
