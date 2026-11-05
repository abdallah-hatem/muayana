import { getTranslations } from 'next-intl/server';
import { safeNext } from '@/lib/routes';
import { LoginForm } from './login-form';

/** Sign-in. Signed-in visitors never see it: the proxy sends them home. */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const t = await getTranslations('common');
  const tAuth = await getTranslations('auth');

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="h-4 hazard-stripe" aria-hidden />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-md flex-col gap-8">
          <header className="flex flex-col gap-2">
            <span className="w-fit rounded-sm bg-primary px-2 py-0.5 type-micro text-primary-foreground uppercase">
              {tAuth('title')}
            </span>
            <h1 className="type-display">{t('app.name')}</h1>
            <p className="type-body text-muted-foreground">
              {t('app.tagline')}
            </p>
          </header>
          <LoginForm next={safeNext(typeof next === 'string' ? next : null)} />
          <p className="type-small text-muted-foreground">
            {tAuth('operatorNote')}
          </p>
        </div>
      </div>
      <div className="h-2 hazard-stripe" aria-hidden />
    </main>
  );
}
