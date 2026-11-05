'use client';

import { Languages, Loader2, Moon, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import type { Locale } from '@muayana/shared';
import { SiteSwitcher } from '@/components/site/site-switcher';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';
import { NAV_ITEMS, isActive } from './nav-items';
import { useShellTitleOverride } from './shell-title';
import { useSwitchLocale } from './use-switch-locale';

/** Title (slot) and site switcher at the start; language, theme and settings at the end. */
export function TopBar() {
  const title = useDefaultTitle();
  const override = useShellTitleOverride();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b-2 border-border bg-background/95 px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate type-title">{override ?? title}</h1>
        <SiteSwitcher />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
        <SettingsLink />
      </div>
    </header>
  );
}

/** The current section's name: its nav label, or Settings. */
function useDefaultTitle(): string {
  const t = useTranslations('common');
  const pathname = usePathname();
  if (isActive(pathname, ROUTES.settings)) return t('nav.settings');
  const item = NAV_ITEMS.find((i) => isActive(pathname, i.href));
  return item ? t(`nav.${item.key}`) : t('app.name');
}

function LanguageToggle() {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  const { switchTo, busy } = useSwitchLocale();
  const label = t('switchLanguage', { language: tCommon(`language.${other}`) });

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={() => void switchTo(other)}
      lang={other}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        <Languages className="size-5" aria-hidden />
      )}
      <span className="hidden sm:inline">{tCommon(`language.${other}`)}</span>
    </Button>
  );
}

function ThemeToggle() {
  const t = useTranslations('shell');
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('toggleTheme')}
      title={t('toggleTheme')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {/* Both icons rendered; CSS picks one, so server and client markup match. */}
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </Button>
  );
}

function SettingsLink() {
  const t = useTranslations('shell');
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link
        href={ROUTES.settings}
        aria-label={t('openSettings')}
        title={t('openSettings')}
      >
        <Settings className="size-5" aria-hidden />
      </Link>
    </Button>
  );
}
