'use client';

import type { Locale } from '@muayana/shared';
import { Camera, ChevronDown, House, Inbox, List, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { MOCK_CATEGORIES, MOCK_INBOX } from './samples';

/** Mock of the one-at-a-time sort inbox on a phone (T11), with the bottom nav and shutter (T2). */
export function MockInboxPhone({ locale }: { locale: Locale }) {
  const t = useTranslations('common');
  const [chosen, setChosen] = useState(2);

  return (
    <div className="mx-auto flex h-[44rem] w-full max-w-[24rem] flex-col overflow-hidden rounded-xl border-4 border-foreground bg-background shadow-float">
      <header className="flex flex-col">
        <div className="h-2 hazard-stripe" aria-hidden />
        <div className="flex items-center justify-between gap-2 bg-foreground px-4 py-3 text-background">
          <span className="truncate type-heading">
            {MOCK_INBOX.site[locale]}
          </span>
          <span className="rounded-sm bg-primary px-2 py-0.5 type-small font-bold text-primary-foreground">
            {t('labels.inboxLeft', { count: MOCK_INBOX.left })}
          </span>
        </div>
      </header>

      <div className="flex scrollbar-clean min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <div className="relative aspect-[4/3] w-full shrink-0 rounded-lg bg-linear-to-br from-secondary to-muted">
          <span className="absolute start-3 bottom-3 rounded-sm bg-foreground/80 px-2 py-1 type-small text-background">
            {MOCK_INBOX.captured[locale]}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="type-small font-bold">{t('fields.category')}</span>
          <div className="flex flex-wrap gap-2">
            {MOCK_CATEGORIES.map((category, index) => (
              <button
                key={category.name.en}
                type="button"
                aria-pressed={chosen === index}
                onClick={() => setChosen(index)}
                className={cn(
                  'inline-flex h-11 press items-center gap-2 rounded-md border-2 px-3 type-small font-bold',
                  chosen === index
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card',
                )}
              >
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                {category.name[locale]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="inbox-description">
            {t('fields.description')}
            <span aria-hidden className="text-destructive">
              *
            </span>
          </Label>
          <Textarea
            id="inbox-description"
            rows={3}
            required
            placeholder={MOCK_INBOX.descriptionPlaceholder[locale]}
          />
        </div>

        <button
          type="button"
          className="flex h-12 press cursor-pointer items-center justify-between rounded-md border-2 border-input bg-card px-4 text-start"
        >
          <span className="flex flex-col">
            <span className="type-micro text-muted-foreground">
              {t('fields.worker')}
            </span>
            <span className="type-small">{MOCK_INBOX.workerValue[locale]}</span>
          </span>
          <ChevronDown className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex gap-2 border-t-2 border-foreground/10 bg-card p-3">
        <Button variant="outline" className="flex-1">
          {t('actions.skip')}
        </Button>
        <Button className="flex-[2]">{t('actions.next')}</Button>
      </div>

      <nav className="grid grid-cols-5 items-end border-t bg-card px-1 pt-1 pb-safe">
        <NavItem icon={House} label={t('nav.dashboard')} />
        <NavItem icon={List} label={t('nav.issues')} />
        <div className="flex justify-center">
          <span className="-mt-6 flex size-16 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-float">
            <Camera className="size-7" aria-hidden />
            <span className="sr-only">{t('nav.capture')}</span>
          </span>
        </div>
        <NavItem icon={Inbox} label={t('nav.inbox')} active />
        <NavItem icon={Users} label={t('nav.workers')} />
      </nav>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        'flex min-h-12 flex-col items-center justify-center gap-0.5 type-micro',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('size-6', active && 'text-primary-ink')} />
      {label}
    </span>
  );
}
