# Queue single-flight and replay safety

- `processQueue()` now uses a single in-process promise so overlapping sync callers cannot independently transmit the same pending sale/payment.
- It re-evaluates the queue after every acknowledged operation, allowing sequential operations for the same record to progress in order.
- Failed operations are attempted at most once per invocation and retained for retry.
- A malformed nonempty Supabase JSON response now raises an error instead of being silently interpreted as success.
- These protections do **not** establish exactly-once delivery across browser crashes or multiple devices. That requires server-side idempotency keys, unique constraints and conflict detection.
- The existing in-memory batch scheduler and the lack of atomic journaling at all business write sites remain release blockers.
