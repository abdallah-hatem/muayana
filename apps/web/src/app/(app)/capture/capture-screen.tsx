'use client';

import {
  Building2,
  Camera,
  ChevronDown,
  ImagePlus,
  Loader2,
  NotebookPen,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/form-field';
import { QueueChip } from '@/components/offline-queue/queue-sheet';
import { CameraInput } from '@/components/ui/camera-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PhotoUnreadableError } from '@/lib/compress-photo';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/utils';
import { ISSUE_DESCRIPTION_MAX, ISSUE_LOCATION_MAX } from '@muayana/shared';
import { takeShot, type ShotMode } from './capture-shot';
import { SitePicker } from './site-picker';
import { currentLastIssue, setLastIssue, useLastIssue } from './use-last-issue';
import { useCaptureSites } from './use-capture-sites';

type Status = { tone: 'info' | 'error'; key: string } | null;

/**
 * Capture on site (business §5.1, mockup screen 2): a dark camera view, the site chip and queue
 * badge on top, the last shot full-bleed, and a bottom panel with location, an optional note,
 * the last shot's thumbnail, the big shutter and "add to previous". Every photo is compressed
 * and queued on the phone first, so it works with no signal.
 */
export function CaptureScreen() {
  const t = useTranslations('capture');
  const online = useOnline();
  const { state: sitesState, site, setSiteId } = useCaptureSites();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const lastIssue = useLastIssue();
  const [lastShotUrl, setLastShotUrl] = useState<string | null>(null);
  const [shots, setShots] = useState(0);
  const [saving, setSaving] = useState(0);
  const [status, setStatus] = useState<Status>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<ShotMode>('new');
  // Shots are stored one after another, so "add to previous" always sees the issue before it.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(
    () => () => {
      if (lastShotUrl) URL.revokeObjectURL(lastShotUrl);
    },
    [lastShotUrl],
  );

  const canAttach = !!site && lastIssue?.siteId === site.id;

  const openCamera = (mode: ShotMode) => {
    if (!site) {
      setPickerOpen(true);
      return;
    }
    modeRef.current = mode;
    cameraRef.current?.click();
  };

  const onFiles = (files: File[]) => {
    if (!site) return;
    const mode = modeRef.current;
    modeRef.current = 'new';
    // The note belongs to a new issue; it waits for the next one when adding to the previous.
    const shotNote = mode === 'new' ? note : undefined;
    if (mode === 'new') {
      setNote('');
      setNoteOpen(false);
    }
    for (const [index, file] of files.entries()) {
      setSaving((n) => n + 1);
      chain.current = chain.current.then(async () => {
        try {
          const shot = await takeShot({
            file,
            siteId: site.id,
            // Several files in one pick: the first follows the mode, the rest join it.
            mode: index === 0 ? mode : 'attach',
            previous: currentLastIssue(),
            note: index === 0 ? shotNote : undefined,
            location,
          });
          setLastIssue(shot.lastIssue);
          setLastShotUrl(URL.createObjectURL(shot.photo));
          setShots((n) => n + 1);
          setStatus({
            tone: 'info',
            key: shot.item.kind === 'addPhoto' ? 'attached' : 'saved',
          });
        } catch (error) {
          setStatus({
            tone: 'error',
            key:
              error instanceof PhotoUnreadableError
                ? 'errors.PHOTO_UNREADABLE'
                : 'errors.generic',
          });
        } finally {
          setSaving((n) => n - 1);
        }
      });
    }
  };

  return (
    <section
      data-testid="screen-capture"
      className="dark -mx-4 -mt-4 -mb-36 flex flex-1 flex-col bg-background pb-30 text-foreground md:-mx-6 md:-mb-8 md:pb-0"
    >
      <CameraInput
        ref={cameraRef}
        onFiles={onFiles}
        data-testid="camera-input"
      />

      {/* Top: site chip and queue badge over the camera view. */}
      <div className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={sitesState.phase === 'loading'}
          data-testid="site-chip"
          aria-label={`${t('site.label')}: ${site?.name ?? t('site.choose')}`}
          className={cn(
            'flex h-10 min-w-0 press cursor-pointer items-center gap-1.5 rounded-full px-3 type-small font-bold',
            'disabled:cursor-not-allowed disabled:opacity-60',
            site
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-primary text-primary-foreground',
          )}
        >
          {sitesState.phase === 'loading' ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Building2 className="size-4 shrink-0" aria-hidden />
          )}
          <span className="truncate">
            {sitesState.phase === 'loading'
              ? t('site.loading')
              : (site?.name ?? t('site.choose'))}
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
        <QueueChip />
      </div>

      {!online && (
        <p className="mx-4 flex items-center gap-2 rounded-md bg-card px-3 py-2 type-small font-bold">
          <span
            className="h-4 w-6 shrink-0 rounded-sm hazard-stripe"
            aria-hidden
          />
          {t('offline')}
        </p>
      )}

      {/* The camera view: the last shot full-bleed, flashing when a new one lands. */}
      <div className="relative flex min-h-48 flex-1 items-center justify-center overflow-hidden">
        {lastShotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the photo just taken
          <img
            src={lastShotUrl}
            alt={t('lastShot')}
            // A photo that fails to decode keeps its box: no alt text spilling over the view.
            className="absolute inset-0 size-full overflow-hidden object-contain text-transparent"
          />
        ) : (
          <div className="flex max-w-64 flex-col items-center gap-3 p-6 text-center text-muted-foreground">
            <Camera className="size-12" aria-hidden />
            <p className="type-body">{t('empty')}</p>
          </div>
        )}
        {shots > 0 && (
          <div
            key={shots}
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-foreground opacity-0 motion-safe:animate-shutter"
          />
        )}
      </div>

      {/* Bottom panel: details, then thumbnail · shutter · add to previous. */}
      <div className="flex flex-col gap-3 border-t-2 border-border bg-card p-4">
        <FormField
          id="capture-location"
          label={`${t('location')} ${t('optional')}`}
        >
          <Input
            id="capture-location"
            value={location}
            maxLength={ISSUE_LOCATION_MAX}
            placeholder={t('locationPlaceholder')}
            onChange={(e) => setLocation(e.target.value)}
            autoComplete="off"
          />
        </FormField>
        {noteOpen ? (
          <FormField id="capture-note" label={`${t('note')} ${t('optional')}`}>
            <Textarea
              id="capture-note"
              rows={3}
              value={note}
              maxLength={ISSUE_DESCRIPTION_MAX}
              placeholder={t('notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="flex h-11 cursor-pointer items-center gap-2 self-start rounded-md px-1 type-small font-bold text-muted-foreground hover:text-foreground"
          >
            <NotebookPen className="size-5" aria-hidden />
            {t('addNote')}
          </button>
        )}

        <div className="grid grid-cols-3 items-center">
          <div className="justify-self-start">
            {lastShotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the photo just taken
              <img
                src={lastShotUrl}
                alt=""
                aria-hidden
                className="size-14 overflow-hidden rounded-lg border-2 border-primary bg-muted object-cover text-transparent"
              />
            ) : (
              <div className="size-14 rounded-lg border-2 border-dashed border-border" />
            )}
          </div>
          <button
            type="button"
            onClick={() => openCamera('new')}
            aria-label={t('shutter')}
            data-testid="shutter"
            className="flex size-21 press cursor-pointer items-center justify-center justify-self-center rounded-full border-[5px] border-foreground"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {saving > 0 ? (
                <Loader2 className="size-7 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-7" aria-hidden />
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => openCamera('attach')}
            disabled={!canAttach}
            aria-label={t('addToPreviousLabel')}
            title={canAttach ? undefined : t('addToPreviousUnavailable')}
            data-testid="add-to-previous"
            className="flex min-h-14 press cursor-pointer flex-col items-center justify-center gap-1 justify-self-end rounded-md px-2 type-micro font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ImagePlus className="size-7" aria-hidden />
            {t('addToPrevious')}
          </button>
        </div>

        <p
          role="status"
          className={cn(
            'min-h-5 text-center type-micro',
            status?.tone === 'error'
              ? 'text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {saving > 0 ? t('saving') : status ? t(status.key) : t('hint')}
        </p>
      </div>

      <SitePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        state={sitesState}
        selectedId={site?.id ?? null}
        onSelect={(id) => {
          setSiteId(id);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}
