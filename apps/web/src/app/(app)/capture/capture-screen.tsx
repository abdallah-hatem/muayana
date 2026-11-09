'use client';

import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LocalPhoto } from '@/components/photo';
import { QueueChip } from '@/components/offline-queue/queue-sheet';
import { CameraInput } from '@/components/ui/camera-input';
import { PhotoUnreadableError } from '@/lib/compress-photo';
import type { CaptureDetails } from '@/lib/offline-queue';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/utils';
import { CaptureSheet, type CaptureDraft } from './capture-sheet';
import { saveCapture, takeShot } from './capture-shot';
import { SitePicker } from './site-picker';
import { currentLastIssue, setLastIssue, useLastIssue } from './use-last-issue';
import { useCaptureLookups } from './use-capture-lookups';
import { useCaptureSites } from './use-capture-sites';

type Status = { tone: 'info' | 'error'; key: string } | null;

/**
 * What the camera was opened for: a new issue (its sheet opens after the photo), another photo
 * for the issue whose sheet is open, or a photo added to the previous issue.
 */
type CameraMode = 'new' | 'sheet' | 'previous';

/**
 * Capture on site (business §5.1, mockup screen 2): a dark camera view, the queue badge on top
 * (the site is the top bar's switcher), the last shot full-bleed, and a bottom panel with the last shot's thumbnail, the
 * big shutter and "add to previous". After a new issue's photo(s), one sheet holds its details
 * (CaptureSheet). Every photo is compressed and kept on the phone first, so it works with no
 * signal; the sheet's photos wait as drafts until it is saved.
 */
export function CaptureScreen() {
  const t = useTranslations('capture');
  const online = useOnline();
  const { state: sitesState, site, setSiteId } = useCaptureSites();
  const lookups = useCaptureLookups();
  const [pickerOpen, setPickerOpen] = useState(false);
  // The place carries over to the next capture: a walk shoots several defects in one room.
  const [location, setLocation] = useState('');
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const lastIssue = useLastIssue();
  const [lastShotUrl, setLastShotUrl] = useState<string | null>(null);
  const [shots, setShots] = useState(0);
  const [saving, setSaving] = useState(0);
  const [status, setStatus] = useState<Status>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<CameraMode>('new');
  // The issue whose sheet is open (or opening), read by the shot chain and on unmount.
  const draftRef = useRef<CaptureDraft | null>(null);
  // Shots are stored one after another, so a joining photo always sees the issue before it.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(
    () => () => {
      if (lastShotUrl) URL.revokeObjectURL(lastShotUrl);
    },
    [lastShotUrl],
  );

  // Leaving the screen with the sheet open keeps the photos: they go up as "photo only".
  useEffect(
    () => () => {
      const open = draftRef.current;
      if (!open) return;
      draftRef.current = null;
      chain.current = chain.current.then(() => saveCapture(open.issueId));
      open.photos.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const showDraft = (next: CaptureDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const canAttach = !!site && lastIssue?.siteId === site.id;

  const openCamera = (mode: CameraMode) => {
    if (!site) {
      setPickerOpen(true);
      return;
    }
    modeRef.current = mode;
    cameraRef.current?.click();
  };

  /** One stored photo: where it goes, and what the screen shows after. */
  const storeShot = async (file: File, siteId: string, mode: CameraMode) => {
    const open = draftRef.current;
    const joinsDraft = mode === 'sheet' && open !== null;
    const shot = await takeShot({
      file,
      siteId,
      mode: mode === 'previous' || joinsDraft ? 'attach' : 'new',
      previous: joinsDraft
        ? { issueId: open.issueId, siteId }
        : currentLastIssue(),
      draft: mode !== 'previous',
    });
    setLastShotUrl(URL.createObjectURL(shot.photo));
    setShots((n) => n + 1);
    if (mode === 'previous') {
      setLastIssue(shot.lastIssue);
      setStatus({
        tone: 'info',
        key: shot.item.kind === 'addPhoto' ? 'attached' : 'saved',
      });
      return;
    }
    const url = URL.createObjectURL(shot.photo);
    showDraft(
      joinsDraft
        ? { ...open, photos: [...open.photos, url] }
        : { issueId: shot.lastIssue.issueId, photos: [url] },
    );
  };

  const onFiles = (files: File[]) => {
    if (!site) return;
    const mode = modeRef.current;
    modeRef.current = 'new';
    for (const [index, file] of files.entries()) {
      // Several files in one pick: the first follows the mode, the rest join the same issue.
      const fileMode = index === 0 || mode === 'previous' ? mode : 'sheet';
      setSaving((n) => n + 1);
      chain.current = chain.current.then(async () => {
        try {
          await storeShot(file, site.id, fileMode);
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

  /** The sheet is saved (`null`: photo only): the drafted issue and its photos go up together. */
  const onSave = (details: CaptureDetails | null) => {
    const open = draftRef.current;
    if (!open || !site) return;
    showDraft(null);
    if (details) setLocation(details.location ?? '');
    setLastIssue({ issueId: open.issueId, siteId: site.id });
    setStatus({ tone: 'info', key: 'saved' });
    chain.current = chain.current.then(() =>
      saveCapture(open.issueId, details ?? {}),
    );
    open.photos.forEach((url) => URL.revokeObjectURL(url));
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

      {/* Top: the queue badge over the camera view. The site is the top bar's switcher (one
          picker per screen); the shutter asks for one when none is chosen. */}
      <div className="flex items-center justify-end gap-2 p-4">
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
          // A photo that fails to decode shows the "no picture" mark, never a broken-image icon.
          <LocalPhoto
            key={lastShotUrl}
            src={lastShotUrl}
            alt={t('lastShot')}
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

      {/* Bottom panel: thumbnail · shutter · add to previous. */}
      <div className="flex flex-col gap-3 border-t-2 border-border bg-card p-4">
        <div className="grid grid-cols-3 items-center">
          <div className="justify-self-start">
            {lastShotUrl ? (
              <LocalPhoto
                key={lastShotUrl}
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
            onClick={() => openCamera('previous')}
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

      <CaptureSheet
        draft={draft}
        lookups={lookups}
        initialLocation={location}
        addingPhoto={saving > 0}
        onAddPhoto={() => openCamera('sheet')}
        onSave={onSave}
      />

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
