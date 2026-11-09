# 2. Roles
- **Engineer** — the only account. Signs in with email and password and can do everything in the app.
  There is no sign-up; the account is created by the operator (seed / environment). **DECIDED**
- **Worker** (Arabic: **مقاول**, plural المقاولون) — not a user and never signs in. A contact record the engineer keeps. **DECIDED**
- Anyone not signed in sees only the sign-in page; every data request is refused. **DECIDED**
- Sign-in is rate-limited. **DECIDED**
  - 5 failed attempts for one email from one IP within 15 minutes → further attempts from that IP for
    that email are refused (429, with the seconds to wait) until the oldest of those failures is
    15 minutes old — even with the right password. Other emails and other IPs are not affected.
  - 20 failed attempts for one email within 15 minutes from **any** mix of IPs → that email is
    refused from every IP the same way, so a forged or missing client IP can't multiply the
    per-IP limit. Trade-off: someone hammering the address can lock the engineer out for up to
    15 minutes.
  - A successful sign-in resets both counts for that email (and that IP).
  - Counts are kept in the database, so every server instance enforces the same limit.
