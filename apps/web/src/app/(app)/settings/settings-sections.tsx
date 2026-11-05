'use client';

import { Check, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
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
      <div
        role="radiogroup"
        aria-label={t('title')}
        className="grid grid-cols-2 gap-2"
      >
        {LOCALES.map((locale) => {
          const selected = locale === current;
          return (
            <button
              key={locale}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={locale}
              disabled={busy}
              onClick={() => void choose(locale)}
              className={cn(
                'flex h-14 press cursor-pointer items-center justify-center gap-2 rounded-md border-2 type-body font-bold disabled:cursor-not-allowed disabled:opacity-60',
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background hover:bg-accent',
              )}
            >
              {target === locale ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                selected && <Check className="size-5" aria-hidden />
              )}
              {tCommon(`language.${locale}`)}
            </button>
          );
        })}
      </div>
    </Section>
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
