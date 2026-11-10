'use client';

import { Images, SquareStack } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PHOTOS_PER_KIND_MAX } from '@muayana/shared';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';

/**
 * Several photos picked from the gallery for a new issue (business §5.1): one defect seen from
 * several sides (one issue with all of them, at most 10) or one defect each (an issue per photo,
 * their sheets one after another). Cancel stores nothing.
 */
export function GalleryChoiceSheet({
  files,
  onChoose,
  onCancel,
}: {
  files: File[] | null;
  /** `true`: one issue per photo. */
  onChoose: (separate: boolean) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('capture.gallery');
  const tCommon = useTranslations('common.actions');
  const count = files?.length ?? 0;
  const fitsOne = count <= PHOTOS_PER_KIND_MAX;
  return (
    <BottomSheet
      open={files !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t('title', { count })}
      description={t('description')}
      testId="gallery-choice"
      footer={
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          className="h-auto justify-start gap-3 py-3 text-start whitespace-normal"
          onClick={() => onChoose(true)}
          data-testid="gallery-separate"
        >
          <SquareStack className="size-6 shrink-0" aria-hidden />
          <span className="flex flex-col">
            <span>{t('separate', { count })}</span>
            <span className="type-micro font-normal opacity-80">
              {t('separateHint')}
            </span>
          </span>
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={!fitsOne}
          className="h-auto justify-start gap-3 py-3 text-start whitespace-normal"
          onClick={() => onChoose(false)}
          data-testid="gallery-together"
        >
          <Images className="size-6 shrink-0" aria-hidden />
          <span className="flex flex-col">
            <span>{t('together', { count })}</span>
            <span className="type-micro font-normal text-muted-foreground">
              {fitsOne
                ? t('togetherHint')
                : t('togetherTooMany', { max: PHOTOS_PER_KIND_MAX })}
            </span>
          </span>
        </Button>
      </div>
    </BottomSheet>
  );
}
