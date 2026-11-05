import { getTranslations } from 'next-intl/server';
import { getMe } from '@/lib/session';
import {
  LanguageSection,
  LogoutSection,
  PasswordSection,
  ProfileSection,
} from './settings-sections';

/** Profile, language, password and sign-out. (Sites and categories join in T8.) */
export default async function SettingsPage() {
  const me = await getMe();
  const t = await getTranslations('shell');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {me ? (
        <ProfileSection name={me.name} email={me.email} />
      ) : (
        <p role="alert" className="type-body text-destructive">
          {t('errors.NETWORK_ERROR')}
        </p>
      )}
      <LanguageSection />
      <PasswordSection />
      <LogoutSection />
    </div>
  );
}
