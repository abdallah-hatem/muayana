'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  applyPatch,
  ISSUE_DESCRIPTION_MAX,
  ISSUE_LOCATION_MAX,
  type Category,
  type Issue,
  type PatchResult,
  type Priority,
  type Requirement,
  type UpdateIssueRequest,
  type Worker,
} from '@muayana/shared';
import { CategoryChips } from '@/components/category-chips';
import { FormField } from '@/components/form-field';
import { PriorityPicker } from '@/components/priority-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useApiErrorText,
  useErrorCodeText,
} from '@/components/use-api-error-text';
import { WorkerPicker } from '@/components/worker-picker';
import { listActiveCategories, patchIssue } from '@/lib/issue-endpoints';
import { toIssueState } from '@/lib/issue-state';

/**
 * Edits an issue's details. Only changed fields are sent; the shared `applyPatch` checks the save
 * first (a description can't be emptied outside `new`, §6.1) and the API applies the same automatic
 * moves. A category change drops a worker who doesn't cover it (§6.3) and says so.
 */
export function DetailsForm({
  issue,
  onSaved,
  onCancel,
}: {
  issue: Issue;
  onSaved: (issue: Issue) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('issue.details');
  const tCommon = useTranslations('common');
  const errorText = useApiErrorText();
  const codeText = useErrorCodeText();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [description, setDescription] = useState(issue.description ?? '');
  const [location, setLocation] = useState(issue.location ?? '');
  const [priority, setPriority] = useState<Priority>(issue.priority);
  const [categoryId, setCategoryId] = useState(issue.category?.id ?? null);
  const [workerId, setWorkerId] = useState(issue.worker?.id ?? null);
  const [eligible, setEligible] = useState<Worker[]>([]);
  const [workerDropped, setWorkerDropped] = useState(false);
  const [missing, setMissing] = useState<Requirement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    void listActiveCategories().then((res) => {
      if (!live) return;
      const active = res.success ? res.data : [];
      // A category made inactive after the issue got it still shows, so it isn't lost by accident.
      const current = issue.category;
      setCategories(
        current && !active.some((c) => c.id === current.id)
          ? [
              {
                ...current,
                sortOrder: -1,
                active: false,
                counts: { open: 0, workers: 0 },
              },
              ...active,
            ]
          : active,
      );
    });
    return () => {
      live = false;
    };
  }, [issue.category]);

  function workersLoaded(workers: Worker[]) {
    setEligible(workers);
    const categoryChanged = categoryId !== (issue.category?.id ?? null);
    if (
      categoryChanged &&
      workerId &&
      !workers.some((w) => w.id === workerId)
    ) {
      setWorkerId(null);
      setWorkerDropped(true);
    }
  }

  async function save() {
    if (inFlight.current) return;
    const patch: UpdateIssueRequest = {};
    if (description.trim() !== (issue.description ?? ''))
      patch.description = description.trim();
    if (location.trim() !== (issue.location ?? ''))
      patch.location = location.trim();
    if (priority !== issue.priority) patch.priority = priority;
    if (categoryId && categoryId !== (issue.category?.id ?? null))
      patch.categoryId = categoryId;
    if (workerId !== (issue.worker?.id ?? null)) patch.workerId = workerId;

    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    const check = precheck(
      issue,
      patch,
      eligible.find((w) => w.id === workerId),
    );
    if (!check.ok) {
      setMissing(check.missing);
      setError(check.missing.length === 0 ? codeText(check.code) : null);
      return;
    }
    setMissing([]);

    inFlight.current = true;
    setSaving(true);
    setError(null);
    const res = await patchIssue(issue.id, patch);
    inFlight.current = false;
    setSaving(false);
    if (!res.success) {
      setError(errorText(res));
      return;
    }
    onSaved(res.data);
  }

  const has = (r: Requirement) => missing.includes(r);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <span id="details-category" className="type-small font-bold">
          {tCommon('fields.category')}
        </span>
        {categories === null ? (
          <Skeleton className="h-11 w-full rounded-md" />
        ) : (
          <CategoryChips
            categories={categories}
            value={categoryId}
            onChange={(next) => {
              setCategoryId(next);
              setWorkerDropped(false);
            }}
            labelledBy="details-category"
            disabled={saving}
          />
        )}
        {has('category') && (
          <p className="type-small text-destructive">{t('errors.category')}</p>
        )}
      </div>

      <FormField
        id="details-description"
        label={tCommon('fields.description')}
        required={issue.status !== 'new'}
        error={has('description') ? t('errors.description') : undefined}
      >
        <Textarea
          id="details-description"
          rows={4}
          required={issue.status !== 'new'}
          maxLength={ISSUE_DESCRIPTION_MAX}
          value={description}
          disabled={saving}
          placeholder={t('placeholders.description')}
          aria-invalid={has('description') || undefined}
          aria-describedby={
            has('description') ? 'details-description-error' : undefined
          }
          onChange={(event) => setDescription(event.target.value)}
          className="text-base md:text-sm"
        />
      </FormField>

      <FormField id="details-location" label={tCommon('fields.location')}>
        <Input
          id="details-location"
          value={location}
          maxLength={ISSUE_LOCATION_MAX}
          disabled={saving}
          placeholder={t('placeholders.location')}
          onChange={(event) => setLocation(event.target.value)}
          className="h-12 text-base md:text-sm"
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <span id="details-priority" className="type-small font-bold">
          {tCommon('fields.priority')}
        </span>
        <PriorityPicker
          value={priority}
          onChange={setPriority}
          labelledBy="details-priority"
          disabled={saving}
        />
      </div>

      <FormField
        id="details-worker"
        label={tCommon('fields.worker')}
        hint={workerDropped ? t('workerDropped') : undefined}
        error={has('worker') ? t('errors.worker') : undefined}
      >
        <WorkerPicker
          id="details-worker"
          categoryId={categoryId}
          value={workerId}
          currentWorker={issue.worker}
          onChange={(worker) => {
            setWorkerId(worker?.id ?? null);
            setWorkerDropped(false);
          }}
          onWorkersLoaded={workersLoaded}
          disabled={saving}
        />
      </FormField>

      {error && (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
        >
          {tCommon('actions.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {tCommon('actions.save')}
        </Button>
      </div>
    </form>
  );
}

/**
 * The shared rules' verdict on a save, before it is sent. When the facts about the worker aren't
 * known yet (his list still loading), the API's own check decides instead.
 */
function precheck(
  issue: Issue,
  patch: UpdateIssueRequest,
  worker: Worker | undefined,
): PatchResult | { ok: true } {
  try {
    return applyPatch(
      toIssueState(issue),
      {
        description: patch.description,
        categoryId: patch.categoryId,
        workerId: patch.workerId,
      },
      {
        worker: worker
          ? {
              categoryIds: worker.categories.map((c) => c.id),
              active: worker.active,
            }
          : null,
      },
    );
  } catch {
    return { ok: true };
  }
}
