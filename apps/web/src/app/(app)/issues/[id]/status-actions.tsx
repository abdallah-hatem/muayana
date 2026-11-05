'use client';

import {
  Ban,
  Check,
  Hammer,
  Loader2,
  RotateCcw,
  Send,
  UserCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  isClosed,
  missingFor,
  reopenTarget,
  type Issue,
  type IssueStatus,
} from '@muayana/shared';
import { DatePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { useApiErrorText } from '@/components/use-api-error-text';
import type { ApiResult } from '@/lib/api-result';
import { changeIssueStatus, patchIssue } from '@/lib/issue-endpoints';
import { toIssueState } from '@/lib/issue-state';
import { CancelSheet, SolveSheet } from './status-sheets';
import { useMoveReason, useRequirementsText } from './move-reason';

/** The moves offered as buttons; `estimated` goes through the date picker, reopen on its own. */
const MOVES: readonly {
  to: IssueStatus;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { to: 'assigned', icon: UserCheck },
  { to: 'sent', icon: Send },
  { to: 'in_progress', icon: Hammer },
  { to: 'solved', icon: Check },
  { to: 'cancelled', icon: Ban },
];

type Busy = IssueStatus | 'estimate' | 'reopen' | null;

/**
 * Status actions of the issue page (business §4, §5.6). Every move is offered; the ones `canMove`
 * refuses are disabled with the reason. One tap sends one request: while one is pending every
 * action is locked.
 */
export function StatusActions({
  issue,
  onChanged,
}: {
  issue: Issue;
  onChanged: (issue: Issue) => void;
}) {
  const t = useTranslations('issue');
  const tStatus = useTranslations('common.status');
  const errorText = useApiErrorText();
  const reasonFor = useMoveReason();
  const requirementsText = useRequirementsText();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'solve' | 'cancel' | null>(null);
  const inFlight = useRef(false);
  const state = toIssueState(issue);

  /** Runs one request at a time; answers whether it succeeded. */
  async function run(kind: Busy, call: () => Promise<ApiResult<Issue>>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(kind);
    setError(null);
    const res = await call();
    inFlight.current = false;
    setBusy(null);
    if (!res.success) {
      setError(errorText(res));
      return false;
    }
    onChanged(res.data);
    return true;
  }

  const move = (to: IssueStatus, note?: string) =>
    run(to, () =>
      changeIssueStatus(issue.id, note ? { status: to, note } : { status: to }),
    );

  if (isClosed(issue.status)) {
    const target = reopenTarget(state);
    return (
      <Section title={t('actions.title')} error={error}>
        {target && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy !== null}
            onClick={() =>
              void run('reopen', () =>
                changeIssueStatus(issue.id, { status: target }),
              )
            }
          >
            {busy === 'reopen' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RotateCcw aria-hidden />
            )}
            {t('actions.reopen', { status: tStatus(target) })}
          </Button>
        )}
      </Section>
    );
  }

  // Picking the date is what supplies `estimatedDate`: ask only for the rest.
  const estimateMissing = missingFor(state, 'estimated').filter(
    (r) => r !== 'estimatedDate',
  );
  const canEstimate = estimateMissing.length === 0;
  const estimateReason = canEstimate
    ? null
    : t('reasons.needs', { list: requirementsText(estimateMissing) });

  return (
    <Section title={t('actions.title')} error={error}>
      <div className="flex flex-col gap-1.5">
        <span id="estimate-label" className="type-small font-bold">
          {t('actions.estimate')}
        </span>
        <DatePicker
          value={issue.estimatedDate}
          placeholder={t('actions.estimatePlaceholder')}
          disabled={!canEstimate || (busy !== null && busy !== 'estimate')}
          busy={busy === 'estimate'}
          describedBy={canEstimate ? 'estimate-label' : 'estimate-reason'}
          className="h-12 w-full"
          onChange={(estimatedDate) =>
            void run('estimate', () => patchIssue(issue.id, { estimatedDate }))
          }
        />
        {!canEstimate && (
          <p id="estimate-reason" className="type-small text-muted-foreground">
            {estimateReason}
          </p>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MOVES.map(({ to, icon: Icon }) => {
          const reason = reasonFor(state, to);
          const reasonId = `move-reason-${to}`;
          return (
            <li key={to} className="flex flex-col gap-1">
              <Button
                type="button"
                variant={to === 'solved' ? 'default' : 'outline'}
                className="h-12 w-full justify-start"
                disabled={reason !== null || busy !== null}
                aria-describedby={reason ? reasonId : undefined}
                onClick={() => {
                  if (to === 'solved') setSheet('solve');
                  else if (to === 'cancelled') setSheet('cancel');
                  else void move(to);
                }}
              >
                {busy === to ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Icon aria-hidden />
                )}
                {t(`actions.to.${to}`)}
              </Button>
              {reason && (
                <p id={reasonId} className="type-small text-muted-foreground">
                  {reason}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <SolveSheet
        issue={issue}
        open={sheet === 'solve'}
        onOpenChange={(open) => setSheet(open ? 'solve' : null)}
        onSolved={(solved) => {
          setSheet(null);
          onChanged(solved);
        }}
      />
      <CancelSheet
        open={sheet === 'cancel'}
        busy={busy === 'cancelled'}
        error={sheet === 'cancel' ? error : null}
        onOpenChange={(open) =>
          busy === null && setSheet(open ? 'cancel' : null)
        }
        onConfirm={async (reason) => {
          if (await move('cancelled', reason)) setSheet(null);
        }}
      />
    </Section>
  );
}

function Section({
  title,
  error,
  children,
}: {
  title: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="status-actions-title"
      className="flex flex-col gap-4 rounded-lg border-2 border-border bg-card p-4"
    >
      <h2 id="status-actions-title" className="type-heading">
        {title}
      </h2>
      {children}
      {error && (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
