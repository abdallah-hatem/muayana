FINDINGS

# UI re-audit — v1 web after the fix wave, 2026-11-05

Scope: every finding from `ui-audit.md` (B1, M1–M11, m1–m7, n1), checked at the size, theme and language where it was found, plus regressions from fix/ui-kit, fix/ui-screens and fix-smoke2.
Run against the running dev servers (web :3100, API :3101, seeded), signed in once as the seeded engineer. Chromium has real scrollbars. Sizes 360×780 and 1440×900 · light + dark · ar + en.
Nothing was started, stopped or reseeded, and **no data changed**. Every sheet and confirm was opened and then cancelled (Escape, "Not yet" or Cancel). For the queue chip, a photo was queued offline in a throwaway browser context, and every non-GET API call was held unanswered, so nothing was uploaded. The inbox empty state was reached by rewriting the inbox list response to `[]` in the browser (a route mock).

Evidence (gitignored): `.logs/ui-reaudit/shots/` (400 PNGs, named `<screen>__<state>__<m360|d1440>-<ar|en>-<light|dark>.png`), `zoom/` (crops), `results-<variant>.json` (overlay before/after rects, list-row heights, small targets, truncation, i18n keys), `extra.txt`, `looked.txt`.
Scripts: `run.cjs`, `extra.cjs`, `probe-gutter.cjs`.

## Earlier findings: fixed or not

| # | Verdict | Proof |
|---|---|---|
| B1 inbox bulk at 360 | **Fixed** | The grid stays visible above a 96px bar ("2 selected", Category, Merge two). Category opens a sheet that scrolls, with the footer pinned. `inbox__bulk-selected__m360-*`, `inbox__category-sheet(-bottom)__m360-*` |
| M1 Radix RTL | **Fixed** | Site switcher, filter selects, sort select, page size and worker picker all have `direction: rtl` in ar. The value and items are right-aligned, and the chevron and check are on the left. `site-switcher__hover__m360-ar-light`, `issues__filter-select-open__m360-ar-light`, `issues__filter-select-chosen__d1440-ar-dark`, `issue__worker-picker-open__m360-ar-light` |
| M2 stock shadcn lists | **Fixed** | Solid card with a 2px border. Every row is 44px (measured on all lists in all variants), with a yellow highlight, a bold check, and the list aligned to the start of its trigger. `site-switcher__hover__d1440-en-light` |
| M3 layout shift at 1440 | **Fixed** | `main`, `header`, the side nav and the gutter are identical before and while open in ar and en. Measured for the site switcher, filter select, filter date, export dialog, cancel / mark-sent / delete sheets, category sheet, merge confirm, site and category delete confirms, and the new-site sheet. In ar, the nav stays at x=1334 and `main` at [0,1334]. The one raw diff (estimate picker "gutter 0→10") did not reproduce in `probe-gutter.cjs`: the gutter is a stable 10px, with no element moved. |
| M4 site switcher clipped | **Fixed** (see N4) | "All sites" and "كل المواقع" show in full, and the trigger is 44px tall. Next to the queue chip the label now ends in an ellipsis instead of a mid-letter cut. |
| M5 queue chip under theme toggle | **Fixed** | Below `sm`, the bar shows only the title, the switcher, an icon-only chip "1" and Settings. The theme moved to Settings → Theme (Light / Dark / System, filled in ink when chosen). `topbar__queue-workers__m360-en-light`, `settings__full__m360-*` |
| M6 WhatsApp label overflow | **Fixed** | The label wraps to two lines inside the button. `worker__full__m360-en-light` |
| M7 issues table headers | **Fixed** | Columns # · description/site/location · status · category/worker · estimate, with no overlap. Below xl the list is cards. `issues__default__d1440-en-light`, `issues__default__m360-*` |
| M8 calendar not localised | **Fixed** | ar shows "نوفمبر 2026" and سبت…جمعة with Saturday first, laid out RTL. Previous is on the right and points right. `issues__filter-date-open__m360-ar-light`, `issues__filter-date-open__d1440-ar-light` |
| M9 404 pages | **Fixed** | Translated hazard-tape card with one way back, and correct in dark. Covers the root (`/this-does-not-exist`), the issue (`/issues/00000000-…`), the worker, and an unknown path under the shell (`/settings/nope` renders the root page). `notfound__*` |
| M10 "Dashboa…" | **Fixed** | The bottom nav says "Home", and the ar labels fit. `dashboard__default__m360-en-light` |
| M11 tap targets | **Partly fixed** | Fixed: sheet and dialog ✕ is 44×44 (measured), the checkbox has a 44px hit area, the switch is 44px, sm/icon-sm buttons are 44px, the inbox box sits in a 48px corner, back links are 44px, and the switcher and chip are 44px. **Still under 44 → N2.** |
| m1 calendar under the shutter | **Fixed** | At 360 it opens above the trigger (popover 5–361, trigger 366). `issue__estimate-picker__m360-*` |
| m2 Arabic text in the en layout | **Fixed in rows, cards, table, switcher and dashboard; one place missed → N5** | `worker__default__d1440-en-light` |
| m3 broken thumbnail spills | **Not re-verified** | The JPEG thumbnail renders in its square (`capture__queued__*`, `topbar__queue-sheet__*`). The failed-decode case wasn't reproduced (code-only fix). |
| m4 chip red vs amber | **Fixed** | The chip is amber in the top bar and on /capture while waiting. |
| m5 blank page offline | **Not rechecked** | The service worker is production-only. It needs a `next build` run. |
| m6 dashboard bar names | **Fixed** | Latin names keep their start ("Smoke site 64…"). `dashboard__full__d1440-ar-light` |
| m7 phone placeholder | **Fixed** | "مثال: 0100 123 4567" now reads in the right order. `workers-new__default__m360-ar-light` |
| n1 dev "1 Issue" badge | **Not fixed** (dev only, as stated) | It still shows on the in-shell 404s (the "Encountered a script tag" console error). `notfound__issue__m360-en-light` |

