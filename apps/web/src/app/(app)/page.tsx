import { DashboardScreen } from './_dashboard/dashboard-screen';

/** Dashboard (§5.9): the inbox, the counts, and bars by trade / worker / site. */
export default function DashboardPage() {
  return (
    <div data-testid="screen-dashboard" className="flex flex-1 flex-col">
      <DashboardScreen />
    </div>
  );
}
