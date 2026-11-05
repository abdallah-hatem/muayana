# fix/ui-kit — shared UI kit fixes from the v1 UI audit

Branch `fix/ui-kit` (from `dev`), commit `3c18c10`. Scope: the shared kit (`components/ui/*`, `globals.css`, root
layout/providers, calendar + date picker, not-found pages). Per-screen layout was fixed in parallel on another branch.

Verified against agent DB `muayana_uikit` (sample seed), API :3111, web :3113, Chromium with real scrollbars.
Screenshots (gitignored): `.logs/kit-shots/<shot>__{m360,d1440}-{ar,en}-{light,dark}.png` — 72 shots: site switcher
open, filter select open (sheet at 360, panel at 1440), filter sheet, estimate date picker, filter date popover,
export dialog, sites segmented control, issue / worker / page not found.

## Finding → fix → proof

| # | Fix | Proof |
|---|---|---|
| M1 | `components/direction-provider.tsx`: Radix `Direction.Provider` fed by `useLocale()`, mounted inside `NextIntlClientProvider` in `app/layout.tsx`. Select, DropdownMenu, Popover, Tabs now lay out and key-navigate RTL in Arabic. | `direction-provider.test.tsx` (ar → trigger `dir="rtl"`, en → `ltr`); `site-switcher-open__d1440-ar-light`, `filter-select-open__m360-ar-dark`: value and items right-aligned, chevron and check on the left. |
| M2 | `components/ui/list-styles.ts` holds one list look shared by Select, DropdownMenu, Command and Popover: solid `bg-popover` card, 2px border, `shadow-float`, 44px rows, 16px medium text, `primary` (safety yellow) highlight with ink text — muted text/icons inside a highlighted row switch to ink —, bold checked row, 3px-stroke check in `primary-ink`. Select defaults to `position="popper"`, `align="start"`, 6px offset, at least the trigger's width; scroll buttons restyled. Select trigger: solid in dark mode too (no `dark:bg-input/30`), placeholder token, open border, rotating chevron. | `site-switcher-open__*`, `filter-select-open__*` (both themes, both directions). |
| M3 | `globals.css`: `html { scrollbar-gutter: stable }` and `html body[data-scroll-locked] { overflow: visible; margin/padding 0; --removed-body-scroll-bar-size: 0 }` (all `!important`). The lock still blocks wheel/touch scroll. | `e2e/overlay-shift.spec.ts` (`@smoke`, desktop, ar + en): rects of `<main>` and every fixed element plus the page gutter are identical before/after opening the site-switcher Select, the export Dialog and the new-site Sheet. **Passes** with the fix; with the old `globals.css` it **fails** — ar: side nav x 1174→1184, en: gutter 10→0. |
| M8 | `components/ui/calendar.tsx`: `locale` from `react-day-picker/locale` (`ar` / `enUS`) by the next-intl locale, `dir`, `weekStartsOn` 6 (ar) / 0 (en); DayPicker's nav always asks for "left" on previous, so the Chevron swaps left/right in RTL (the old CSS `rotate-180` hack is gone). 44px cells, bold stencil day numbers, today outlined in `primary-ink`, `bg-card`. | `calendar.test.tsx` (ar: "نوفمبر", `dir=rtl`, first weekday السبت, previous arrow is chevron-right; en: "November 2026", Sunday first); `estimate-picker__*`, `filter-date-open__d1440-*`. |
| m1 | `components/date-picker.tsx`: `collisionPadding` bottom 112px, so the calendar flips above the trigger instead of running under the bottom nav's shutter. | `estimate-picker__m360-*`: the popover opens upward, clear of the nav. |
| M9 | `components/not-found-view.tsx` (hazard tape, icon, title, body, one way back) used by `app/not-found.tsx` (bare page), `app/(app)/not-found.tsx` (inside the shell), `app/(app)/issues/[id]/not-found.tsx` and `app/(app)/workers/[id]/not-found.tsx` (specific copy, back to the list). New namespace `errors` (ar + en), registered in `i18n/config.ts`. | `issue-not-found__*`, `worker-not-found__*`, `page-not-found__*`: translated, dark mode correct. |
| M11 (kit) | Sheet + Dialog ✕: `components/ui/overlay-close.ts`, 44px button (20px icon) at `end-2 top-2`. Checkbox: 20px box, 2px border, solid card, invisible `-inset-3` (44px) hit area. Switch: 44×24 track, 44px-tall hit area, thumb now moves the right way in RTL. Tabs: list 48px, triggers bold with a solid active card — fixes Segmented (Active/Archived) and the issue page's Before/After tabs, which were 29px because the kit's `h-9` beat the caller's `h-12`. Button `sm` 40→44px, `icon-sm` 40→44px (pager, Edit, Clear all, date buttons, filter-chip clear). Outline button solid in dark mode. | `export-dialog__*` (close ✕, checkboxes), `filter-sheet__m360-*`, `sites-segmented__*` (48px segments, 44px Edit/Archive, pager). |

## Not fixed here

- **n1** (dev overlay "1 Issue" on the in-shell 404): React's "Encountered a script tag" warning is still logged
  when the `(app)` not-found boundary renders (next-themes' inline script re-rendered on the client). Dev only;
  the bare root 404 doesn't log it.
- Everything outside the kit (B1, M4–M7, M10, the rest of M11 — inbox checkbox placement, breadcrumbs, dashboard
  links, queue chip — and m2–m7) belongs to the per-screen branch.

## Tests

- Web unit: `Test Files 29 passed (29) · Tests 192 passed (192)` (+5: `direction-provider.test.tsx` ×2,
  `calendar.test.tsx` ×3).
- Playwright: `e2e/overlay-shift.spec.ts --project=desktop` → `2 passed` (and `2 failed` against the old CSS).
- `npm run lint` ✓, `npm run typecheck` ✓.

## Notes for callers

- `SelectContent` now defaults to `position="popper"` + `align="start"`; pass `position="item-aligned"` to get the
  old behaviour.
- `Calendar` now needs a next-intl provider above it (it reads the locale); every app render has one.
- Shared pieces: `components/ui/list-styles.ts` (`LIST_CONTENT`, `LIST_ROW`, `LIST_SEPARATOR`, `LIST_LABEL`),
  `components/ui/overlay-close.ts`, `components/direction-provider.tsx`, `components/not-found-view.tsx`.
