# 7. Export
- **Issues CSV** — exports exactly the issues matching the current list filter (§5.8): all of them,
  not just the visible page. The engineer picks the columns (default: all) from: number, site, status,
  category, worker, worker phone, priority, description, location, captured at, assigned at, sent at,
  estimated date, solved at, overdue, days open, photo links, after-photo links, last note. **DECIDED**
- **Contractor Excel** — the same column list and header language as the issues CSV, for one
  contractor's issues, with the issue's photos embedded as small pictures in its row (not links); right-to-left
  sheet in Arabic. Built on the phone. **DECIDED**
- **Workers CSV** — every worker matching the workers filter, with categories, phone, active, notes,
  and counts per status and overdue. **DECIDED**
- **Days open** counts from capture to today, or to the last status change for a `solved` or `cancelled`
  issue. **GUESS**
- **Status history CSV** — every status change of the filtered issues. **GUESS**
- Files are UTF-8 with a byte-order mark so Excel shows Arabic; dates as `YYYY-MM-DD HH:mm` in Cairo
  time; headers in the app's current language. **GUESS**
- A text value that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with an apostrophe so spreadsheets don't
  run it as a formula. **DECIDED**
