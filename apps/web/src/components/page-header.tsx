import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * A sub-page's header: the way back (to the parent screen), the page title and its actions at the
 * end. The top bar keeps the section name.
 */
export function PageHeader({
  title,
  back,
  actions,
}: {
  title: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 type-small font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 flip-rtl" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 type-title break-words">{title}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