## New findings

| # | Screen | Theme · dir · size | Finding | Severity | Likely file | Screenshot |
|---|---|---|---|---|---|---|
| N1 | /workers, Deactivated tab (also any worker row with the badge) | all · en (ltr) · 360 | The deactivated worker's short name "أشرف الحداد" is cut to "…الحداد". The "DEACTIVATED" badge is `shrink-0` and takes the room, so a person's name gets truncated while the badge stays whole. In ar it fits. | major | `app/(app)/workers/worker-bits.tsx:80` (badge) + the name line in `workers-screen.tsx:243` | `workers__deactivated__m360-en-light.png`, `-en-dark` |
| N2 | Before/After tabs (issue page), Active/Deactivated/Archived segments, priority radios (inbox sorter, edit details), filter-chip remove, capture site chip, issues-table "#n" link | all · both · both | These targets are still under 44px. Tab triggers are 40px tall inside a 48px list, priority radios are 40px, the "Remove filter" chip is 36px, the capture site chip is 40px, and the table's "Open issue #1" link is 22×44. The workers table name links at 1440 are 20px tall, but the row has an `after:inset-0` link. | minor | `components/ui/tabs.tsx` (trigger height), `components/priority-picker.tsx`, `issues/_components/filter-chips.tsx`, `capture/capture-screen.tsx:136` (`h-10`), `issues-table.tsx` | `results-*.json` → `audits.*.small`; `issue__new__m360-en-light.png` |
| N3 | Before/After tabs (issue page) | **dark** · both · both | The selected tab is a slightly darker card with the same text colour as the unselected one, so you can't tell which is selected. In light it is a clear white card. | minor | `components/ui/tabs.tsx` (active trigger in dark) | `.logs/ui-reaudit/zoom/tabs-dark.png` ← `issue__assigned-long__m360-en-dark.png`; `issue__edit-details__d1440-en-dark.png` |
| N4 | Top bar site switcher with the queue chip, Arabic site chosen | all · en · 360 | With a long Arabic site name selected, the label shrinks to one letter plus an ellipsis ("ب…" on the dashboard, "برج…" on Workers). It is above the 7rem pin-only threshold but carries no information. The threshold should be higher, or the label hidden. | minor | `components/site/site-switcher.tsx` (container query) | `topbar__queue-dashboard__m360-en-light.png`, `.logs/ui-reaudit/zoom/dash-showing-en.png` |
| N5 | Dashboard "Showing {site} only" pill | all · en · 360 | With an Arabic site name the pill truncates a sentence: "only" is lost (an "o…" fragment is left), and the bidi run looks garbled. It should wrap, or the site name should be isolated (`<bdi>`). | minor | `app/(app)/_dashboard/dashboard-screen.tsx:97-101` (`truncate` on the sentence) | `topbar__queue-dashboard__m360-en-light.png`, `zoom/dash-showing-en.png` |
| N6 | /capture site chip | all · en · 360 | The Arabic site name shows its end ("…ع الخامس"), not its start. The chip has no `dir="auto"`, so this is the m2 fix missing here. | minor | `app/(app)/capture/capture-screen.tsx:148` (`<span className="truncate">`) | `.logs/ui-reaudit/zoom/capture-top-en.png` ← `capture__queued__m360-en-light.png` |
| N7 | Issue page "Set the date the worker gave" button | all · en · 360 | The label is cut to "Set the date the worker ga…". In ar it fits. | minor | `app/(app)/issues/[id]/status-actions.tsx` (estimate button label; wrap or shorter copy) | `issue__estimate-picker__m360-en-light.png` |
| N8 | Inbox sorter action bar and bulk bar | all · both · 360 | The sticky bar sits at `bottom-24`, which leaves a ~16px strip above the bottom nav where the cards or chips scrolling under it show as cut slivers. | minor | `app/(app)/inbox/bulk-panel.tsx:135`, the sorter bar in `sort-card.tsx` | `inbox__sorter__m360-en-light.png`, `inbox__bulk-selected__m360-en-light.png` |
| N9 | Inbox bulk bar | all · both · 1440 | The bar is a card with rounded corners and a 2px border, but it is `md:bottom-0`, so it sits flush against the window bottom with its lower border and radius cut off. | minor | `app/(app)/inbox/bulk-panel.tsx:135` (`md:bottom-0` → a small inset) | `inbox__bulk-selected__d1440-en-light.png` |
| N10 | Calendar popover | all · both · 1440 | The 112px bottom collision padding (meant for the phone nav) also applies on desktop. The estimate calendar flips above and covers the description even though there is room below and no bottom nav. | nit | `components/date-picker.tsx` (padding only below md) | `issue__estimate-picker__d1440-en-light.png` |
| N11 | Tabs after a tap | all · both · both | A tapped segment keeps a heavy focus ring (dark double ring in light, yellow in dark), so the selected segment looks outlined instead of filled. | nit | `components/ui/tabs.tsx` (`focus-visible` vs `focus`) | `sites__archived__m360-en-light.png`, `workers__deactivated__m360-en-dark.png` |
| N12 | Hazard tape on empty/404 cards | dark · both · both | The black stripes vanish on the dark card, so the tape reads as loose yellow dashes. | nit | `components/not-found-view.tsx`, `components/empty-state.tsx` | `notfound__issue__d1440-en-dark.png` |
| N13 | Bulk category sheet vs queue sheet | all · both · 360 | The queue sheet has a grabber and the category, confirm and filter sheets don't, so the bottom sheets are inconsistent. | nit | `components/bottom-sheet.tsx` vs `components/offline-queue/queue-sheet.tsx` | `inbox__category-sheet__m360-en-dark.png` vs `topbar__queue-sheet__m360-en-light.png` |

