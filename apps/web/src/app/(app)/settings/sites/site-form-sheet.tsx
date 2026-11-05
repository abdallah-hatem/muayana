'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import {
  DomainErrorCode,
  SITE_ADDRESS_MAX,
  SITE_NAME_MAX,
  SITE_NOTES_MAX,
  type Site,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePendingAction } from '@/components/use-pending-action';
import { createSite, updateSite } from '@/lib/directory-endpoints';

/** Create (no `site`) or edit a site: name (unique among active sites), address, notes. */
export function SiteFormSheet({
  open,
  site,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  site: Site | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (site: Site, created: boolean) => void;
}) {
  const t = useTranslations('sites.form');
  const tCommon = useTranslations('common.actions');
  const errorText = useApiErrorText();
  const formId = useId();
  const [name, setName] = useState(site?.name ?? '');
  const [address, setAddress] = useState(site?.address ?? '');
  const [notes, setNotes] = useState(site?.notes ?? '');
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePendingAction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setNameError(t('nameRequired'));
    setNameError(undefined);
    setError(null);
    // Creating leaves empty optional fields out; editing sends '' to clear them.
    const optional = (value: string) => value.trim() || (site ? '' : undefined);
    const body = {
      name: name.trim(),
      address: optional(address),
      notes: optional(notes),
    };
    await run(async () => {
      const res = site
        ? await updateSite(site.id, body)
        : await createSite(body);
      if (res.success) return onSaved(res.data, !site);
      if (res.status === 401) return;
      if (res.error === DomainErrorCode.DUPLICATE || res.status === 409)
        setNameError(t('duplicate'));
      else setError(errorText(res));
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={site ? t('editTitle') : t('createTitle')}
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
            {pending ? t('saving') : t('save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={site ? t('editTitle') : t('createTitle')}
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <FormField
          id={`${formId}-name`}
          label={t('name')}
          required
          error={nameError}
        >
          <Input
            id={`${formId}-name`}
            required
            maxLength={SITE_NAME_MAX}
            placeholder={t('namePlaceholder')}
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `${formId}-name-error` : undefined}
            className="text-base md:text-sm"
          />
        </FormField>
        <FormField id={`${formId}-address`} label={t('address')}>
          <Input
            id={`${formId}-address`}
            maxLength={SITE_ADDRESS_MAX}
            placeholder={t('addressPlaceholder')}
            value={address}
            disabled={pending}
            onChange={(e) => setAddress(e.target.value)}
            className="text-base md:text-sm"
          />
        </FormField>
        <FormField id={`${formId}-notes`} label={t('notes')}>
          <Textarea
            id={`${formId}-notes`}
            rows={3}
            maxLength={SITE_NOTES_MAX}
            placeholder={t('notesPlaceholder')}
            value={notes}
            disabled={pending}
            onChange={(e) => setNotes(e.target.value)}
            className="text-base md:text-sm"
          />
        </FormField>
        {error && (
          <p role="alert" className="type-small font-bold text-destructive">
            {error}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}
