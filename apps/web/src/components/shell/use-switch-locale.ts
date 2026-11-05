'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Locale, User } from '@muayana/shared';
import { LOCALE_COOKIE } from '@/i18n/config';
import { clientFetch } from '@/lib/api-client';

/**
 * Switches the app language: saves it on the account (so the next sign-in keeps it), writes the
 * locale cookie the server renders with, and re-renders. Busy until the new language is on screen.
 */
export function useSwitchLocale() {
  const router = useRouter();
  const t = useTranslations('shell');
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();

  async function switchTo(locale: Locale): Promise<boolean> {
    setSaving(true);
    const res = await clientFetch<User>('/auth/me', {
      method: 'PATCH',
      body: { locale },
    });
    setSaving(false);
    if (!res.success) {
      if (res.status !== 401)
        toast.error(
          t(
            res.error === 'NETWORK_ERROR'
              ? 'errors.NETWORK_ERROR'
              : 'errors.generic',
          ),
        );
      return false;
    }
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
    return true;
  }

  return { switchTo, busy: saving || refreshing };
}
