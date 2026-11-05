import { NotFoundView } from '@/components/not-found-view';

/** An address that matches no route: a bare page in the product look, with the way home. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background py-8">
      <NotFoundView fullPage />
    </main>
  );
}
