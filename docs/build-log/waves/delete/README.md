# Waves — permanent delete (2026-11-09)
- Wave 1: D1+D2 in one agent (same issues/workers services, schema change for formerWorkerName, shared rules).
- D1+D2 merged (69dc505) · shared 66, api 150 unit + 150 e2e (+serverless), web 278 · smoke permanent-delete/workers/sort-issue-send 14/14. Migration 20261109140131_issue_former_worker_name (needs migrate deploy on production before release).
