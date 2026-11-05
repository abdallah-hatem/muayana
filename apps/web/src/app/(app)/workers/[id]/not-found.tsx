import { NotFoundView } from '@/components/not-found-view';

/** /workers/<id> for a worker that doesn't exist (or a malformed id). */
export default function WorkerNotFound() {
  return <NotFoundView kind="worker" />;
}
