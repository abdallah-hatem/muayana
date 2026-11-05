import { Suspense } from 'react';
import { IssuesScreen } from './_components/issues-screen';

/** Issues list (§5.8): filters in the address, cards on the phone, a table from md up. */
export default function IssuesPage() {
  return (
    <div data-testid="screen-issues" className="flex flex-1 flex-col">
      {/* useSearchParams needs a boundary; the screen shows its own skeleton while loading. */}
      <Suspense>
        <IssuesScreen />
      </Suspense>
    </div>
  );
}
