# Phase 1 sync durability: operational notes

- `pushRecord` now writes a durable queue entry before attempting network delivery. If the browser closes during a request, the record remains queued until acknowledged. Server upsert idempotency and conflict rules are still required.
- `queueOperation` rejects unknown tables, missing record IDs and malformed upserts rather than storing entries that cannot be replayed.
- `getSyncQueueStatus()` exposes pending and failed counts and failed-operation metadata for a future operator recovery screen; `retryFailedSyncOperation(id)` remains available.
- `schedulePushBatch` is still a delayed in-memory buffer and is NOT crash-safe. All critical transaction writers must eventually queue within the same IndexedDB transaction as their business writes.
- Do not mark this branch production ready until browser interruption, multi-device, and Supabase RLS tests pass.
