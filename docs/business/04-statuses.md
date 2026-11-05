# 4. Issue statuses
The engineer moves every issue himself. **DECIDED**

| Status | Arabic | Meaning | Requires |
|---|---|---|---|
| `new` | جديد – لم يُصنّف | captured, not sorted yet | at least one photo, a site |
| `unassigned` | غير مُسند | sorted into a category, no worker | category, description |
| `assigned` | مُسند | worker chosen, not sent yet | + worker |
| `sent` | أُرسل للعامل | sent to the worker (WhatsApp, call…) | + worker |
| `estimated` | تم تحديد موعد | the worker gave an estimated completion date | + worker, estimated date |
| `in_progress` | جاري العمل | the worker is working on it | + worker |
| `solved` | تم الحل | fixed | + worker |
| `cancelled` | ملغي | not a real issue, or a duplicate | category, description |

Moves (**DECIDED** unless marked):
- Forward moves may **skip** steps (for example `assigned` → `in_progress`) as long as the target's
  requirements hold. Real work doesn't follow the order.
- Any status may move **back** to an earlier one, except back to `new` (sorting is not undone; change
  the category instead).
- `unassigned` can't be reached while a worker is set; removing the worker is the way back to it.
  Removing the worker moves the issue to `unassigned`. Choosing a worker on an `unassigned` issue moves
  it to `assigned` (a worker can't be chosen on a `new` issue unless the same save also sorts it — then it
  goes straight to `assigned`); choosing a different worker on a later status keeps the status. **GUESS**
- Setting an estimated date on an `assigned` or `sent` issue moves it to `estimated`. **GUESS**
- `solved` and `cancelled` can be **reopened** to `assigned` (or `unassigned` if no worker).
- **Overdue** = has an estimated date before today (Cairo time) and is not `solved` or `cancelled`.
  It is a flag computed from the date, not a status.
- Every move writes one status change (§3) with an optional note. Saving without a status change
  writes none.
- Timestamps: the first time an issue reaches `assigned`, `sent` and `solved` is kept for reports.
