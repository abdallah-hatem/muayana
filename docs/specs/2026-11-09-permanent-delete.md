# Feature spec — delete an issue / a contractor completely
Date: 2026-11-09 · Owner request: "I need to be able to delete an issue completely and a worker completely".
Owner answer: deleting a contractor with issues → **ask each time** (keep them or delete them too).
Business: §3 (Worker, Issue), §6.2, §6.8 — updated the same day.

## Issue delete (task D1 · backend+frontend · logic)
- `DELETE /issues/:id` allowed for every status (was `new` only → 409 NOT_NEW, removed).
- One transaction removes the issue, its photos rows and status-history rows; after commit, the photo files
  are deleted from storage (local disk / Vercel Blob `del`) best-effort — a storage failure is logged, never
  undoes the delete. Site `nextNumber` untouched (numbers never reused).
- Web: "Delete issue" on the issue page (danger zone, every status) → confirm sheet "#14 and its N photos will
  be deleted permanently. This can't be undone." → back to the list with a toast. Inbox delete for `new` keeps working.

## Contractor delete (task D2 · backend+frontend · logic)
- `DELETE /workers/:id?issues=keep|delete`. No issues → `issues` not needed. Has issues and `issues` missing → 409
  `WORKER_HAS_ISSUES` with counts `{ open, solved, cancelled, total, photos }` so the UI can ask.
- `keep`: in one transaction — open issues (assigned/sent/estimated/in_progress) → `unassigned`, worker removed,
  estimatedDate cleared, one history record each with note naming the contractor; `solved`/`cancelled` → worker
  removed, `formerWorkerName` set (new nullable column on Issue); then the worker and his category links are deleted.
- `delete`: in one transaction — every issue ever assigned to him (current `workerId`) with photos + history,
  then the worker; then best-effort storage delete of the photo files.
- Shared rules: `canMove`/requirements accept a `solved` issue with `formerWorkerName` and no worker (§6.2).
  Reopening such an issue → `unassigned`. Issue page/list/CSV/Excel show the former name (marked "deleted").
- Web: on the contractor page "Delete contractor" → if he has issues, a sheet shows the counts and two choices
  (keep issues — unassign; delete his N issues and M photos too), the destructive one in red with a second
  confirm step; no issues → simple confirm. After: back to the contractors list with a toast.

## Edge cases
D1:
- [ ] Delete an issue in each status (new, assigned, solved…) → 200, issue, photos rows and history rows gone (§3)
- [ ] Photo files removed from storage after delete; storage failure → still deleted, error logged (§3)
- [ ] Next capture on that site gets the next number, never the deleted one (§6.12)
- [ ] Unknown id → 404; unauthenticated → 401 (§6.10)
- [ ] Deleted issue disappears from list, dashboard counts, worker counts and exports (§5.8, §5.9, §7)
- [ ] Web: confirm shows number + photo count; cancel → nothing deleted; double tap → one request (§6.8)
D2:
- [ ] Contractor with no issues → deleted with plain DELETE (§3)
- [ ] With issues and no `issues` param → 409 WORKER_HAS_ISSUES with correct counts; nothing changes (§6.8)
- [ ] `keep`: assigned/sent/estimated/in_progress → unassigned, estimate cleared, exactly one history record each naming him (§3, §6.7)
- [ ] `keep`: solved/cancelled keep status, worker removed, formerWorkerName set; solved still valid (§6.2)
- [ ] `keep`: reopen a solved issue with only formerWorkerName → unassigned (§4)
- [ ] `delete`: all his issues + photos + history gone, other contractors' issues untouched, photo files removed (§3)
- [ ] Either choice: worker row and category links gone; dashboard/worker lists updated (§5.7, §5.9)
- [ ] Invalid `issues` value → 400; unknown id → 404 (contract)
- [ ] Web: sheet shows counts, both choices; destructive choice needs a second confirm; cancel → nothing (§6.8)
