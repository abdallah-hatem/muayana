import { AppShell } from '@/components/shell/app-shell';
import { getMe } from '@/lib/session';

/** Every signed-in page. The proxy already sent signed-out visitors to /login. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Checks the session with the API on every render: a dead token goes to sign-out from here.
  await getMe();
  return <AppShell>{children}</AppShell>;
}
