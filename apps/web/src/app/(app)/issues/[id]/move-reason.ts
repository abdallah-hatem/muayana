'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import {
  canMove,
  type IssueState,
  type IssueStatus,
  type Requirement,
} from '@muayana/shared';

/**
 * Why a status move isn't allowed, in words — or `null` when `canMove` allows it (business §4).
 * The decision is the shared rule's; this only names what is missing.
 */
export function useMoveReason(): (
  state: IssueState,
  to: IssueStatus,
) => string | null {
  const t = useTranslations('issue.reasons');
  const requirementsText = useRequirementsText();

  return useCallback(
    (state: IssueState, to: IssueStatus) => {
      if (state.status === to) return t('current');
      const result = canMove(state, to);
      if (result.ok) return null;
      if (result.code === 'BACK_TO_NEW') return t('backToNew');
      if (result.missing.includes('noWorker')) return t('noWorker');
      return t('needs', { list: requirementsText(result.missing) });
    },
    [t, requirementsText],
  );
}

/** "a worker and an estimated date": the requirements, translated and joined for the language. */
export function useRequirementsText(): (missing: Requirement[]) => string {
  const t = useTranslations('issue.requirements');
  const locale = useLocale();
  return useCallback(
    (missing: Requirement[]) =>
      new Intl.ListFormat(locale, { type: 'conjunction' }).format(
        missing.map((r) => t(r)),
      ),
    [t, locale],
  );
}
