# 3. Entities and rules

## Site
A building or project being audited. Name (required, unique among non-archived sites), address and
notes (optional). A site can be **archived**: it disappears from pickers and the default lists, but its
issues stay and remain searchable and exportable. A site with issues is archived, never deleted; a site
with no issues may be deleted. **DECIDED**

## Category (trade)
Name in Arabic (required) and English (optional), a colour, a sort order, an active flag. Seeded with:
نقاشة (painting), كهرباء (electrical), سباكة (plumbing), محارة (plastering), نجارة (carpentry),
سيراميك (tiling), تكييف (HVAC), ألوميتال (aluminium), حدادة (metalwork), عزل (insulation),
نظافة (cleaning), أخرى (other). **GUESS**
- Arabic names are unique (ignoring case and surrounding spaces). The engineer can add, rename,
  recolour, reorder and deactivate categories.
- A new category starts with a colour no other category uses: the first free palette colour (24
  colours), then a generated colour no category uses once the palette is taken. The engineer can
  still pick any palette colour, used or not.
- A category in use (by an issue or a worker) is deactivated, never deleted. An unused one may be
  deleted. A deactivated category is hidden from pickers but stays on existing issues and workers. A category's
  worker count counts active workers only. **GUESS**

## Worker
Name (required), phone (required, stored in international form, e.g. +2010…; Egyptian local numbers
like 010…, landlines, spaces/dashes and Arabic-Indic digits are accepted and converted), one or more categories (at least one), notes, active flag.
- Phone is unique among workers. **GUESS**
- A worker can be **deactivated** (can't receive new issues, keeps the ones he has) or **deleted
  permanently**. Deleting one with issues asks every time what happens to them: **(a) keep the issues** —
  open ones (`assigned`, `sent`, `estimated`, `in_progress`) go back to `unassigned` (estimated date
  cleared) with a history record naming the deleted contractor; `solved` and `cancelled` ones keep his
  name as a record (it stays if the issue is reopened, and is replaced once a new contractor is chosen);
  or **(b) delete his issues too** — every issue ever assigned to him, with photos and
  history, permanently. A worker with no issues is deleted with a simple confirm. **DECIDED** (owner,
  2026-11-09: "delete a worker completely"; "ask each time")
- Removing a category from a worker does not touch the issues already assigned to him. **GUESS**

## Issue
One defect. Belongs to exactly one site.
- **Photos:** 1–10 "before" photos (at least one, from capture) and 0–10 "after" photos added when
  solving. The first before-photo is the cover. Photos are stored compressed (long side at most 1600px,
  JPEG).
- **Description** — optional while `new`; required in every other status (spaces only count as empty). **Location** — free text
  (floor / unit / room). **Priority** — low, normal, high or urgent (default normal).
- **Category** — empty while `new`; required in every other status.
- **Worker** — must have the issue's category when assigned. If the issue's category changes to one
  the worker doesn't have, the worker is removed and the issue goes back to `unassigned`.
  Exception: a `cancelled` issue stays `cancelled` (the worker is still removed) — a category fix
  must never silently reopen it. **GUESS**
- **Estimated completion date** — set when the worker's estimate arrives.
- **Number** — a short running number per site (#1, #2…) for talking about it with workers. Never reused.
- **Captured at** — the moment the photo was taken on the phone, even if it uploaded later.
- Any issue, in any status, can be **deleted permanently** by the engineer after a confirm that shows its
  number and photo count: the issue, its photos (also removed from photo storage) and its status history
  are gone. Its number is still never reused. Cancelling stays available for keeping a record. **DECIDED**
  (owner, 2026-11-09: "delete an issue completely")

## Status change
Every status move is recorded: from, to, when, optional note. Append-only; never edited or deleted.
Creating an issue writes the first record (none → `new`). A `new` issue removed by merge or deletion takes
its records with it (it never left `new`). **GUESS**
