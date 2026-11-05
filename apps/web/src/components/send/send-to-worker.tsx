'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  BULK_IDS_MAX,
  buildBatchMessage,
  buildIssueMessage,
  canMove,
  isForwardMove,
  type BulkIssuesResponse,
  type Issue,
  type Locale,
  type Worker,
} from '@muayana/shared';
import { chunk } from '@/lib/all-pages';
import { bulkIssues, changeIssueStatus } from '@/lib/issue-endpoints';
import { photosOf, toIssueState } from '@/lib/issue-state';
import {
  canShareFiles,
  loadPhotoFiles,
  photoBaseUrl,
  shareToWhatsApp,
} from '@/lib/whatsapp-share';
import { SendFlow } from './send-flow';

/** Messages to workers are written in Arabic (business §5.5). */
const MESSAGE_LANG: Locale = 'ar';

/**
 * "Send on WhatsApp" for one issue. The before-photos go as files when the phone can share them
 * (fetched ahead, so the share keeps the tap's user activation), else wa.me opens with photo
 * links. "Mark as sent?" is asked only when `sent` is a forward move the rules allow.
 */
export function SendToWorker({
  issue,
  onSent,
}: {
  issue: Issue;
  onSent: (issue: Issue) => void;
}) {
  const t = useTranslations('send');
  const files = useRef<Promise<File[]> | null>(null);
  const worker = issue.worker;

  const photoUrls = photosOf(issue.photos, 'before')
    .map((p) => p.url)
    .join('\n');

  useEffect(() => {
    files.current = canShareFiles()
      ? loadPhotoFiles(photoUrls ? photoUrls.split('\n') : [])
      : null;
  }, [photoUrls]);

  const state = toIssueState(issue);
  const askToMarkSent =
    isForwardMove(issue.status, 'sent') && canMove(state, 'sent').ok;

  return (
    <SendFlow<Issue>
      label={t('button')}
      disabledReason={worker ? null : t('needsWorker')}
      askToMarkSent={askToMarkSent}
      share={async () =>
        shareToWhatsApp({
          text: buildIssueMessage(issue, MESSAGE_LANG, {
            baseUrl: photoBaseUrl(),
          }),
          phone: worker?.phone ?? '',
          files: files.current ? await files.current : [],
        })
      }
      markSent={() => changeIssueStatus(issue.id, { status: 'sent' })}
      onMarked={onSent}
    />
  );
}

/**
 * Batch send from a worker's page (business §5.5): every one of the worker's `assigned` issues,
 * then — on yes — marked sent together in one bulk call. Issues in any other status are left out.
 * More than BULK_IDS_MAX go in consecutive batches: one message and one bulk call per batch.
 * After a yes the page reloads (the sent ones leave `assigned`, the next batch comes first); after
 * a "Not yet" the next tap moves on to the next batch.
 */
export function BatchSendToWorker({
  worker,
  issues,
  onSent,
}: {
  worker: Pick<Worker, 'id' | 'name' | 'phone' | 'active'>;
  issues: readonly Issue[];
  onSent: (issues: Issue[]) => void;
}) {
  const t = useTranslations('send');
  const assigned = batchIssues(issues, worker.id);
  const batches = chunk(assigned, BULK_IDS_MAX);
  const [index, setIndex] = useState(0);
  const part = batches.length === 0 ? 0 : index % batches.length;
  const batch = batches[part] ?? [];
  // The batch handed to WhatsApp: "Mark as sent?" marks exactly those.
  const shared = useRef<Issue[]>([]);

  const disabledReason = !worker.active
    ? t('batch.inactive')
    : assigned.length === 0
      ? t('batch.none')
      : null;

  return (
    <SendFlow<BulkIssuesResponse>
      label={t('batch.button', { count: batch.length })}
      hint={
        batches.length > 1
          ? t('batch.part', {
              part: part + 1,
              parts: batches.length,
              total: assigned.length,
              size: BULK_IDS_MAX,
            })
          : null
      }
      disabledReason={disabledReason}
      askToMarkSent
      confirmBody={t('batch.confirmBody', { count: batch.length })}
      share={() => {
        shared.current = batch;
        return shareToWhatsApp({
          text: buildBatchMessage(batch, worker, MESSAGE_LANG, {
            baseUrl: photoBaseUrl(),
          }),
          phone: worker.phone,
          // Many issues' photos are too many files: the message carries their links.
          files: [],
        });
      }}
      markSent={() =>
        bulkIssues({ ids: shared.current.map((i) => i.id), status: 'sent' })
      }
      onMarked={(res) => {
        setIndex(0);
        onSent(res.issues);
      }}
      onDeclined={() => setIndex(part + 1)}
    />
  );
}

/** The issues a batch send includes: this worker's, in `assigned` only (§5.5). */
export const batchIssues = (
  issues: readonly Issue[],
  workerId: string,
): Issue[] =>
  issues.filter((i) => i.status === 'assigned' && i.worker?.id === workerId);
