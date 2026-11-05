import { QueueSheetProvider } from '@/components/offline-queue/queue-sheet';
import { QueueSync } from '@/components/offline-queue/queue-sync';
import { SiteProvider } from '@/components/site/site-context';
import { BottomNav } from './bottom-nav';
import { ShellTitleProvider } from './shell-title';
import { TopBar } from './top-bar';

/**
 * The signed-in frame: top bar, the page, and the main navigation (bottom bar on the phone,
 * side rail from md up). Page content clears the bottom bar and its raised shutter.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <ShellTitleProvider>
        <QueueSheetProvider>
          <QueueSync />
        <div className="flex min-h-dvh flex-col md:ps-24">
          <TopBar />
          <main className="flex flex-1 flex-col px-4 pt-4 pb-36 md:px-6 md:pb-8">
            {children}
          </main>
          <BottomNav />
        </div>
        </QueueSheetProvider>
      </ShellTitleProvider>
    </SiteProvider>
  );
}

/** A section that has no screen yet: its name over hazard tape, so the nav can be walked. */
export function PlaceholderScreen({
  testId,
  body,
}: {
  testId: string;
  body: string;
}) {
  return (
    <section
      data-testid={testId}
      className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center"
    >
      <div className="h-3 w-24 rounded-sm hazard-stripe" aria-hidden />
      <p className="type-body text-muted-foreground">{body}</p>
    </section>
  );
}
