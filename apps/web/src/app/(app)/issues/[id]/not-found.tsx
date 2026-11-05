import { NotFoundView } from '@/components/not-found-view';

/** /issues/<id> for an issue that doesn't exist (or a malformed id). */
export default function IssueNotFound() {
  return <NotFoundView kind="issue" />;
}
