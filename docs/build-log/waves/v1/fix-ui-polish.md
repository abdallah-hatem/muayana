# fix/ui-polish — UI re-audit findings (N1–N13, M11 leftovers, m3)

Branch `fix/ui-polish` (from dev). Code commit `7abdc2f`. Agent 6 (API 3161, web 3163, DB `muayana_polish`,
seeded with `SEED_ALLOW_SAMPLE=true`). Audit: `docs/build-log/waves/v1/ui-reaudit.md`. Decisions from fix-ui-kit /
fix-ui-screens were kept (list styles, 44px kit sizes, sheets, switcher container query, `dir="auto"` on user text).

Screenshots (gitignored): `.logs/polish-shots/<screen>__<state>__<m360|d1440>-<ar|en>-<light|dark>.png`, all eight
variants per screen, from `.logs/shots.cjs` (plus `bulk-desk.cjs`, `fv5.cjs`).

## Finding → fix → proof

| # | Fix | Proof |
|---|---|---|
| N1 (major) | `workers-screen.tsx` (card + table) and `categories-screen.tsx`: the name line is `flex-wrap`; the name is `max-w-full truncate dir="auto"`, so the badge wraps under a name that needs the room. A name is only cut when it alone is wider than the line. | `workers__deactivated__m360-en-{light,dark}` ("أشرف الحداد" whole, DEACTIVATED below) |
| N3 | `ui/tabs.tsx`: in dark the selected segment is filled in ink (`bg-foreground text-background`), as the priority picker does. The `dark:text-muted-foreground` that beat the active colour is gone. | `issue__assigned__m360-en-dark`, `zoom-tabs-dark` |
| N4 | `site-switcher.tsx`: the `@max-[7rem]:hidden` never applied. The kit's `*:data-[slot=select-value]:flex` outranked it. The query now hides the inner label span, and the threshold is 7.5rem, so next to the queue chip it shows the pin only. | `topbar__queue-dashboard__m360-*`, `topbar__queue-workers__m360-en-light` |
| N5 | `dashboard-screen.tsx`: `site.showing` became `Showing <name>{site}</name> only` (ar `عرض <name>{site}</name> فقط`) and is rendered with `t.rich`. The name is a `<bdi dir="auto">` that truncates, and the words never truncate. | `topbar__queue-dashboard__m360-en-light` ("Showing برج النخيل – التجمع الخا… only"); test updated |
| N6 | `capture-screen.tsx`: the chip label is `dir="auto" text-start`, so it keeps the start of the name. | `capture__queued-corrupt__m360-en-light` ("برج النخيل …") |
| N7 | Shorter en copy: "Set the worker's date". The ar copy was unchanged because it fits. | `issue__estimate-button__m360-en-light` |
| N8 | New `--bottom-nav-height` token (globals.css, the nav's own sum: 2px + 4px + 56px + pb-safe). The sorter bar and bulk bar stick at `bottom-(--bottom-nav-height)`. Measured bar bottom = nav top = 706. | `inbox__sorter-scrolled__m360-en-light`, `inbox__bulk-selected-scrolled__m360-ar-dark` |
| N9 | From md up both bars are `md:bottom-4 md:shadow-float`: a floating card, never flush with the window. | `inbox__bulk-stuck__d1440x560-{en-light,ar-dark}` (bar bottom 544 of 560) |
| M11 | Tabs: track `p-0.5`, triggers `min-h-11` (44px, measured). Priority radios `h-11`. Filter-chip remove: 36px chip with an `after:-inset-y-1` hit area (44px). Capture site chip `h-11` (44px, measured). Table "#n" link `min-w-11` (44×44, measured). | `issues__chips__*`, script output |
| N10 | `date-picker.tsx`: the 112px bottom padding applies only below md (new `lib/use-media-query.ts`, `BOTTOM_NAV_QUERY`). From md, Radix flips only at the window edge. At 1440 the calendar opens below the trigger (426–474 → 480–836); at 360 it still flips above. | `issue__estimate-picker__d1440-*`, `__m360-*` |
| N11 | Cause: Radix Tabs calls `.focus()` on mouse down, and browsers treat script focus as `:focus-visible`, so every tap drew the keyboard ring. `TabsTrigger` marks a pointer press (`data-pointer-focus`), which a key press or blur clears. New `focus-key:` variant, and the global `:focus-visible` outline skips marked controls. Keyboard focus still shows the ring. | `zoom-tabs-{light,dark}` (tapped, no ring), `zoom-tabs-keyboard-*` (ring); `tabs.test.tsx` ×3 |
| N12 | `hazard-stripe` in dark adds an inset 1.5px `--hazard-a` edge, so the tape keeps its shape on a dark card. | `notfound__issue__d1440-en-dark`, `topbar__queue-dashboard__m360-ar-dark` |
| N13 | One grabber, `SHEET_GRABBER` in `ui/overlay-close.ts`, used by the vaul Drawer and by every bottom `Sheet` (BottomSheet, confirm sheets, filter sheet). The ✕ moves down to stay level with the title. | `inbox__category-sheet__m360-*` vs `topbar__queue-sheet__m360-ar-dark` |
| m3 | Verified with real failures: a 404 on every `/uploads/` URL (route mock) and a corrupt JPEG queued offline. Both showed the browser's broken-image icon in the camera view, the last-shot thumbnail, issue covers and the gallery. New `components/photo.tsx`: `FillPhoto` (next/image, used by IssueCover, PhotoGallery, inbox bulk) and `LocalPhoto` (object URLs, used by capture and the queue). On error they show the existing "no picture" mark in the same box. | `capture__queued-corrupt__m360-*`, `issues__broken-images__*`, `issue__broken-images__*`, `topbar__queue-sheet__*`; `photo.test.tsx` ×2 |

## Results

- Web unit: `Test Files 34 passed (34) · Tests 205 passed (205)` (+5: `tabs.test.tsx` ×3, `photo.test.tsx` ×2;
  `dashboard-screen.test.tsx` and `status-actions.test.tsx` were adjusted to the bdi and the new copy).
- Smoke, own servers (:3163 / :3161): one warm run, then a measured run with `--retries=0`: **22 passed, 2 skipped**
  (overlay-shift is desktop-only).
- `npm run lint` 0 errors (3 pre-existing warnings in `use-paged-list.test.tsx`). `npm run typecheck` ✓.

## Notes

- New shared pieces: `components/photo.tsx`, `lib/use-media-query.ts`, `SHEET_GRABBER`, the `--bottom-nav-height`
  token, and the `focus-key` variant. Use these instead of local copies.
- The business docs are unchanged.
