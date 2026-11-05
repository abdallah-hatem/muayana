# 5. Flows

## 5.1 Capture (on site)
1. Choose a site (the last one used is preselected).
2. Open the camera and take a photo. It is compressed on the phone and becomes a new issue in `new`
   at once, with no typing required. Optional: a quick note and location.
3. Keep shooting. "Add to the previous issue" attaches the next photo to the last issue instead.

**Failure:** no signal → the issue and its photos are kept on the phone and shown as "waiting to
upload"; nothing is lost if the app is closed. **DECIDED**

## 5.2 Offline queue
- A captured issue gets an id made on the phone, so retrying an upload never creates a duplicate. **DECIDED**
- The queue uploads automatically when the connection returns and when the app opens. A badge shows the
  count waiting; the engineer can retry or discard an item. An item that fails 5 times is kept and
  marked failed, never silently dropped.
- Only capture works offline. Sorting, assigning and exporting need a connection. **GUESS**

## 5.3 Sort (after the walk)
The inbox lists `new` issues (per site, oldest first). One at a time with the photo large: choose a
category, write the description, adjust location and priority, optionally choose a worker → saved and
moved to `unassigned` (or `assigned` with a worker) → next. Bulk: select several and set one category
(they stay `new` until each gets a description). **GUESS**
**Merge:** two captures of the same defect can be merged: the photos move to one issue and the other
is removed (it never left `new`, so it has no history to lose). The merged issue keeps at most 10 photos.

## 5.4 Assign
The worker picker shows only active workers who have the issue's category, each with how many open
issues they hold.

## 5.5 Send
"Send on WhatsApp" builds an Arabic message: site, issue number, location, category, description,
priority, and the photos. On a phone that can share files, the photos and text go through the share
sheet to WhatsApp; otherwise a WhatsApp link opens with the text and links to the photos. When the
engineer comes back, the app asks "Mark as sent?"; only his yes changes the status. **DECIDED**
Batch: from a worker's page, send all of the worker's `assigned` issues in one message, then mark them
sent together.

## 5.6 Track
From the issue page, in one tap each: set the estimate date (→ `estimated`), mark `in_progress`, mark
`solved` (optionally with after photos and a note), cancel with a reason, reopen.

## 5.7 Workers
List: name, categories, phone, open issues by status, overdue count. Search and filter by category.
Detail: call and WhatsApp buttons, categories, notes, and the worker's issues grouped by status.

## 5.8 Issues list
Filter by site, category, worker, status (several), priority, overdue, date range (captured / solved),
and free text (description, location, number). Sort by newest, oldest, priority, estimate date.
The current filter lives in the address, so it can be bookmarked and is exactly what export uses.

## 5.9 Dashboard
Unsorted count (with a button to the inbox), open issues by status, overdue, by category, by worker,
and per site. Each number opens the issues list filtered to it. Archived sites are left out of the
dashboard (their issues stay in the issues list and exports when the archived filter includes them). **GUESS**
