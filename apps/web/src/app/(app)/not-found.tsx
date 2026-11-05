import { NotFoundView } from '@/components/not-found-view';

/** A signed-in page that called notFound(): shown inside the shell, so the nav stays. */
export default function AppNotFound() {
  return <NotFoundView />;
}
