'use client';

import { ISSUE_STATUSES, type Locale, directionOf } from '@muayana/shared';
import { Camera, Moon, Plus, Sun, Trash2 } from 'lucide-react';
import {
  type AbstractIntlMessages,
  NextIntlClientProvider,
  useTranslations,
} from 'next-intl';
import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MockInboxPhone } from './mock-inbox-phone';
import { MockIssueCard } from './mock-issue-card';
import { SECTION, STENCIL_SAMPLE, SWATCHES, TYPE_SAMPLES } from './samples';

export function DesignPreview({
  messages,
}: {
  messages: Record<Locale, AbstractIntlMessages>;
}) {
  const [locale, setLocale] = useState<Locale>('ar');
  return (
    // The preview's own language and direction, independent of the app cookie.
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="Africa/Cairo"
    >
      <div
        dir={directionOf(locale)}
        lang={locale}
        data-testid="design-root"
        className="min-h-dvh bg-background text-foreground"
      >
        <Preview locale={locale} onLocale={setLocale} />
      </div>
    </NextIntlClientProvider>
  );
}

const noopSubscribe = () => () => undefined;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b-4 border-foreground pb-2 type-title">{title}</h2>
      {children}
    </section>
  );
}

function Preview({
  locale,
  onLocale,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
}) {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser: render the toggle neutral on the server.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const theme = mounted ? resolvedTheme : undefined;
  const s = (key: keyof typeof SECTION) => SECTION[key]![locale];

  return (
    <>
      <div className="h-4 hazard-stripe" aria-hidden />
      <header className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="type-micro text-primary-ink uppercase">
            {t('app.name')}
          </p>
          <h1 className="type-display">{s('title')}</h1>
          <p className="max-w-prose type-body text-muted-foreground">
            {s('intro')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div role="group" aria-label={s('theme')} className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              <Sun aria-hidden />
              {t('theme.light')}
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              <Moon aria-hidden />
              {t('theme.dark')}
            </Button>
          </div>
          <div role="group" aria-label={s('direction')} className="flex gap-2">
            {(['ar', 'en'] as const).map((l) => (
              <Button
                key={l}
                variant={locale === l ? 'default' : 'outline'}
                aria-pressed={locale === l}
                onClick={() => onLocale(l)}
              >
                {t(`language.${l}`)}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16">
        <Section title={s('palette')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SWATCHES.map((swatch) => (
              <div
                key={swatch.name}
                className={`flex h-24 flex-col justify-end rounded-lg border p-3 ${swatch.fill} ${swatch.text}`}
              >
                <span className="font-mono type-small">{swatch.name}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="type-heading">{s('hazard')}</h3>
            <div className="h-10 rounded-md hazard-stripe" aria-hidden />
          </div>
        </Section>

        <Section title={s('type')}>
          <div className="flex flex-col gap-4">
            {TYPE_SAMPLES.map((sample) => (
              <div
                key={sample.utility}
                className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-6"
              >
                <span className="w-40 shrink-0 font-mono type-micro text-muted-foreground">
                  {sample.label}
                </span>
                <span className={sample.utility}>{sample.text[locale]}</span>
              </div>
            ))}
            <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-6">
              <span className="w-40 shrink-0 font-mono type-micro text-muted-foreground">
                {STENCIL_SAMPLE.label}
              </span>
              <span className="type-stencil type-title" dir="ltr">
                {STENCIL_SAMPLE.text}
              </span>
            </div>
          </div>
        </Section>

        <Section title={s('statuses')}>
          <div data-testid="status-chips" className="flex flex-wrap gap-3">
            {ISSUE_STATUSES.map((status) => (
              <StatusChip key={status} status={status} stamp />
            ))}
            <span className="inline-flex h-7 items-center rounded-sm border-2 border-destructive px-2.5 type-micro font-bold text-destructive uppercase">
              {t('labels.overdue')}
            </span>
          </div>
        </Section>

        <Section title={s('buttons')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">
              <Camera aria-hidden />
              {t('actions.capture')}
            </Button>
            <Button>{t('actions.save')}</Button>
            <Button variant="secondary">{t('actions.skip')}</Button>
            <Button variant="outline">{t('actions.cancel')}</Button>
            <Button variant="ghost">{t('actions.next')}</Button>
            <Button variant="destructive">
              <Trash2 aria-hidden />
              {t('actions.delete')}
            </Button>
            <Button disabled>{t('actions.assign')}</Button>
            <Button size="sm" variant="outline">
              {t('actions.retry')}
            </Button>
            <Button size="icon" aria-label={t('actions.capture')}>
              <Plus aria-hidden />
            </Button>
          </div>
        </Section>

        <Section title={s('fields')}>
          <div className="grid max-w-xl gap-4">
            <div className="grid gap-2">
              <Label htmlFor="design-location">
                {t('fields.location')}
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </Label>
              <Input
                id="design-location"
                required
                placeholder={SECTION.title![locale]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="design-description">
                {t('fields.description')}
              </Label>
              <Textarea
                id="design-description"
                rows={3}
                placeholder={TYPE_SAMPLES[3]!.text[locale]}
              />
            </div>
          </div>
        </Section>

        <div className="grid gap-12 lg:grid-cols-2">
          <Section title={s('card')}>
            <MockIssueCard locale={locale} />
          </Section>
          <Section title={s('inbox')}>
            <MockInboxPhone locale={locale} />
          </Section>
        </div>
      </main>
    </>
  );
}
