# 6. Invariants
Rules that must never break. Each has a test that tries to break it.

1. An issue outside `new` always has a category and a description. **DECIDED**
2. An issue in `assigned`, `sent`, `estimated`, `in_progress` or `solved` always has a worker. **DECIDED**
3. An issue's worker has the issue's category at the moment of assignment; a category change the
   worker doesn't cover unassigns him. **DECIDED**
4. An issue in `estimated` always has an estimated date. **DECIDED**
5. An issue always has at least one before-photo and at most 10 before and 10 after. Deleting the last
   before-photo is refused. **DECIDED**
6. Nothing moves back to `new`. **DECIDED**
7. Status history is append-only: every status change writes exactly one record. **DECIDED**
8. A worker, category or site that is referenced is deactivated or archived, never deleted. **DECIDED**
9. Uploading the same captured issue twice (offline retry) creates it once. **DECIDED**
10. Nothing is reachable without signing in — **except photo files**, which are served at long,
    unguessable addresses so they can be sent to workers over WhatsApp and opened without an account.
    Their addresses are never listed anywhere public. **DECIDED**
11. A deactivated worker can't be newly assigned; a deactivated category can't be newly chosen; an
    archived site can't receive new captures. **DECIDED**
12. Issue numbers are unique within a site and never reused. **DECIDED**
13. Sending to a worker never changes a status by itself; only the engineer's "yes, mark as sent" does. **DECIDED**
14. An export contains exactly the issues the list shows for the same filter — all of them, not one page. **DECIDED**
