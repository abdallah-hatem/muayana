'use client';

import { ImagePlus, Images, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { EmptyState } from '@/components/empty-state';
import { ShellTitle } from '@/components/shell/shell-title';
import { useSiteSelection } from '@/components/site/site-context';
import { Button } from '@/components/ui/button';
import { CameraInput } from '@/components/ui/camera-input';
import { syncQueue, type CaptureDetails } from '@/lib/offline-queue';
import {
  TRAY_WARN_AT,
  TrayPhotoMissingError,
  groupByImportDay,
  isQuotaError,
  keepPresent,
  photosOfSite,
  removeFromTray,
  togglePick,
  trayToIssue,
  useTray,
  type TraySelection,
} from '@/lib/photo-tray';
import { newUuid } from '@/lib/uuid';
import { CaptureSheet, type CaptureDraft } from '../capture-sheet';
import { SitePicker } from '../site-picker';
import { useCaptureLookups } from '../use-capture-lookups';
import { useCaptureSites } from '../use-capture-sites';
import { setLastIssue } from '../use-last-issue';
import { TrayActions, TrayGrid, TraySkeleton } from './tray-grid';
import {
  clearImportNotice,
  importToTray,
  useImportNotice,
} from './tray-import';

/** The issue being made from the tray: its sheet's draft, the site, and the photos in pick order. */
type TrayDraft = CaptureDraft & { siteId: string; photoIds: string[] };

/**
 * «صور غير مرتبة» — the unsorted photos tray (business §5.1 step 5, N6, mockup A1). Gallery
 * photos wait here on the phone, per site (every site's on "All sites"). Tapping photos picks
 * them, numbered in pick order; «إنشاء ملاحظة» opens the capture sheet with them (asking the site
 * first on "All sites"), and saving makes ONE issue of them: they leave the tray, the rest stay.
 */
export function TrayScreen() {
  const t = useTranslations('tray');
  const selection = useSiteSelection();
  const { state: sitesState, site } = useCaptureSites();
  const lookups = useCaptureLookups();
  const { photos, importing } = useTray();
  const notice = useImportNotice();
  const [picked, setPicked] = useState<TraySelection>([]);
  const [draft, setDraft] = useState<TrayDraft | null>(null);
  const [askSite, setAskSite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // The place carries over to the next issue, as on the camera.
  const [location, setLocation] = useState('');
  const galleryRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<TrayDraft | null>(null);

  const visible = photos ? photosOfSite(photos, selection.siteId) : null;
  // Picks of photos that left (another site chosen, made into an issue) drop out.
  const picks = visible ? keepPresent(picked, visible) : picked;

  // The sheet's thumbnails are its own object URLs: they outlive the photos leaving the tray.
  useEffect(
    () => () => draftRef.current?.photos.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );

  const showDraft = (next: TrayDraft | null) => {
    draftRef.current?.photos.forEach((u) => URL.revokeObjectURL(u));
    draftRef.current = next;
    setDraft(next);
  };

  const onToggle = (id: string) => {
    const result = togglePick(picks, id);
    if (result.blocked) toast.warning(t('limit'), { id: 'tray-limit' });
    else setPicked(result.selection);
  };

  const openSheet = (siteId: string) => {
    if (!visible) return;
    const byId = new Map(visible.map((p) => [p.id, p]));
    const chosen = picks.flatMap((id) => byId.get(id) ?? []);
    if (chosen.length === 0) return;
    showDraft({
      // Made once per sheet: a retried save reuses it, so it can never make two issues.
      issueId: newUuid(),
      siteId,
      photoIds: chosen.map((p) => p.id),
      photos: chosen.map((p) =>
        URL.createObjectURL(new Blob([p.photo.bytes], { type: p.photo.type })),
      ),
    });
  };

  const onCreate = () => {
    // "All sites": which site the issue is on is asked first.
    if (selection.siteId === null || !site) setAskSite(true);
    else openSheet(site.id);
  };

  const onSave = async (details: CaptureDetails | null) => {
    const open = draftRef.current;
    if (!open || busy) return;
    setBusy(true);
    try {
      await trayToIssue({
        issueId: open.issueId,
        siteId: open.siteId,
        photoIds: open.photoIds,
        details: details ?? {},
      });
      setLastIssue({ issueId: open.issueId, siteId: open.siteId });
      if (details) setLocation(details.location ?? '');
      setPicked([]);
      showDraft(null);
      toast.success(t('saved'));
      void syncQueue();
    } catch (error) {
      // Nothing was stored: the photos are all still in the tray and the sheet stays to retry.
      if (error instanceof TrayPhotoMissingError) {
        showDraft(null);
        toast.error(t('errors.missing'));
      } else
        toast.error(
          isQuotaError(error) ? t('errors.full') : t('errors.generic'),
        );
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    const ids = [...picks];
    setBusy(true);
    try {
      await removeFromTray(ids);
      setPicked([]);
      setConfirmDelete(false);
      toast.success(t('deleted', { count: ids.length }));
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const onImport = () => galleryRef.current?.click();
  const groups = visible ? groupByImportDay(visible) : [];
  // The site the picked photos share, preselected when the site is asked.
  const pickedSites = new Set(
    picks.map((id) => visible?.find((p) => p.id === id)?.siteId ?? null),
  );
  const commonSite =
    pickedSites.size === 1 ? ([...pickedSites][0] ?? null) : null;

  return (
    <section
      data-testid="screen-tray"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
    >
      {/* The top bar's short name: a phone keeps the room for the site switcher. */}
      <ShellTitle title={t('shellTitle')} />
      <CameraInput
        ref={galleryRef}
        source="gallery"
        onFiles={(files) => void importToTray(files, selection.siteId)}
        data-testid="tray-gallery-input"
      />

      {notice && <ImportNoticeBanner />}

      {visible === null ? (
        <TraySkeleton />
      ) : visible.length === 0 && importing === 0 ? (
        <EmptyState
          icon={Images}
          title={t('empty.title')}
          body={t('empty.body')}
          action={
            <Button
              type="button"
              onClick={onImport}
              data-testid="tray-import-empty"
            >
              <ImagePlus aria-hidden />
              {t('import')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="type-body text-muted-foreground">{t('hint')}</p>
            {selection.siteId === null && (
              <p className="type-small text-muted-foreground">
                {t('allSites')}
              </p>
            )}
          </div>
          {importing > 0 && (
            <p role="status" className="type-small font-bold">
              {t('importing', { count: importing })}
            </p>
          )}
          {visible.length > TRAY_WARN_AT && (
            <p
              data-testid="tray-many"
              className="flex items-center gap-2 rounded-md border-2 border-foreground/80 bg-card px-3 py-2 type-small font-bold"
            >
              <span
                className="h-4 w-6 shrink-0 rounded-sm hazard-stripe"
                aria-hidden
              />
              {t('manyPhotos', { count: visible.length })}
            </p>
          )}
          <TrayGrid
            groups={groups}
            importing={importing}
            selection={picks}
            onImport={onImport}
            onToggle={onToggle}
          />
          {/* Room for the action card, so the last row can scroll clear of it. */}
          {picks.length > 0 && <div aria-hidden className="h-32 md:h-28" />}
        </>
      )}

      {picks.length > 0 && !draft && (
        <TrayActions
          count={picks.length}
          onDelete={() => setConfirmDelete(true)}
          onCreate={onCreate}
        />
      )}

      <CaptureSheet
        draft={draft}
        lookups={lookups}
        initialLocation={location}
        addingPhoto={busy}
        onSave={(details) => void onSave(details)}
        onClose={() => showDraft(null)}
      />

      <SitePicker
        open={askSite}
        onOpenChange={setAskSite}
        state={sitesState}
        selectedId={commonSite}
        onSelect={(id) => {
          setAskSite(false);
          openSheet(id);
        }}
      />

      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteTitle', { count: picks.length })}
        body={t('deleteBody')}
        confirmLabel={t('deleteYes')}
        destructive
        busy={busy}
        onConfirm={() => void onDelete()}
      />
    </section>
  );
}

/** How the last import ended, when some photos were left out or storage ran out. */
function ImportNoticeBanner() {
  const t = useTranslations('tray');
  const notice = useImportNotice();
  if (!notice) return null;
  const lines: string[] = [];
  if (notice.kind === 'failed')
    lines.push(notice.full ? t('errors.full') : t('notice.failed'));
  else {
    if (notice.notStored > 0)
      lines.push(t('notice.full', { count: notice.notStored }));
    if (notice.unreadable > 0)
      lines.push(t('notice.unreadable', { count: notice.unreadable }));
  }
  if (lines.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="tray-notice"
      className="flex items-start gap-2 rounded-md border-2 border-destructive bg-card py-1 ps-3 pe-1 type-small font-bold"
    >
      <div className="flex flex-1 flex-col gap-1 py-2">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={clearImportNotice}
        aria-label={t('notice.dismiss')}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
