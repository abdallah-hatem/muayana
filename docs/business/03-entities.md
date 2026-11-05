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
- A category in use (by an issue or a worker) is deactivated, never deleted. An unused one may be
  deleted. A deactivated category is hidden from pickers but stays on existing issues and workers.

## Worker
Name (required), phone (required, stored in international form, e.g. +2010…; Egyptian local numbers
like 010… are accepted and converted), one or more categories (at least one), notes, active flag.
- Phone is unique among workers. **GUESS**
- A worker with issues is deactivated, never deleted. A worker with none may be deleted. A deactivated
  worker can't receive new issues but keeps the ones he has. **DECIDED**
- Removing a category from a worker does not touch the issues already assigned to him. **GUESS**

## Issue
One defect. Belongs to exactly one site.
- **Photos:** 1–10 "before" photos (at least one, from capture) and 0–10 "after" photos added when
  solving. The first before-photo is the cover. Photos are stored compressed (long side at most 1600px,
  JPEG).
- **Description** — optional while `new`; required in every other status. **Location** — free text
  (floor / unit / room). **Priority** — low, normal, high or urgent (default normal).
- **Category** — empty while `new`; required in every other status.
- **Worker** — must have the issue's category when assigned. If the issue's category changes to one
  the worker doesn't have, the worker is removed and the issue goes back to `unassigned`.
  Exception: a `cancelled` issue stays `cancelled` (the worker is still removed) — a category fix
  must never silently reopen it. **GUESS**
- **Estimated completion date** — set when the worker's estimate arrives.
- **Number** — a short running number per site (#1, #2…) for talking about it with workers. Never reused.
- **Captured at** — the moment the photo was taken on the phone, even if it uploaded later.
- An issue in `new` may be deleted (a wrong shot). Any other issue is cancelled, never deleted. **GUESS**

## Status change
Every status move is recorded: from, to, when, optional note. Append-only; never edited or deleted.
