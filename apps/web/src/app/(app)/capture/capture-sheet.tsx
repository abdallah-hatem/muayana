'use client';

import { ImagePlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  ISSUE_DESCRIPTION_MAX,
  ISSUE_LOCATION_MAX,
  PHOTOS_PER_KIND_MAX,
  type Priority,
  type Requirement,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { CategoryChips } from '@/components/category-chips';
import { FormField } from '@/components/form-field';
import { LocalPhoto } from '@/components/photo';
import { PriorityPicker } from '@/components/priority-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useErrorCodeText } from '@/components/use-api-error-text';
import {
  WorkerNeedsCategory,
  WorkerSelect,
  eligibleWorkers,
} from '@/components/worker-picker';
import type { CaptureWorker } from '@/lib/capture-prefs';
import type { CaptureDetails } from '@/lib/offline-queue';
import { useOnline } from '@/lib/use-online';
import { checkCapture } from './capture-rules';
import type { CaptureLookups } from './use-capture-lookups';

/** The issue being captured: its phone-made id and the photos taken for it so far. */
export interface CaptureDraft {
  issueId: string;
  /** Object URLs of the compressed photos, in the order they were taken. */
  photos: string[];
}

/**
 * The one sheet after the photo(s) (business §5.1): thumbnails with "add another photo to this
 * issue", place, description, trade, contractor (only active contractors of the chosen trade,
 * with their open counts) and priority — all optional. Opens with the keyboard down. Save sends
 * everything with the photos; "Photo only" (or closing the sheet) keeps just the photos (`new`).
 */
export function CaptureSheet({
  draft,
  lookups,
  initialLocation,
  addingPhoto,
  onAddPhoto,
  onSave,
}: {
  draft: CaptureDraft | null;
  lookups: CaptureLookups;
  initialLocation: string;
  /** A photo for this issue is being compressed and stored. */
  addingPhoto: boolean;
  onAddPhoto: () => void;
  /** `null`: photo only. */
  onSave: (details: CaptureDetails | null) => void;
}) {
  const t = useTranslations('capture.sheet');
  return (
    <BottomSheet
      open={draft !== null}
      // Closing never loses the photos: it is "photo only".
      onOpenChange={(open) => {
        if (!open) onSave(null);
      }}
      title={t('title')}
      description={t('description')}
      keepKeyboardDown
      testId="capture-sheet"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={addingPhoto}
            onClick={() => onSave(null)}
            data-testid="capture-photo-only"
          >
            {t('photoOnly')}
          </Button>
          <Button
            type="submit"
            size="lg"
            form="capture-sheet-form"
            disabled={addingPhoto}
            data-testid="capture-save"
          >
            {t('save')}
          </Button>
        </>
      }
    >
      {draft && (
        // Keyed by the issue: every capture starts from a clean sheet.
        <CaptureForm
          key={draft.issueId}
          draft={draft}
          lookups={lookups}
          initialLocation={initialLocation}
          addingPhoto={addingPhoto}
          onAddPhoto={onAddPhoto}
          onSave={onSave}
        />
      )}
    </BottomSheet>
  );
}

