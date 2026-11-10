'use client';

import { Camera, ImagePlus, Images, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { PHOTOS_PER_KIND_MAX } from '@muayana/shared';
import { LocalPhoto } from '@/components/photo';
import { QueueChip } from '@/components/offline-queue/queue-sheet';
import { CameraInput } from '@/components/ui/camera-input';
import { PhotoUnreadableError } from '@/lib/compress-photo';
import type { CaptureDetails } from '@/lib/offline-queue';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/utils';
import { CaptureSheet, type CaptureDraft } from './capture-sheet';
import { galleryTakenAt, saveCapture, takeShot } from './capture-shot';
import { GalleryChoiceSheet } from './gallery-choice-sheet';
import { SitePicker } from './site-picker';
import { currentLastIssue, setLastIssue, useLastIssue } from './use-last-issue';
import { useCaptureLookups } from './use-capture-lookups';
import { useCaptureSites } from './use-capture-sites';

type Status = {
  tone: 'info' | 'error';
  key: string;
  values?: Record<string, number>;
} | null;

/**
 * What the camera was opened for: a new issue (its sheet opens after the photo), another photo
 * for the issue whose sheet is open, or a photo added to the previous issue.
 */
type CameraMode = 'new' | 'sheet' | 'previous';

/**
 * Where one stored photo goes: as the camera was opened, or (`queued`) a new issue of its own
 * whose sheet opens after the one on screen — photos picked from the gallery as separate issues.
 */
type ShotMode = CameraMode | 'queued';

type Source = 'camera' | 'gallery';

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
  // Several photos picked from the gallery for a new issue: one issue, or one issue each?
  const [choice, setChoice] = useState<File[] | null>(null);
  // Separate issues stored on the phone, whose sheets open one after another.
  const [waiting, setWaiting] = useState(0);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const waitingRef = useRef<CaptureDraft[]>([]);
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

  // Leaving the screen with the sheet open keeps the photos: they go up as "photo only" — and so
  // do the gallery issues still waiting for their sheet.
  useEffect(
    () => () => {
      const left = [draftRef.current, ...waitingRef.current].filter(
        (d): d is CaptureDraft => d !== null,
      );
      draftRef.current = null;
      waitingRef.current = [];
      for (const open of left) {
        chain.current = chain.current.then(() => saveCapture(open.issueId));
        open.photos.forEach((url) => URL.revokeObjectURL(url));
      }
    },
    [],
  );

  const showDraft = (next: CaptureDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const canAttach = !!site && lastIssue?.siteId === site.id;

  const openPicker = (mode: CameraMode, source: Source = 'camera') => {
    if (!site) {
      setPickerOpen(true);
      return;
    }
    modeRef.current = mode;
    (source === 'gallery' ? galleryRef : cameraRef).current?.click();
  };

  /** One stored photo: where it goes, and what the screen shows after. */
  const storeShot = async (
    file: File,
    siteId: string,
    mode: ShotMode,
    source: Source,
  ) => {
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
      capturedAt: source === 'gallery' ? galleryTakenAt(file) : undefined,
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
    const own = { issueId: shot.lastIssue.issueId, photos: [url] };
    if (joinsDraft) showDraft({ ...open, photos: [...open.photos, url] });
    // A separate gallery issue waits its turn while another sheet is open.
    else if (mode === 'queued' && open !== null) {
      waitingRef.current = [...waitingRef.current, own];
      setWaiting(waitingRef.current.length);
    } else showDraft(own);
  };

  /**
   * Stores a pick in order. The first photo follows the mode; the rest join the same issue, or
   * (`separate`) each opens an issue of its own. An issue never takes more than 10 photos.
   */
  const storeFiles = (
    picked: File[],
    mode: CameraMode,
    source: Source,
    separate = false,
  ) => {
    if (!site) return;
    const open = draftRef.current;
    const room =
      separate || mode === 'previous'
        ? picked.length
        : PHOTOS_PER_KIND_MAX -
          (mode === 'sheet' && open ? open.photos.length : 0);
    const files = picked.slice(0, Math.max(0, room));
    if (files.length < picked.length)
      setStatus({
        tone: 'error',
        key: 'tooMany',
        values: { count: picked.length - files.length },
      });
    for (const [index, file] of files.entries()) {
      const fileMode: ShotMode =
        index === 0 || mode === 'previous'
          ? mode
          : separate
            ? 'queued'
            : 'sheet';
      setSaving((n) => n + 1);
      chain.current = chain.current.then(async () => {
        try {
          await storeShot(file, site.id, fileMode, source);
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

  const onFiles = (source: Source, files: File[]) => {
    if (!site) return;
    const mode = modeRef.current;
    modeRef.current = 'new';
    // Several gallery photos for a new issue: ask whether they are one defect or several.
    if (source === 'gallery' && mode === 'new' && files.length > 1) {
      setChoice(files);
      return;
    }
    storeFiles(files, mode, source);
  };

  /** The sheet is saved (`null`: photo only): the drafted issue and its photos go up together. */
  const onSave = (details: CaptureDetails | null) => {
    const open = draftRef.current;
    if (!open || !site) return;
    // The next separate gallery issue, if any, takes the sheet.
    const [next, ...rest] = waitingRef.current;
    waitingRef.current = rest;
    setWaiting(rest.length);
    showDraft(next ?? null);
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
        onFiles={(files) => onFiles('camera', files)}
        data-testid="camera-input"
      />
      <CameraInput
        ref={galleryRef}
        source="gallery"
        onFiles={(files) => onFiles('gallery', files)}
        data-testid="gallery-input"
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

      {/* Bottom panel: from the gallery (showing the last shot) · shutter · add to previous. */}
      <div className="flex flex-col gap-3 border-t-2 border-border bg-card p-4">
        <div className="grid grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => openPicker('new', 'gallery')}
            aria-label={t('galleryLabel')}
            data-testid="from-gallery"
            className="flex min-h-14 press cursor-pointer flex-col items-center justify-center gap-1 justify-self-start rounded-md px-2 type-micro font-bold"
          >
            {lastShotUrl ? (
              <LocalPhoto
                key={lastShotUrl}
                src={lastShotUrl}
                alt=""
                aria-hidden
                className="size-11 overflow-hidden rounded-lg border-2 border-primary bg-muted object-cover text-transparent"
              />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-lg border-2 border-dashed border-border">
                <Images className="size-6" aria-hidden />
              </span>
            )}
            {t('fromGallery')}
          </button>
          <button
            type="button"
            onClick={() => openPicker('new')}
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
            onClick={() => openPicker('previous')}
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
          {saving > 0
            ? t('saving')
            : status
              ? t(status.key, status.values)
              : t('hint')}
        </p>
      </div>

      <CaptureSheet
        draft={draft}
        lookups={lookups}
        initialLocation={location}
        addingPhoto={saving > 0}
        waiting={waiting}
        onAddPhoto={() => openPicker('sheet')}
        onAddFromGallery={() => openPicker('sheet', 'gallery')}
        onSave={onSave}
      />

      <GalleryChoiceSheet
        files={choice}
        onCancel={() => setChoice(null)}
        onChoose={(separate) => {
          const files = choice;
          setChoice(null);
          if (files) storeFiles(files, 'new', 'gallery', separate);
        }}
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
