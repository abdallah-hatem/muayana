'use client';

import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Tags,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  LOCALES,
  PASSWORD_MIN_LENGTH,
  USER_NAME_MAX_LENGTH,
  type Locale,
  type User,
} from '@muayana/shared';
import { FormField } from '@/components/form-field';
import { useSwitchLocale } from '@/components/shell/use-switch-locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authRoute, clientFetch } from '@/lib/api-client';
import type { ApiFailure } from '@/lib/api-result';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border-2 border-border bg-card p-4 shadow-card md:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="type-heading">{title}</h2>
        {hint && <p className="type-small text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** The translated message for a failed call that isn't a field error. */
function useFailureMessage() {
  const t = useTranslations('shell');
  return (res: ApiFailure) =>
    t(
      res.error === 'NETWORK_ERROR' ? 'errors.NETWORK_ERROR' : 'errors.generic',
    );
}

function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Links to the sites and categories managers. */
export function ManageSection() {
  const t = useTranslations('settings.manage');
  const links = [
    {
      href: `${ROUTES.settings}/sites`,
      icon: Building2,
      label: t('sites'),
      hint: t('sitesHint'),
    },
    {
      href: `${ROUTES.settings}/categories`,
      icon: Tags,
      label: t('categories'),
      hint: t('categoriesHint'),
    },
  ];
  return (
    <Section title={t('title')} hint={t('hint')}>
      <ul className="flex flex-col gap-2">
        {links.map(({ href, icon: Icon, label, hint }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-2 border-border bg-background px-4 py-2 hover:bg-accent"
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="type-body font-bold">{label}</span>
                <span className="type-small text-muted-foreground">{hint}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 flip-rtl" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ProfileSection({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const t = useTranslations('settings.profile');
  const failure = useFailureMessage();
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!value.trim()) return setError(t('nameRequired'));
    setError(undefined);
    setPending(true);
    const res = await clientFetch<User>('/auth/me', {
      method: 'PATCH',
      body: { name: value.trim() },
    });
    setPending(false);
    if (res.success) {
      setValue(res.data.name);
      toast.success(t('saved'));
      router.refresh();
    } else if (res.status !== 401) toast.error(failure(res));
  }

  return (
    <Section title={t('title')}>
      <form
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-4"
      >
        <FormField id="profile-name" label={t('name')} required error={error}>
          <Input
            id="profile-name"
            name="name"
            required
            autoComplete="name"
            maxLength={USER_NAME_MAX_LENGTH}
            placeholder={t('namePlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'profile-name-error' : undefined}
          />
        </FormField>
        <FormField id="profile-email" label={t('email')}>
          <Input id="profile-email" value={email} dir="ltr" readOnly disabled />
        </FormField>
        <SubmitButton
          pending={pending}
          label={t('save')}
          pendingLabel={t('saving')}
        />
      </form>
    </Section>
  );
}

export function LanguageSection() {
  const t = useTranslations('settings.language');
  const tCommon = useTranslations('common');
  const current = useLocale() as Locale;
  const { switchTo, busy } = useSwitchLocale();
  const [target, setTarget] = useState<Locale | null>(null);

  async function choose(locale: Locale) {
    if (busy || locale === current) return;
    setTarget(locale);
    if (await switchTo(locale)) toast.success(t('saved'));
    setTarget(null);
  }

  return (
    <Section title={t('title')} hint={t('hint')}>
      <ChoiceGroup
        label={t('title')}
        options={LOCALES.map((locale) => ({
          value: locale,
          label: tCommon(`language.${locale}`),
          lang: locale,
        }))}
        value={current}
        busyValue={target}
        disabled={busy}
        onChoose={(locale) => void choose(locale)}
      />
    </Section>
  );
}

const THEMES = ['light', 'dark', 'system'] as const;
type ThemeChoice = (typeof THEMES)[number];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

const subscribeNever = () => () => undefined;

/**
 * Light, dark or the phone's own setting. On a phone this is the only theme switch: the top bar
 * keeps its room for the title, the site and the upload queue.
 */
export function ThemeSection() {
  const t = useTranslations('settings.theme');
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser: nothing is checked in the server's paint.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return (
    <Section title={t('title')} hint={t('hint')}>
      <ChoiceGroup
        label={t('title')}
        options={THEMES.map((value) => ({
          value,
          label: t(value),
          icon: THEME_ICONS[value],
        }))}
        value={
          mounted ? ((theme as ThemeChoice | undefined) ?? 'system') : null
        }
        onChoose={setTheme}
      />
    </Section>
  );
}

/** A row of big radio buttons: the chosen one filled in ink, a spinner on the one being applied. */
function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  busyValue = null,
  disabled = false,
  onChoose,
}: {
  label: string;
  options: {
    value: T;
    label: string;
    lang?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  value: T | null;
  busyValue?: T | null;
  disabled?: boolean;
  onChoose: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid gap-2',
        options.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      {options.map(({ value: option, label: text, lang, icon: Icon }) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={lang}
            disabled={disabled}
            onClick={() => onChoose(option)}
            className={cn(
              'flex min-h-14 min-w-0 press cursor-pointer items-center justify-center gap-2 rounded-md border-2 px-2 type-body font-bold disabled:cursor-not-allowed disabled:opacity-60',
              // Three across a phone: the icon sits above the word so neither is cut.
              options.length === 3 && 'flex-col gap-1 py-2 max-sm:type-small',
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background hover:bg-accent',
            )}
          >
            {busyValue === option ? (
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
            ) : selected ? (
              <Check className="size-5 shrink-0" aria-hidden />
            ) : (
              Icon && <Icon className="size-5 shrink-0" aria-hidden />
            )}
            <span className="truncate">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

type PasswordErrors = Partial<Record<'current' | 'next' | 'confirm', string>>;

export function PasswordSection() {
  const t = useTranslations('settings.password');
  const failure = useFailureMessage();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [pending, setPending] = useState(false);
  const min = PASSWORD_MIN_LENGTH;

  function validate(): PasswordErrors {
    const e: PasswordErrors = {};
    if (!current) e.current = t('errors.currentRequired');
    if (next.length < min) e.next = t('errors.tooShort', { min });
    if (confirm !== next) e.confirm = t('errors.mismatch');
    return e;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    const res = await clientFetch<{ ok: true }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword: current, newPassword: next },
    });
    setPending(false);
    if (res.success) {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success(t('changed'));
    } else if (res.error === 'WRONG_PASSWORD')
      setErrors({ current: t('errors.WRONG_PASSWORD') });
    else if (res.status !== 401) toast.error(failure(res));
  }

  const field = (
    key: keyof PasswordErrors,
    id: string,
    label: string,
    placeholder: string,
    value: string,
    set: (v: string) => void,
    autoComplete: string,
  ) => (
    <FormField id={id} label={label} required error={errors[key]}>
      <Input
        id={id}
        type="password"
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${id}-error` : undefined}
      />
    </FormField>
  );

  return (
    <Section title={t('title')}>
      <form
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-4"
      >
        {field(
          'current',
          'password-current',
          t('current'),
          t('currentPlaceholder'),
          current,
          setCurrent,
          'current-password',
        )}
        {field(
          'next',
          'password-new',
          t('new'),
          t('newPlaceholder', { min }),
          next,
          setNext,
          'new-password',
        )}
        {field(
          'confirm',
          'password-confirm',
          t('confirm'),
          t('confirmPlaceholder'),
          confirm,
          setConfirm,
          'new-password',
        )}
        <SubmitButton
          pending={pending}
          label={t('submit')}
          pendingLabel={t('submitting')}
        />
      </form>
    </Section>
  );
}

export function LogoutSection() {
  const t = useTranslations('settings.logout');
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    await authRoute('/api/auth/logout');
    window.location.assign(ROUTES.login);
  }

  return (
    <Section title={t('title')} hint={t('hint')}>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => void logout()}
        className="w-full sm:w-auto"
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <LogOut className="flip-rtl" aria-hidden />
        )}
        {pending ? t('busy') : t('button')}
      </Button>
    </Section>
  );
}