function CaptureForm({
  draft,
  lookups,
  initialLocation,
  addingPhoto,
  onAddPhoto,
  onSave,
}: {
  draft: CaptureDraft;
  lookups: CaptureLookups;
  initialLocation: string;
  addingPhoto: boolean;
  onAddPhoto: () => void;
  onSave: (details: CaptureDetails) => void;
}) {
  const t = useTranslations('capture.sheet');
  const tCommon = useTranslations('common');
  const tPicker = useTranslations('issue.workerPicker');
  const codeText = useErrorCodeText();
  const online = useOnline();
  const [location, setLocation] = useState(initialLocation);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [worker, setWorker] = useState<CaptureWorker | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  const [missing, setMissing] = useState<Requirement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const ids = {
    location: 'capture-location',
    description: 'capture-description',
    category: 'capture-category',
    worker: 'capture-worker',
    priority: 'capture-priority',
  };
  const workers = categoryId
    ? eligibleWorkers(lookups.workers, categoryId)
    : [];
  const full = draft.photos.length >= PHOTOS_PER_KIND_MAX;

  function chooseCategory(next: string) {
    setCategoryId(next);
    // A contractor who lacks the new trade can't stay (§6.3).
    if (worker && !worker.categories.some((c) => c.id === next))
      setWorker(null);
  }

  function save() {
    const check = checkCapture({ categoryId, description, worker });
    if (!check.ok) {
      setMissing(check.missing);
      setError(check.missing.length === 0 ? codeText(check.code) : null);
      // The engineer asked to save: take him to what is missing (the keyboard may rise now).
      if (check.missing.includes('description'))
        descriptionRef.current?.focus();
      return;
    }
    onSave({
      location,
      note: description,
      categoryId,
      workerId: worker?.id ?? null,
      priority,
    });
  }

  return (
    <form
      id="capture-sheet-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <div
        className="flex scrollbar-clean gap-2 overflow-x-auto pb-1"
        data-testid="capture-sheet-photos"
      >
        {draft.photos.map((url, index) => (
          <LocalPhoto
            key={url}
            src={url}
            alt={t('photoAlt', { number: index + 1 })}
            className="size-20 shrink-0 overflow-hidden rounded-md border-2 border-border bg-muted object-cover text-transparent"
          />
        ))}
        <button
          type="button"
          onClick={onAddPhoto}
          disabled={addingPhoto || full}
          data-testid="capture-add-photo"
          className="flex size-20 shrink-0 press cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border px-1 text-center type-micro font-bold text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addingPhoto ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-6" aria-hidden />
          )}
          {full ? t('photosFull') : t('addPhoto')}
        </button>
      </div>

      {/* Lists from the phone's cache, or any list while offline, may have changed since. */}
      {(lookups.stale || !online) && (
        <p
          data-testid="capture-lookups-stale"
          className="flex items-center gap-2 rounded-md border-2 border-foreground/80 bg-card px-3 py-2 type-small font-bold"
        >
          <span
            className="h-4 w-6 shrink-0 rounded-sm hazard-stripe"
            aria-hidden
          />
          {t('mayBeOutOfDate')}
        </p>
      )}

      <FormField id={ids.location} label={tCommon('fields.location')}>
        <Input
          id={ids.location}
          value={location}
          maxLength={ISSUE_LOCATION_MAX}
          placeholder={t('locationPlaceholder')}
          onChange={(event) => setLocation(event.target.value)}
          autoComplete="off"
          className="h-12 text-base md:text-sm"
        />
      </FormField>

      <FormField
        id={ids.description}
        label={tCommon('fields.description')}
        hint={categoryId && !description.trim() ? t('sortHint') : undefined}
        error={
          missing.includes('description') ? t('needsDescription') : undefined
        }
      >
        <Textarea
          ref={descriptionRef}
          id={ids.description}
          rows={3}
          value={description}
          maxLength={ISSUE_DESCRIPTION_MAX}
          placeholder={t('descriptionPlaceholder')}
          aria-invalid={missing.includes('description') || undefined}
          aria-describedby={
            missing.includes('description')
              ? `${ids.description}-error`
              : undefined
          }
          onChange={(event) => {
            setDescription(event.target.value);
            if (event.target.value.trim()) setMissing([]);
          }}
          className="text-base md:text-sm"
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <span id={ids.category} className="type-small font-bold">
          {tCommon('fields.category')}
        </span>
        {lookups.phase === 'loading' ? (
          <p className="type-small text-muted-foreground">{t('loading')}</p>
        ) : lookups.categories.length === 0 ? (
          <p className="type-small text-muted-foreground">
            {t('noCategories')}
          </p>
        ) : (
          <CategoryChips
            categories={lookups.categories}
            value={categoryId}
            onChange={chooseCategory}
            labelledBy={ids.category}
          />
        )}
      </div>

      <FormField id={ids.worker} label={tCommon('fields.worker')}>
        {categoryId ? (
          <WorkerSelect
            id={ids.worker}
            workers={workers}
            value={worker?.id ?? null}
            onChange={setWorker}
            emptyText={tPicker('emptyForCategory')}
          />
        ) : (
          <WorkerNeedsCategory id={ids.worker} />
        )}
      </FormField>

      <div className="flex flex-col gap-2">
        <span id={ids.priority} className="type-small font-bold">
          {tCommon('fields.priority')}
        </span>
        <PriorityPicker
          value={priority}
          onChange={setPriority}
          labelledBy={ids.priority}
        />
      </div>

      {error && (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
