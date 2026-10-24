# Phase 1 — Sync safety / release blockers

## Implemented on this branch
- Durable retry queue, bounded exponential retry, failed-state retention and manual retry API.
- No age-based deletion of unsent operations.
- Full sync no longer re-uploads every local table on every run.
- Category pulls no longer delete categories missing from cloud responses.
- Pending and failed queued records are protected against pull overwrites.
- Incomplete initial pagination now fails instead of reporting success.
- Buffered batch writes are persisted when the browser reports offline.

## Not production-ready
- Local writes are not universally journaled atomically with business transactions; crashes before enqueue can lose outbound changes.
- Concurrent multi-device edits need server-enforced version checks / conflict resolution and tombstones.
- Supabase RLS and per-shop tenant isolation require database policy audit, live authenticated testing and possibly schema changes.
- Initial import/bootstrap migration needs a reviewed explicit path (full-table push intentionally disabled).
- Two-device browser tests, true offline tests, restore drill, payment/refund correctness, and all critical end-to-end tests are still required.
- A shared Supabase sync account cannot provide meaningful per-employee/per-shop isolation.
- Do not deploy or merge to main until these issues are addressed and explicitly approved.
