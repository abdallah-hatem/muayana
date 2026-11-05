# 2. Roles
- **Engineer** — the only account. Signs in with email and password and can do everything in the app.
  There is no sign-up; the account is created by the operator (seed / environment). **DECIDED**
- **Worker** — not a user and never signs in. A contact record the engineer keeps. **DECIDED**
- Anyone not signed in sees only the sign-in page; every data request is refused. **DECIDED**
- Sign-in is rate-limited: repeated wrong passwords are slowed down and then blocked for a while. **GUESS**
