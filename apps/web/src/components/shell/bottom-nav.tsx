'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueueCount } from '@/lib/offline-queue';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isActive, type NavItem } from './nav-items';

/**
 * The app's main navigation: a bottom bar on the phone with the capture shutter raised in the
 * middle (the biggest thing on screen, in thumb reach), a side rail on the start edge from md up.
 */
export function BottomNav() {
  const t = useTranslations('common');
  const tShell = useTranslations('shell');
  const pathname = usePathname();

  return (
    <nav
      aria-label={tShell('mainNav')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t-2 border-border bg-card px-1 pt-1 pb-safe',
        'md:inset-x-auto md:start-0 md:top-0 md:flex md:w-24 md:flex-col md:items-stretch md:justify-start md:gap-1 md:border-e-2 md:border-t-0 md:px-2 md:pt-4',
      )}
    >
      {NAV_ITEMS.map((item) =>
        item.shutter ? (
          <Shutter
            key={item.key}
            item={item}
            label={t(`nav.${item.key}`)}
            active={isActive(pathname, item.href)}
          />
        ) : (
          <NavLink
            key={item.key}
            item={item}
            // Short words (`navShort`) that fit a fifth of a 360px phone; the top bar shows the full name.
            label={t(`navShort.${item.key}`)}
            active={isActive(pathname, item.href)}
          />
        ),
      )}
    </nav>
  );
}

interface ItemProps {
  item: NavItem;
  label: string;
  active: boolean;
}

function NavLink({ item: { href, icon: Icon }, label, active }: ItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-14 press cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md type-micro',
        'hover:bg-accent md:min-h-16',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon
        className={cn('size-6', active && 'text-primary-ink')}
        aria-hidden
      />
      <span className="max-w-full truncate px-0.5">{label}</span>
    </Link>
  );
}

function Shutter({ item: { href, icon: Icon }, label, active }: ItemProps) {
  const t = useTranslations('capture.queue');
  const waiting = useQueueCount();
  return (
    <div className="relative flex justify-center md:order-first md:mb-3">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={cn(
          '-mt-10 flex size-18 press cursor-pointer items-center justify-center rounded-full border-[6px] border-card bg-primary text-primary-foreground shadow-float ring-3 ring-primary',
          'hover:bg-primary-strong md:mt-0 md:size-16 md:border-4',
        )}
      >
        <Icon className="size-8 md:size-7" aria-hidden />
      </Link>
      {waiting > 0 && (
        <span
          data-testid="shutter-badge"
          aria-label={t('chip', { count: waiting })}
          className="pointer-events-none absolute end-[calc(50%-2.75rem)] -top-9 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-status-new px-1.5 type-stencil text-xs text-status-new-foreground md:end-1 md:-top-1"
        >
          {waiting}
        </span>
      )}
    </div>
  );
}
