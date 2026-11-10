'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  PHOTOS_PER_KIND_MAX,
  STATUS_NOTE_MAX,
  type Issue,
} from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { FileButton } from '@/components/ui/file-button';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorText } from '@/components/use-api-error-text';
import { addIssuePhoto, changeIssueStatus } from '@/lib/issue-endpoints';
import { photosOf } from '@/lib/issue-state';

/**
 * Mark solved (business §5.6): an optional note and optional after-photos. The photos upload first
 * as `after`; the move to `solved` follows with the note on its status change. Photos already
 * uploaded leave the list, so a retry never sends one twice.
 */
export function SolveSheet({
  issue,
  open,
  onOpenChange,
  onSolved,
}: {
  issue: Issue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSolved: (issue: Issue) => void;
}) {
  const t = useTranslations('issue.solve');
  const tCommon = useTranslations('common.actions');
  const errorText = useApiErrorText();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const room =
    PHOTOS_PER_KIND_MAX - photosOf(issue.photos, 'after').length - files.length;

  function addFiles(chosen: File[]) {
    setError(null);
    const images = chosen.filter((f) =>
      (PHOTO_MIME_TYPES as readonly string[]).includes(f.type),
    );
    if (images.length < chosen.length) setError(t('notImage'));
    const small = images.filter((f) => f.size <= PHOTO_MAX_BYTES);
    if (small.length < images.length) setError(t('tooLarge'));
    if (small.length > room)
      setError(t('tooMany', { max: PHOTOS_PER_KIND_MAX }));
    setFiles((current) => [...current, ...small.slice(0, Math.max(0, room))]);
  }

  async function solve() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    let pending = files;
    for (const file of files) {
      const res = await addIssuePhoto(issue.id, file, 'after');
      if (!res.success) {
        setFiles(pending);
        setError(errorText(res));
        setBusy(false);
        inFlight.current = false;
        return;
      }
      pending = pending.filter((f) => f !== file);
    }
    setFiles([]);
    const trimmed = note.trim();
    const res = await changeIssueStatus(
      issue.id,
      trimmed ? { status: 'solved', note: trimmed } : { status: 'solved' },
    );
    setBusy(false);
    inFlight.current = false;
    if (!res.success) {
      setError(errorText(res));
      return;
    }
    setNote('');
    onSolved(res.data);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={t('title')}
      description={t('body')}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void solve()}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {t('confirm')}
          </Button>
        </>
      }
    >
      <FormField id={noteId} label={t('noteLabel')}>
        <Textarea
          id={noteId}
          rows={3}
          maxLength={STATUS_NOTE_MAX}
          value={note}
          disabled={busy}
          placeholder={t('notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          className="text-base md:text-sm"
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <FileButton
          accept={PHOTO_MIME_TYPES.join(',')}
          multiple
          inputLabel={t('photosInput')}
          variant="outline"
          disabled={busy || room <= 0}
          onFiles={addFiles}
        >
          <ImagePlus aria-hidden />
          {t('addPhotos')}
        </FileButton>
        {files.length > 0 && (
          <ul className="flex flex-col gap-1.5" aria-label={t('chosen')}>
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border-2 border-border bg-card px-3 py-2"
              >
                <span className="min-w-0 truncate type-small">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={t('removePhoto', { name: file.name })}
                  onClick={() =>
                    setFiles((current) => current.filter((f) => f !== file))
                  }
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}

/** Cancel with a reason (business §5.6): the reason is the status change's note. */
export function CancelSheet({
  open,
  busy,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const t = useTranslations('issue.cancel');
  const tCommon = useTranslations('common.actions');
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);

  function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setMissing(true);
      return;
    }
    void onConfirm(trimmed);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('body')}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {tCommon('close')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={confirm}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {t('confirm')}
          </Button>
        </>
      }
    >
      <FormField
        id={reasonId}
        label={t('reasonLabel')}
        required
        error={missing ? t('reasonRequired') : undefined}
      >
        <Textarea
          id={reasonId}
          rows={3}
          required
          maxLength={STATUS_NOTE_MAX}
          value={reason}
          disabled={busy}
          placeholder={t('reasonPlaceholder')}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? `${reasonId}-error` : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            if (event.target.value.trim()) setMissing(false);
          }}
          className="text-base md:text-sm"
        />
      </FormField>
      {error && (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}
