import { isOverdue, type IssueStatus } from '@muayana/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIntl } from '@/test-utils/render-intl';
import { OverdueBadge } from './overdue-badge';

// 2026-11-05 10:00 in Cairo.
const NOW = new Date('2026-11-05T08:00:00Z');

const CASES: [string, IssueStatus, string | null][] = [
  ['estimate yesterday, in progress', 'in_progress', '2026-11-04'],
  ['estimate yesterday, estimated', 'estimated', '2026-11-04'],
  ['estimate yesterday, solved', 'solved', '2026-11-04'],
  ['estimate yesterday, cancelled', 'cancelled', '2026-11-04'],
  ['estimate today', 'estimated', '2026-11-05'],
  ['estimate tomorrow', 'sent', '2026-11-06'],
  ['no estimate', 'assigned', null],
];

describe('Overdue badge shown iff isOverdue (§4)', () => {
  it.each(CASES)('%s', (_, status, estimatedDate) => {
    const issue = { status, estimatedDate };
    renderIntl(<OverdueBadge issue={issue} now={NOW} />);
    const shown = screen.queryByTestId('overdue-badge') !== null;
    expect(shown).toBe(isOverdue(issue, NOW));
  });

  it('just after midnight in Cairo, yesterday’s estimate is overdue (Cairo day, not UTC)', () => {
    // 2026-11-05 00:30 Cairo = 2026-11-04 22:30 UTC.
    const issue = { status: 'sent' as const, estimatedDate: '2026-11-04' };
    renderIntl(
      <OverdueBadge issue={issue} now={new Date('2026-11-04T22:30:00Z')} />,
    );
    expect(screen.getByTestId('overdue-badge')).toHaveTextContent('Overdue');
  });
});
