import { notFound } from 'next/navigation';
import { loadMessages } from '@/i18n/messages';
import { DesignPreview } from './design-preview';

export const metadata = { robots: { index: false } };

/** Dev-only design system preview (docs/DESIGN.md). Never served in production. */
export default async function DesignPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const [ar, en] = await Promise.all([loadMessages('ar'), loadMessages('en')]);
  return <DesignPreview messages={{ ar, en }} />;
}
