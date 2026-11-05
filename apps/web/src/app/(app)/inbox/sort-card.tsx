'use client';

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  ISSUE_DESCRIPTION_MAX,
  ISSUE_LOCATION_MAX,
  type Category,
  type Issue,
  type Priority,
  type Requirement,
  type Worker,
} from '@muayana/shared';
import { CategoryChips } from '@/components/category-chips';
import { FormField } from '@/components/form-field';
import { PhotoGallery } from '@/components/photo-gallery';
import { PriorityPicker } from '@/components/priority-picker';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useApiErrorText,
  useErrorCodeText,
} from '@/components/use-api-error-text';
import { WorkerPicker } from '@/components/worker-picker';
import { patchIssue } from '@/lib/issue-endpoints';
import { photosOf } from '@/lib/issue-state';
import { checkSort, keepsWorker } from './sort-rules';

/**
 * One `new` issue being sorted (business §5.3): photo large, category chips, description,
 * location, priority, optional worker → "Save & next" moves it to `unassigned` (or `assigned`).
 * Keyed by issue id, so its form starts fresh for every issue.
 */
export function SortCard({
  issue,
  categories,
  onSaved,
  onSkip,
  onBack,
  canGoBack,
}: {
  issue: Issue;
  categories: readonly Category[];
  onSaved: (issue: Issue) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
}) {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common');
  const errorText = useApiErrorText();
  const codeText = useErrorCodeText();
  const [categoryId, setCategoryId] = useState(issue.category?.id ?? null);
  const [description, setDescription] = useState(issue.description ?? '');
  const [location, setLocation] = useState(issue.location ?? '');
  const [priority, setPriority] = useState<Priority>(issue.priority);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [missing, setMissing] = useState<Requirement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const ids = {
    category: `sort-category-${issue.id}`,
    description: `sort-description-${issue.id}`,
    location: `sort-location-${issue.id}`,
    priority: `sort-priority-${issue.id}`,
    worker: `sort-worker-${issue.id}`,
  };

  function chooseCategory(next: string) {
    setCategoryId(next);
    setMissing((m) => m.filter((r) => r !== 'category'));
    if (worker && !keepsWorker(worker, next)) setWorker(null);
  }

  async function save() {
    if (inFlight.current) return;
    const check = checkSort(issue, { categoryId, description, worker });
    if (!check.ok) {
      setMissing(check.missing);
      setError(check.missing.length === 0 ? codeText(check.code) : null);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    const res = await patchIssue(issue.id, {
      categoryId: categoryId ?? undefined,
      description: description.trim(),
      location: location.trim(),
      priority,
      ...(worker ? { workerId: worker.id } : {}),
    });
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
      aria-label={tCommon('labels.issueNumber', { number: issue.number })}
    >
      <PhotoGallery
        photos={photosOf(issue.photos, 'before')}
        alt={t('photoAlt', { number: issue.number })}
        className="-mx-4 w-auto rounded-none md:mx-0 md:rounded-lg"
        overlay={
          <div className="absolute start-3 top-3 flex items-center gap-2">
            <StatusChip status={issue.status} />
            <span
              className="rounded-sm bg-foreground/85 px-2 py-0.5 type-small font-bold text-background"
              dir="ltr"
            >
              <span className="type-stencil">
                {tCommon('labels.issueNumber', { number: issue.number })}
              </span>
            </span>
          </div>
        }
      />
      <p className="-mt-3 truncate type-small text-muted-foreground">
        {issue.site.name}
      </p>

      <div className="flex flex-col gap-2">
        <span id={ids.category} className="type-small font-bold">
          {tCommon('fields.category')}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        {categories.length === 0 ? (
          <p className="type-small text-muted-foreground">
            {t('noCategories')}
          </p>
        ) : (
          <CategoryChips
            categories={categories}
            value={categoryId}
            onChange={chooseCategory}
            labelledBy={ids.category}
            disabled={saving}
          />
        )}
        {has('category') && (
          <p className="type-small text-destructive">{t('errors.category')}</p>
        )}
      </div>

      <FormField
        id={ids.description}
        label={tCommon('fields.description')}
        required
        error={has('description') ? t('errors.description') : undefined}
      >
        <Textarea
          id={ids.description}
          rows={3}
          required
          maxLength={ISSUE_DESCRIPTION_MAX}
          value={description}
          disabled={saving}
          placeholder={t('placeholders.description')}
          aria-invalid={has('description') || undefined}
          aria-describedby={
            has('description') ? `${ids.description}-error` : undefined
          }
          onChange={(event) => {
            setDescription(event.target.value);
            if (event.target.value.trim())
              setMissing((m) => m.filter((r) => r !== 'description'));
          }}
          className="text-base md:text-sm"
        />
      </FormField>

      <FormField id={ids.location} label={tCommon('fields.location')}>
        <Input
          id={ids.location}
          value={location}
          maxLength={ISSUE_LOCATION_MAX}
          disabled={saving}
          placeholder={t('placeholders.location')}
          onChange={(event) => setLocation(event.target.value)}
          className="h-12 text-base md:text-sm"
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <span id={ids.priority} className="type-small font-bold">
          {tCommon('fields.priority')}
        </span>
        <PriorityPicker
          value={priority}
          onChange={setPriority}
          labelledBy={ids.priority}
          disabled={saving}
        />
      </div>

      <FormField
        id={ids.worker}
        label={tCommon('fields.worker')}
        hint={t('workerHint')}
      >
        <WorkerPicker
          id={ids.worker}
          categoryId={categoryId}
          value={worker?.id ?? null}
          onChange={setWorker}
          disabled={saving}
        />
      </FormField>

      {error && (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-24 z-10 -mx-4 flex gap-2 border-t-2 border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-lg md:border-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('back')}
          disabled={!canGoBack || saving}
          onClick={onBack}
        >
          <ArrowRight className="hidden rtl:block" aria-hidden />
          <ArrowLeft className="rtl:hidden" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onSkip}
        >
          {tCommon('actions.skip')}
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {t('saveNext')}
          <ArrowLeft className="hidden rtl:block" aria-hidden />
          <ArrowRight className="rtl:hidden" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
