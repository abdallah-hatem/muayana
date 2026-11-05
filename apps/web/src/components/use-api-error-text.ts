'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { ApiFailure } from '@/lib/api-result';

/** A coded refusal (`ISSUE_REQUIREMENTS`, `PHOTO_LIMIT`, …) in words; unknown codes → generic. */
export function useErrorCodeText(): (code: string | undefined) => string {
  const t = useTranslations('issue.errors');
  return useCallback(
    (code: string | undefined) =>
      code && t.has(code) ? t(code) : t('generic'),
    [t],
  );
}

/**
 * Turns a failed API answer into a sentence: the coded refusals of the contract, 413, the network,
 * else a generic line. Never the API's own English message.
 */
export function useApiErrorText(): (failure: ApiFailure) => string {
  const codeText = useErrorCodeText();
  return useCallback(
    (failure: ApiFailure) =>
      codeText(failure.status === 413 ? 'PAYLOAD_TOO_LARGE' : failure.error),
    [codeText],
  );
}
