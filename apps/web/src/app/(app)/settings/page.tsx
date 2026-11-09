import { getTranslations } from 'next-intl/server';
import { InstallCard } from '@/components/install/install-card';
import { getMe } from '@/lib/session';
import {
  LanguageSection,
  LogoutSection,
  ManageSection,
  PasswordSection,
  ProfileSection,
  ThemeSection,
} from './settings-sections';

/** Profile, the sites and categories managers, language, theme, password and sign-out. */
export default async function SettingsPage() {
  const me = await getMe();
  const t = await getTranslations('shell');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <InstallCard />
      {me ? (
        <ProfileSection name={me.name} email={me.email} />
      ) : (
        <p role="alert" className="type-body text-destructive">
          {t('errors.NETWORK_ERROR')}
        </p>
      )}
      <ManageSection />
      <LanguageSection />
      <ThemeSection />
      <PasswordSection />
      <LogoutSection />
    </div>
  );
}
