import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Kind = 'page' | 'issue' | 'worker';

/** Where the way back leads. */
const BACK_TO: Record<Kind, string> = {
  page: '/',
  issue: '/issues',
  worker: '/workers',
};

/**
 * "Nothing here": hazard tape, what's missing, and the one way back. Rendered by the not-found
 * boundaries — `kind` picks the copy and where the button goes. `fullPage` centres it on a bare
 * page (an address outside the signed-in shell).
 */
export async function NotFoundView({
  kind = 'page',
  fullPage = false,
}: {
  kind?: Kind;
  fullPage?: boolean;
}) {
  const t = await getTranslations('errors.notFound');
  const copy =
    kind === 'page'
      ? { title: t('title'), body: t('body'), action: t('home') }
      : {
          title: t(`${kind}.title`),
          body: t(`${kind}.body`),
          action: t(`${kind}.back`),
        };

  return (
    <section
      data-testid="not-found"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border bg-card p-8 text-center',
        fullPage ? 'w-[calc(100%-2rem)] max-w-md' : 'mx-auto w-full max-w-lg',
      )}
    >
      <div className="h-3 w-24 rounded-sm hazard-stripe" aria-hidden />
      <SearchX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="type-title">{copy.title}</h1>
      <p className="type-body text-muted-foreground">{copy.body}</p>
      <Button asChild className="mt-2">
        <Link href={BACK_TO[kind]}>{copy.action}</Link>
      </Button>
    </section>
  );
}