Checked and fine (regressions looked for): the phone top bar (title, icon-only queue chip, switcher, no theme or language toggle), the bottom nav's short labels in both languages, the issue cards below xl and the table at 1440, every list at 44px rows in both directions and themes, the RTL calendar arrows and weekday order, every sheet and dialog close at 44×44 and on the start-mirrored corner in ar, the 44px sm buttons in dense rows (the category rows wrap Deactivate + Delete to a second line at 360, which is aligned and fine), the RTL pager arrows, the RTL history arrows, and Settings → Theme. No horizontal scroll and no raw i18n keys on any captured screen.

## Unreached

- Deactivated **categories**: the seed has none (0 badges), and categories have no tab (the badge is inline by design). Reaching one would mean changing data.
- The page-size select on /issues: the list uses "Load more". The page-size select was seen on the workers and sites tabs (`workers__deactivated__*`, `sites__archived__*`) but not opened.
- m3 (failed-decode thumbnail), m5 (offline navigation on a production build), and the queue item's "Failed" state.
- Load-error/retry states and the loading skeletons (they need a server failure or slow network).
- Review coverage: 400 screenshots captured, **109 viewed** (all four variants of the screens tied to each earlier finding, plus every 1440 ar/en overlay). The other 291 are covered by the per-file measurements only and are marked `NOT VIEWED` in `looked.txt`.

## Teardown

Nothing was started, stopped or reseeded. Web :3100 and API :3101 were left running. Browser contexts were closed, and the offline-queue items lived only in those throwaway contexts.
