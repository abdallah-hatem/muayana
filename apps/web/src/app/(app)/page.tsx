import { InstallCard } from '@/components/install/install-card';
import { DashboardScreen } from './_dashboard/dashboard-screen';

/** Dashboard (§5.9): the inbox, the counts, and bars by trade / worker / site. */
export default function DashboardPage() {
  return (
    <div data-testid="screen-dashboard" className="flex flex-1 flex-col">
      <InstallCard className="mx-auto mb-5 w-full max-w-5xl" />
      <DashboardScreen />
    </div>
  );
}
