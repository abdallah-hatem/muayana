'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
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
  packetContent,
  photoBaseUrl,
  planShares,
  shareInParts,
} from '@/lib/whatsapp-share';
import { SendFlow } from './send-flow';
import { usePreparedPhotos } from './use-prepared-photos';

/** Messages to workers are written in Arabic (business §5.5). */
const MESSAGE_LANG: Locale = 'ar';

const beforeUrls = (issue: Issue): string[] =>
  photosOf(issue.photos, 'before').map((p) => p.url);

/**
 * "Send on WhatsApp" for one issue. Where the phone can share files, the before-photos go as files
 * with the text as their caption (no links) — downloaded on the first tap, shared on the next;
 * else wa.me opens with the text and photo links.
 * "Mark as sent?" is asked only when `sent` is a forward move the rules allow.
 */
export function SendToWorker({
  issue,
  onSent,
}: {
  issue: Issue;
  onSent: (issue: Issue) => void;
}) {
  const t = useTranslations('send');
  const worker = issue.worker;
  const { preparation, items } = usePreparedPhotos([issue], beforeUrls);

  const state = toIssueState(issue);
  const askToMarkSent =
    isForwardMove(issue.status, 'sent') && canMove(state, 'sent').ok;

  return (
    <SendFlow<Issue>
      label={t('button')}
      disabledReason={worker ? null : t('needsWorker')}
      askToMarkSent={askToMarkSent}
      prepare={preparation}
      share={() =>
        shareInParts({
          packets: items ? planShares(items) : [],
          caption: (packet, part) =>
            buildIssueMessage(issue, MESSAGE_LANG, {
              withPhotoLinks: false,
              part,
              missingPhotos: packetContent(packet).missingPhotos,
            }),
          phone: worker?.phone ?? '',
          fallbackText: () =>
            buildIssueMessage(issue, MESSAGE_LANG, { baseUrl: photoBaseUrl() }),
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
 * More than BULK_IDS_MAX go in consecutive batches: one message and one bulk call per batch. Where
 * the phone can share files, all the batch's photos go as files — downloaded only once he taps
 * "Prepare photos", then in several shares when the browser won't take them in one. After a yes the page reloads (the sent ones leave `assigned`,
 * the next batch comes first); after a "Not yet" the next tap moves on to the next batch.
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
  const { preparation, items } = usePreparedPhotos(batch, beforeUrls);
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
      prepare={preparation}
      share={() => {
        shared.current = batch;
        return shareInParts({
          packets: items ? planShares(items) : [],
          caption: (packet, sharePart) => {
            const content = packetContent(packet);
            return buildBatchMessage(content.issues, worker, MESSAGE_LANG, {
              withPhotoLinks: false,
              part: sharePart,
              missingPhotos: content.missingPhotos,
              total: batch.length,
            });
          },
          phone: worker.phone,
          fallbackText: () =>
            buildBatchMessage(batch, worker, MESSAGE_LANG, {
              baseUrl: photoBaseUrl(),
            }),
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
