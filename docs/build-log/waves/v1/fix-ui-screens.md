# fix/ui-screens — UI-audit fixes in screens + complete batch send

Branch `fix/ui-screens` (from dev). Code commit `c6df1ef`. Agent 2 (API 3121, web 3123, DB `muayana_uiscreens`,
seeded with `SEED_ALLOW_SAMPLE=true`). Audit: `docs/build-log/waves/v1/ui-audit.md`.
The shared kit (components/ui/*, globals.css, root layout/providers, calendar, not-found) was fixed by the other
agent in parallel and was not touched here.

## Finding → fix → proof

Screenshots: `.logs/fix-shots/<screen>__<m360|d1440>-<ar|en>-<light|dark>.png` (gitignored, 80 shots: dashboard,
issues, inbox-bulk, inbox-bulk-selected, inbox-category-sheet, worker, settings, queue-topbar, site-open). A
scrollWidth check at 360/820/1100 px in ar and en on /, /issues, /inbox, /workers, /workers/[id] and /settings found
no horizontal overflow.

| ID | Fix | Proof |
|---|---|---|
| B1 | `inbox/bulk-panel.tsx`: the sticky panel is now a compact bar with the selection count and two actions, **Category** and **Merge two**. Category opens a bottom sheet with the chips (the body scrolls) and the "Set category (n)" footer. The same design is used at every width, and from md up it is a card. Errors show in whichever sheet is open. | `inbox-bulk-selected__m360-*` (the grid stays visible above a ~90px bar), `inbox-category-sheet__m360-*`; `bulk-panel.test.tsx` (the category goes through the sheet); smoke `sort-issue-send` |
| M7 | `issues-table.tsx`: the table appears only from xl up; below xl the list is cards (2 columns at md). The fixed columns are narrower, the location sits under the description and the worker under the category, and the table has `min-w-[52rem]` and scrolls if narrower. Text cells use `dir="auto"`. | `issues__d1440-*` (no header overlap; descriptions wrap by words) |
| M4 | `site-switcher.tsx`: `h-11`. It takes the top bar's leftover room and the label truncates with an ellipsis. A container query hides the label below 7rem (pin icon only; the trigger keeps its accessible name). Site names use `dir="auto"`. | `*__m360-*` top bars ("All sites", "كل المواقع" in full), `queue-topbar__m360-*` ("All s…" next to the chip) |
| M5 | `top-bar.tsx`: below sm the theme toggle is hidden; the theme is now chosen in **Settings → Theme** (light / dark / system, new `ThemeSection`). `QueueChip compact` shows the icon and the count on phones and the full words from sm up, with the full sentence as its name; it is `h-11`. | `queue-topbar__m360-en-light` (no overlap), `settings__m360-*`; `theme-section.test.tsx` |
| M6 | `send-flow.tsx`: the send button is `min-h-14 h-auto whitespace-normal`, so long labels wrap inside it. | `worker__m360-en-light` ("Send 1 assigned issue on WhatsApp" on two lines, inside the button) |
| M10 | `bottom-nav.tsx` uses the new `common.navShort.*` keys (en "Home" instead of "Dashboard"; ar unchanged). The top bar keeps the full name. | `dashboard__m360-en-*` |
| M11 (screens) | Back links in `page-header.tsx` are `min-h-11`. The dashboard "n overdue" link is a 44px link around the small stamp. The inbox checkbox sits in a 48px corner (the whole card is its label). Site switcher and queue chip are 44px. Issue-number links in the table are 44px. | top bars and worker/dashboard shots |
| m2 | `dir="auto"` + `text-start` on user text: `issue-row.tsx`, `issue-card.tsx`, the table, the site switcher, and the dashboard bar labels. | `worker__m360-en-*`, `issues__m360-ar-*` |
| m3 | Queued and last-shot thumbnails get `overflow-hidden text-transparent` (and `bg-muted`), so a photo that fails to decode keeps its square. | code |
| m6 | Dashboard bar names use `dir="auto"`. | `dashboard__d1440-ar-*` |
| m7 | The Arabic phone placeholder and the error example wrap the number in LRI…PDI (U+2066/U+2069). | — |
| m4 | No change. A pending item is amber in the top bar as on /capture (verified: `queue-topbar__*`). Red is used only when an item has **failed**, by design (`QueueChip` doc), and that was the state in the audit's PNG run. | `queue-topbar__m360-*` |

## Logic fix: batch send covers every assigned issue (§5.5 as updated)

- `lib/all-pages.ts` (new, shared): `fetchAllPages(fetchPage)` asks for pages 1…n at `PAGE_LIMIT_MAX` until
  `meta.hasNextPage` is false. The first failure is returned as is. `chunk(items, size)` also lives here.
- `listWorkerIssues(workerId, status)` now pages through every page of one status (`status=assigned` for the batch).
  The worker page loads each status in parallel (`listAllWorkerIssues`), so the groups are complete past 100 issues.
- `BatchSendToWorker`: every assigned issue, split into batches of `BULK_IDS_MAX` (200). Each batch is one message and
  one bulk call, and "Mark as sent?" marks exactly the batch that was shared. When there is more than one batch, a
  line says "Batch 1 of 2: 230 assigned issues in all…". A yes reloads the list, so the next batch comes first; a
  "Not yet" moves the next tap on to the next batch. `SendFlow` gained the `hint` and `onDeclined` props.
- Tests (each named after its case):
  - `send-to-worker.test.tsx` › "230 assigned issues → two batches, 200 then 30: one message and one bulk call each (§5.5)"
  - "more than one batch: \"Not yet\" moves the next tap on to the next batch"
  - "issues in other statuses are never in a batch, however many there are"
  - `worker-view.test.tsx` › "more than 100 issues: every group and the batch count them all, page after page". The
    mock API now answers per status with paging meta.
- The business doc is unchanged; the code now matches §5.5.

## Results

- Web unit: **28 files, 191 tests passed** (`vitest --maxWorkers=2`). Lint 0, typecheck 0, prettier clean.
- Smoke against :3123/:3121, `sort-issue-send`, `workers` and `issues-dashboard`: **12 passed** (mobile + desktop).
  The first run caught a horizontal overflow on /issues at 360 from the new card grid (`grid` with no `grid-cols-1`);
  it was fixed and re-run green.

## Not fixed here

- M1, M2, M3, M8, M9, plus the kit parts of M11 (sheet/dialog close X, segmented, switch, `sm`/`icon-sm` 40px buttons
  used by the pager, priority, Edit, Clear all and the date buttons): these belong to the shared kit (other agent).
- m1: the calendar popover running under the shutter. The fix is collision padding in `components/date-picker.tsx`
  and the calendar popover, which the kit agent is changing for M8; it is left there to avoid a conflict.
- m5: offline navigation is blank in dev only. The service worker is production-only by design
  (`queue-sync.tsx`); it was not rechecked on a production build.
- n1: dev noise, no change.
