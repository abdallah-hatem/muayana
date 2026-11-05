'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  DomainErrorCode,
  PHONE_INPUT_MAX,
  WORKER_NAME_MAX,
  WORKER_NOTES_MAX,
  normalizeEgyptPhone,
  type Category,
  type CategoryRef,
  type Worker,
} from '@muayana/shared';
import { CategoryChip } from '@/components/category-chips';
import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import type { ApiFailure } from '@/lib/api-result';
import { categoryName } from '@/lib/category-name';
import { createWorker, updateWorker } from '@/lib/directory-endpoints';

type Field = 'name' | 'phone' | 'categories';
type Errors = Partial<Record<Field, string>>;

/**
 * What can be ticked: the active categories (invariant §6.11), plus — when editing — any
 * deactivated one the worker already has, so it shows and can be removed.
 */
export function categoryOptions(
  active: readonly Category[],
  worker: Pick<Worker, 'categories'> | null,
): { category: CategoryRef; inactive: boolean }[] {
  const ids = new Set(active.map((c) => c.id));
  return [
    ...active.map((category) => ({ category, inactive: false })),
    ...(worker?.categories ?? [])
      .filter((c) => !ids.has(c.id))
      .map((category) => ({ category, inactive: true })),
  ];
}

/**
 * The worker's fields (business §3 Worker): name, phone (any Egyptian form, normalised to +20…,
 * refused inline when it isn't one), one or more categories, notes. Creates or (with `worker`)
 * updates; the submit button lives with the caller (`form={formId}`).
 */
export function WorkerForm({
  formId,
  worker,
  categories,
  onSaved,
  onPendingChange,
  children,
}: {
  formId: string;
  worker: Worker | null;
  /** Active categories. */
  categories: readonly Category[];
  onSaved: (worker: Worker) => void;
  onPendingChange?: (pending: boolean) => void;
  /** Rendered at the end of the form (e.g. the submit button on a full page). */
  children?: React.ReactNode;
}) {
  const t = useTranslations('workers.form');
  const locale = useLocale();
  const errorText = useApiErrorText();
  const [name, setName] = useState(worker?.name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [chosen, setChosen] = useState<string[]>(
    worker?.categories.map((c) => c.id) ?? [],
  );
  const [notes, setNotes] = useState(worker?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePendingAction();
  // A created worker is not created twice (the page moves on to him).
  const [created, setCreated] = useState(false);
  const busy = pending || created;

  useEffect(() => onPendingChange?.(busy), [busy, onPendingChange]);

  const options = categoryOptions(categories, worker);

  function phoneError(value: string): string | undefined {
    if (!value.trim()) return t('errors.phoneRequired');
    return normalizeEgyptPhone(value) ? undefined : t('errors.badPhone');
  }

  function toggle(id: string) {
    const next = chosen.includes(id)
      ? chosen.filter((c) => c !== id)
      : [...chosen, id];
    setChosen(next);
    if (next.length > 0) setErrors((e) => ({ ...e, categories: undefined }));
  }

  /** Puts a refused save on the field it is about, else under the form. */
  function showFailure(res: ApiFailure) {
    if (res.status === 409 && res.error === DomainErrorCode.INACTIVE_CATEGORY)
      return setErrors({ categories: t('errors.inactiveCategory') });
    if (res.status === 409)
      return setErrors({ phone: t('errors.duplicatePhone') });
    if (res.status === 400 && /phone/i.test(res.message))
      return setErrors({ phone: t('errors.badPhone') });
    setError(errorText(res));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Errors = {
      name: name.trim() ? undefined : t('errors.nameRequired'),
      phone: phoneError(phone),
      categories:
        chosen.length > 0 ? undefined : t('errors.categoriesRequired'),
    };
    setErrors(next);
    setError(null);
    if (next.name || next.phone || next.categories) return;
    const body = {
      name: name.trim(),
      phone: normalizeEgyptPhone(phone) ?? phone.trim(),
      categoryIds: chosen,
      notes: notes.trim() || (worker ? '' : undefined),
    };
    await run(async () => {
      const res = worker
        ? await updateWorker(worker.id, body)
        : await createWorker(body);
      if (res.success) {
        if (!worker) setCreated(true);
        onSaved(res.data);
      } else if (res.status !== 401) showFailure(res);
    });
  }

  const describedBy = (field: Field) =>
    errors[field] ? `${formId}-${field}-error` : undefined;

  return (
    <form
      id={formId}
      noValidate
      aria-label={worker ? t('editTitle') : t('createTitle')}
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
    >
      <FormField
        id={`${formId}-name`}
        label={t('name')}
        required
        error={errors.name}
      >
        <Input
          id={`${formId}-name`}
          required
          autoComplete="off"
          maxLength={WORKER_NAME_MAX}
          placeholder={t('namePlaceholder')}
          value={name}
          disabled={busy}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim())
              setErrors((x) => ({ ...x, name: undefined }));
          }}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy('name')}
          className="text-base md:text-sm"
        />
      </FormField>
      <FormField
        id={`${formId}-phone`}
        label={t('phone')}
        required
        hint={t('phoneHint')}
        error={errors.phone}
      >
        <Input
          id={`${formId}-phone`}
          type="tel"
          inputMode="tel"
          dir="ltr"
          required
          autoComplete="off"
          // Room for a pasted "+20 100 123 4567": the length is checked by the rule, not cut.
          maxLength={PHONE_INPUT_MAX}
          placeholder={t('phonePlaceholder')}
          value={phone}
          disabled={busy}
          onChange={(e) => {
            setPhone(e.target.value);
            setErrors((x) => ({ ...x, phone: undefined }));
          }}
          onBlur={() => {
            if (!phone.trim()) return;
            const normal = normalizeEgyptPhone(phone);
            if (normal) setPhone(normal);
            else setErrors((x) => ({ ...x, phone: t('errors.badPhone') }));
          }}
          aria-invalid={!!errors.phone}
          aria-describedby={describedBy('phone')}
          className="font-mono text-base md:text-sm"
        />
      </FormField>
      <FormField
        id={`${formId}-categories`}
        label={t('categories')}
        required
        hint={t('categoriesHint')}
        error={errors.categories}
      >
        {options.length === 0 ? (
          <p
            id={`${formId}-categories`}
            className="rounded-md border-2 border-dashed border-border p-4 type-small text-muted-foreground"
          >
            {t('noCategories')}
          </p>
        ) : (
          <div
            id={`${formId}-categories`}
            role="group"
            aria-label={t('categories')}
            aria-describedby={describedBy('categories')}
            className="flex flex-wrap gap-2"
          >
            {options.map(({ category, inactive }) => (
              <CategoryChip
                key={category.id}
                category={inactive ? null : category}
                pressed={chosen.includes(category.id)}
                disabled={busy}
                onClick={() => toggle(category.id)}
              >
                {inactive
                  ? t('inactiveCategory', {
                      name: categoryName(category, locale),
                    })
                  : null}
              </CategoryChip>
            ))}
          </div>
        )}
      </FormField>
      <FormField id={`${formId}-notes`} label={t('notes')}>
        <Textarea
          id={`${formId}-notes`}
          rows={3}
          maxLength={WORKER_NOTES_MAX}
          placeholder={t('notesPlaceholder')}
          value={notes}
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
          className="text-base md:text-sm"
        />
      </FormField>
      {error && (
        <p role="alert" className="type-small font-bold text-destructive">
          {error}
        </p>
      )}
      {children}
    </form>
  );
}
