'use client';

import { CalendarClock, MapPin, Pencil, Phone, Tag, UserX } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  isOverdue,
  priorityLabelKey,
  type Issue,
  type IssueDetail,
} from '@muayana/shared';
import { PhotoGallery } from '@/components/photo-gallery';
import { SendToWorker } from '@/components/send/send-to-worker';
import { ShellTitle } from '@/components/shell/shell-title';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { categoryName } from '@/lib/category-name';
import { getIssue } from '@/lib/issue-endpoints';
import { photosOf } from '@/lib/issue-state';
import { DeleteIssue } from './delete-issue';
import { DetailsForm } from './details-form';
import { HistoryTimeline } from './history-timeline';
import { StatusActions } from './status-actions';
import { StatusStepper } from './status-stepper';

/**
 * The issue page (business §5.4–§5.6): photos before/after, details (editable), the stamped status
 * and its stepper, the worker with "Send on WhatsApp", status actions, the history. Every change
 * shows the API's answer at once, then the history is re-read.
 */
export function IssueView({ initial }: { initial: IssueDetail }) {
  const t = useTranslations('issue');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [issue, setIssue] = useState<IssueDetail>(initial);
  const [editing, setEditing] = useState(false);

  function changed(next: Issue) {
    setIssue((current) => ({ ...current, ...next }));
    void getIssue(next.id).then((res) => {
      if (res.success) setIssue(res.data);
    });
  }

  const before = photosOf(issue.photos, 'before');
  const after = photosOf(issue.photos, 'after');
  const number = tCommon('labels.issueNumber', { number: issue.number });
  const overdue = isOverdue(issue, new Date());

  return (
    <article
      data-testid="screen-issue"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5"
    >
      <ShellTitle title={number} />

      <Tabs defaultValue="before" className="gap-3">
        <TabsList className="self-start">
          <TabsTrigger value="before">
            {t('photos.before', { count: before.length })}
          </TabsTrigger>
          <TabsTrigger value="after">
            {t('photos.after', { count: after.length })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="before">
          <PhotoGallery
            photos={before}
            alt={t('photos.alt', { number: issue.number })}
            className="-mx-4 w-auto rounded-none md:mx-0 md:rounded-lg"
          />
        </TabsContent>
        <TabsContent value="after">
          <PhotoGallery
            photos={after}
            alt={t('photos.altAfter', { number: issue.number })}
            className="-mx-4 w-auto rounded-none md:mx-0 md:rounded-lg"
            empty={t('photos.noAfter')}
          />
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip key={issue.status} status={issue.status} stamp />
          {overdue && (
            <span className="inline-flex h-7 items-center rounded-sm border-2 border-destructive px-2 type-micro font-bold text-destructive uppercase">
              {tCommon('labels.overdue')}
            </span>
          )}
          <span className="ms-auto truncate type-small text-muted-foreground">
            {issue.site.name}
          </span>
        </div>
        <StatusStepper status={issue.status} />
      </div>

      {editing ? (
        <section className="rounded-lg border-2 border-border bg-card p-4">
          <DetailsForm
            issue={issue}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setEditing(false);
              changed(saved);
            }}
          />
        </section>
      ) : (
        <section
          aria-labelledby="details-title"
          className="flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="details-title" className="min-w-0 type-heading break-words">
              {issue.description?.trim() || t('details.noDescription')}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
              {t('details.edit')}
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 type-small text-muted-foreground">
            {issue.location && (
              <li className="flex min-w-0 items-center gap-1.5">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="break-words">{issue.location}</span>
              </li>
            )}
            {issue.category && (
              <li className="flex items-center gap-1.5">
                <Tag className="size-4 shrink-0" aria-hidden />
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: issue.category.color }}
                  aria-hidden
                />
                {categoryName(issue.category, locale)}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <span className="sr-only">{tCommon('fields.priority')}</span>
              <span
                className={
                  issue.priority === 'urgent'
                    ? 'rounded-sm bg-destructive px-1.5 font-bold text-destructive-foreground'
                    : 'font-bold text-foreground'
                }
              >
                {tCommon(priorityLabelKey(issue.priority))}
              </span>
            </li>
            {issue.estimatedDate && (
              <li className="flex items-center gap-1.5">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                <span className="sr-only">
                  {tCommon('fields.estimatedDate')}
                </span>
                <span className="type-stencil" dir="ltr">
                  {issue.estimatedDate}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      <section
        aria-label={tCommon('fields.worker')}
        className="flex flex-col gap-3"
      >
        {issue.worker ? (
          <div className="flex items-center gap-3 rounded-lg border-2 border-border bg-card p-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-md bg-foreground type-heading text-primary"
            >
              {issue.worker.name.trim().charAt(0)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold">{issue.worker.name}</span>
              <span
                className="type-stencil type-small text-muted-foreground"
                dir="ltr"
              >
                {issue.worker.phone}
              </span>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <a
                href={`tel:${issue.worker.phone}`}
                aria-label={t('worker.call', { name: issue.worker.name })}
              >
                <Phone aria-hidden />
              </a>
            </Button>
          </div>
        ) : issue.formerWorkerName ? (
          <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-border p-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            >
              <UserX className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span dir="auto" className="truncate text-start font-bold">
                {t('former.name', { name: issue.formerWorkerName })}
              </span>
              <span className="type-small text-muted-foreground">
                {t('former.hint')}
              </span>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border-2 border-dashed border-border p-3 type-small text-muted-foreground">
            {t('worker.none')}
          </p>
        )}
        <SendToWorker issue={issue} onSent={changed} />
      </section>

      <StatusActions issue={issue} onChanged={changed} />

      <HistoryTimeline history={issue.history} />

      <DeleteIssue issue={issue} />
    </article>
  );
}
