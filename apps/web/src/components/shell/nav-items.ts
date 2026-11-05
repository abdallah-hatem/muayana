import { Camera, House, Inbox, List, Users } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

export type NavKey = 'dashboard' | 'issues' | 'capture' | 'inbox' | 'workers';

export interface NavItem {
  key: NavKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The capture shutter: the big round yellow button in the middle. */
  shutter?: boolean;
}

/** Bottom nav (phone) / side rail (md+), in order; labels are `common.nav.<key>`. */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', href: ROUTES.dashboard, icon: House },
  { key: 'issues', href: ROUTES.issues, icon: List },
  { key: 'capture', href: ROUTES.capture, icon: Camera, shutter: true },
  { key: 'inbox', href: ROUTES.inbox, icon: Inbox },
  { key: 'workers', href: ROUTES.workers, icon: Users },
];

/** True when `pathname` is `href` or a page under it (the dashboard matches only itself). */
export function isActive(pathname: string, href: string): boolean {
  if (href === ROUTES.dashboard) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
