# Feature spec — unsorted photos tray «صور غير مرتبة» (N6)
Date: 2026-11-21 · Owner request: "I can import as many images that I want from gallery to the app, maybe they
live in an unassigned images for example, then at any time I can go and create an issue with those images. Lets
say I import 5 images, I select three to make one issue, then select 1 for another issue…"
Design: mockup **A** (tray with capture; badge on the camera button). Business: §5.1 step 5, §5.2 — updated the
same day. Web only: no API, shared or schema change.

## Behaviour
- Gallery picks outside an open capture sheet go to the tray (route `/capture/tray`), which opens with the
  just-imported photos first. Inside an open sheet, "From gallery" still adds to that issue (N5, unchanged).
- Per site: the tray is the top bar's site; "All sites" shows every photo and asks the site (existing site
  picker) before the sheet opens. Photos imported on "All sites" have no site until they become an issue.
- Tap = pick; picks are numbered in tap order (yellow ring + number), unpicking renumbers. 10 max per issue.
- «إنشاء ملاحظة من N صور» opens the existing capture sheet (no "add photo" buttons; closing keeps the photos in
  the tray). Save / Photo only → one issue; its photos leave the tray.
- «حذف» → confirm sheet → photos removed from the phone.
- Entry points: capture page button «صور غير مرتبة · N», dashboard card while N > 0, auto-open after an import;
  red badge (N) on the nav camera button, its label includes the count.

## Storage (web)
- IndexedDB `muayana-capture` v2 adds a `tray` store beside `queue` (v1 → v2 upgrade keeps the queue).
  A row: phone-made id, siteId|null, importedAt, seq, capturedAt (file date rule), compressed JPEG bytes.
- Import compresses each photo (`compressPhoto`) and stores it in its own write, so a full disk keeps the ones
  before it (QuotaExceededError → "storage full: N not kept"); unreadable photos are left out and counted.
- Make issue = ONE transaction over `queue` + `tray`: `create` (first pick, id = the sheet's phone-made issue
  id) + `addPhoto` per other pick (same issueId), consecutive seq after the queue's last, then the tray rows
  are deleted. Abort → nothing changes. Same issue id again → `already` (no duplicate). Then `syncQueue()`.
- Code: `apps/web/src/lib/photo-tray/` (store, selection, hook), `apps/web/src/app/(app)/capture/tray/` (screen,
  grid, import, entry), `_dashboard/tray-card.tsx`, shutter badge in `components/shell/bottom-nav.tsx`.
  The service worker also keeps `/capture/tray` for offline (cache v2).

## Edge cases ↔ tests
- [x] add / list per site / All sites / remove / survives reload / v1→v2 keeps queue / quota — `lib/photo-tray/tray.test.ts`
- [x] pick order numbering, unpick renumbers, 11th blocked, groups by day — `lib/photo-tray/selection.test.ts`, `tray-screen.test.tsx`
- [x] create + addPhoto in pick order, after existing queue items; retry no duplicate; failed write keeps the tray — `tray.test.ts`
- [x] photos leave the tray only after enqueue; close sheet = nothing; All sites asks the site — `tray-screen.test.tsx`
- [x] delete with confirm (cancel keeps) — `tray-screen.test.tsx`
- [x] badge count per site / all sites / gone at 0 — `components/shell/bottom-nav.test.tsx`; dashboard card — `tray-card.test.tsx`
- [x] gallery outside the sheet → tray + route; inside the sheet → attaches — `capture/capture-screen.test.tsx`
- [x] >100 warning; storage full on import — `tray-screen.test.tsx`
- [x] e2e: 5 imported → 3 into one issue (3 photos on the server) → 2 left → 1 more → 1 left, survives reload — `e2e/capture.spec.ts`

## Not in this round
Adding tray photos to an existing issue; syncing the tray across devices.
