'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import type { User } from '@muayana/shared';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authRoute } from '@/lib/api-client';
import type { ApiFailure } from '@/lib/api-result';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

const KNOWN_ERRORS = new Set([
  'INVALID_CREDENTIALS',
  'VALIDATION_FAILED',
  'NETWORK_ERROR',
]);

/** Minutes until the rate limit lifts, from the API's 429 data (at least 1). */
function minutesFrom(data: unknown): number {
  const seconds =
    typeof data === 'object' && data !== null && 'retryAfterSeconds' in data
      ? Number((data as { retryAfterSeconds: unknown }).retryAfterSeconds)
      : 0;
  return Math.max(1, Math.ceil((Number.isFinite(seconds) ? seconds : 0) / 60));
}

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = t('errors.emailRequired');
    else if (!z.email().safeParse(email.trim()).success)
      errors.email = t('errors.emailInvalid');
    if (!password) errors.password = t('errors.passwordRequired');
    return errors;
  }

  function messageFor(res: ApiFailure): string {
    if (res.status === 429)
      return t('errors.TOO_MANY_REQUESTS', { minutes: minutesFrom(res.data) });
    if (res.error && KNOWN_ERRORS.has(res.error))
      return t(`errors.${res.error}`);
    return t('errors.generic');
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setPending(true);
    const res = await authRoute<{ user: User }>('/api/auth/login', {
      email: email.trim(),
      password,
    });
    if (res.success) {
      // A full load: the layout re-renders in the account's language.
      window.location.assign(next);
      return;
    }
    setPending(false);
    setFormError(messageFor(res));
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-col gap-5"
      aria-busy={pending}
    >
      <FormField
        id="login-email"
        label={t('email')}
        required
        error={fieldErrors.email}
      >
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
          required
          className="h-14 text-lg"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
        />
      </FormField>

      <FormField
        id="login-password"
        label={t('password')}
        required
        error={fieldErrors.password}
      >
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="h-14 pe-14 text-lg"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={
              fieldErrors.password ? 'login-password-error' : undefined
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-1 end-1 h-auto"
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </Button>
        </div>
      </FormField>

      {formError && (
        <p
          role="alert"
          className="rounded-md border-2 border-destructive bg-card px-4 py-3 type-small text-destructive"
        >
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
