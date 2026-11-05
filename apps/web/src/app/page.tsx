import { getTranslations } from 'next-intl/server';

/** Placeholder home until T2's app shell; the design system preview lives at /design. */
export default async function HomePage() {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="h-3 hazard-stripe" aria-hidden />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="type-display">{t('app.name')}</h1>
        <p className="type-body text-muted-foreground">{t('app.tagline')}</p>
      </div>
    </main>
  );
}
