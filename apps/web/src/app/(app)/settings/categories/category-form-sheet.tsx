'use client';

import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import {
  CATEGORY_NAME_MAX,
  DomainErrorCode,
  type Category,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import { CATEGORY_PALETTE, isOffPalette } from '@/lib/category-palette';
import { createCategory, updateCategory } from '@/lib/directory-endpoints';
import { cn } from '@/lib/utils';

/**
 * Create (no `category`) or edit a category: Arabic name (required, unique), English name, and a
 * colour from the fixed palette.
 */
export function CategoryFormSheet({
  open,
  category,
  defaultColor,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  category: Category | null;
  defaultColor: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (category: Category, created: boolean) => void;
}) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common.actions');
  const errorText = useApiErrorText();
  const formId = useId();
  const [nameAr, setNameAr] = useState(category?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(category?.nameEn ?? '');
  const [color, setColor] = useState(
    (category?.color ?? defaultColor).toUpperCase(),
  );
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePendingAction();

  // A colour outside the palette stays choosable: an edited category's own ("current colour"),
  // or the generated unused colour a new one starts with once every swatch is taken ("new colour").
  const initial = (category?.color ?? defaultColor).toUpperCase();
  const custom = isOffPalette(initial) ? initial : null;
  const swatches = [
    ...CATEGORY_PALETTE.map((c) => ({
      hex: c.hex as string,
      label: t(`colors.${c.key}`),
    })),
    ...(custom
      ? [
          {
            hex: custom,
            label: category ? t('colors.current') : t('colors.new'),
          },
        ]
      : []),
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!nameAr.trim()) return setNameError(t('form.nameRequired'));
    setNameError(undefined);
    setError(null);
    const body = {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || (category ? '' : undefined),
      color,
    };
    await run(async () => {
      const res = category
        ? await updateCategory(category.id, body)
        : await createCategory(body);
      if (res.success) return onSaved(res.data, !category);
      if (res.status === 401) return;
      if (res.error === DomainErrorCode.DUPLICATE || res.status === 409)
        setNameError(t('form.duplicate'));
      else setError(errorText(res));
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={category ? t('form.editTitle') : t('form.createTitle')}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t('form.saving') : t('form.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={category ? t('form.editTitle') : t('form.createTitle')}
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <FormField
          id={`${formId}-ar`}
          label={t('form.nameAr')}
          required
          error={nameError}
        >
          <Input
            id={`${formId}-ar`}
            dir="rtl"
            lang="ar"
            required
            maxLength={CATEGORY_NAME_MAX}
            placeholder={t('form.nameArPlaceholder')}
            value={nameAr}
            disabled={pending}
            onChange={(e) => setNameAr(e.target.value)}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `${formId}-ar-error` : undefined}
            className="text-base md:text-sm"
          />
        </FormField>
        <FormField id={`${formId}-en`} label={t('form.nameEn')}>
          <Input
            id={`${formId}-en`}
            dir="ltr"
            lang="en"
            maxLength={CATEGORY_NAME_MAX}
            placeholder={t('form.nameEnPlaceholder')}
            value={nameEn}
            disabled={pending}
            onChange={(e) => setNameEn(e.target.value)}
            className="text-base md:text-sm"
          />
        </FormField>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 type-small font-bold">
            {t('form.color')}
          </legend>
          <div
            role="radiogroup"
            aria-label={t('form.color')}
            className="grid grid-cols-6 gap-2"
          >
            {swatches.map((swatch) => {
              const chosen = swatch.hex === color;
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={swatch.label}
                  title={swatch.label}
                  disabled={pending}
                  onClick={() => setColor(swatch.hex)}
                  className={cn(
                    'flex aspect-square min-h-11 press cursor-pointer items-center justify-center rounded-md border-2 disabled:cursor-not-allowed',
                    chosen
                      ? 'border-foreground ring-2 ring-ring'
                      : 'border-border',
                  )}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {chosen && (
                    <Check
                      className="size-5 rounded-full bg-background p-0.5 text-foreground"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="type-small font-bold text-destructive">
            {error}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}
