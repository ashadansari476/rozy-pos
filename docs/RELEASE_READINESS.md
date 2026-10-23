# Rozy POS release readiness and data-safety audit

Last reviewed: 2026-10-23
Target deployment: Vercel `https://rozy-pos.vercel.app`
Cloud data: Supabase (owner reports test-only)
Release status: **BLOCKED — do not merge/deploy this hardening branch yet**

This checklist is intentionally conservative. A green frontend build does not prove that database recovery or multi-device synchronisation is safe.

## Verified from repository / CI

- Phase 1 changes are isolated on `hardening/phase-1-data-integrity`; pull request #1 is open and unmerged.
- GitHub Actions run for commit `07e35ecdd697d4d92e0913a27e70c4bff3f8c097` completed successfully: unit tests, critical-module lint and production build passed.
- The full-project lint command is configured with `continue-on-error: true`; its green step is not evidence that the full repository has zero lint findings.
- No Supabase project, data, policies, or Vercel deployment has been changed as part of this audit.
- The local IndexedDB backup/restore implementation was hardened, but a restore drill against a real exported backup has not been completed.

## Critical blockers

### 1. Cloud sync conflict safety

The current `fullSync()` sequence pulls cloud tables and then pushes every local row for tables whose pull succeeded. A successful pull does not prove that local rows are newer. Without a version-aware merge rule, a stale device can overwrite newer cloud values.

The later-pull path also reads only the newest 500 rows, which is not a dependable change feed for old records that were updated or deleted.

**Required before release**
- Define a durable record identity and a monotonic revision / `updated_at` policy.
- Add tombstones or an explicit deletion feed; absence from one page must never imply deletion.
- Track per-device change cursor and push only locally changed rows, not the entire local table.
- Apply updates with compare-and-swap / version checks; record conflicts instead of silently choosing stale data.
- Make retry operations idempotent and verify parent/child ordering for sales and sale items.
- Add integration tests with two simulated devices: concurrent edits, offline sale, retry, deletion, pagination boundary (>500 rows), interrupted pull and interrupted push.
- Do not deploy an experimental sync rewrite until those tests pass.

### 2. Supabase authorization and shop isolation

The repository's `supabase-security.sql` creates a permissive `FOR ALL` policy with `USING (true)` and `WITH CHECK (true)` for the `authenticated` role. That limits access to signed-in sessions only if no other policies/grants expose data, but it does not isolate shops or roles. The app's documented shared sync account further means the database cannot infer which cashier is acting merely from the shared Supabase identity.

**Required before multi-user/production use**
- Confirm grants, all existing RLS policies, storage policies, and all tables/views/functions exposed through the API.
- Choose a tenant model: authenticated user-to-shop membership table; server-enforced membership checks; and role-specific policies.
- Ensure a client cannot select another `shop_id` by changing local storage or request payloads.
- Never place a Supabase service-role key in browser code or Vercel client-exposed environment variables.
- Test unauthorized reads/writes and cross-shop access with separate test users before applying any policy migration.

Do not run a replacement RLS script on the existing project until a backup and isolated test run are verified.

### 3. Backup and recovery

The app's JSON backup is an IndexedDB/local-device backup; it is not a backup of Supabase. A backup download alone is not proof that restore works.

**Required drill**
1. Export a Supabase database backup using the project's supported backup/export method.
2. Record timestamp, schema/migration version and row counts for critical tables.
3. Restore to a separate Supabase test project/database, never over the source.
4. Verify relationships and counts for products, sales, sale items, stock movements, customers, purchases, payments, expenses and audit records.
5. Restore a Rozy POS JSON backup into an isolated browser profile/test environment.
6. Test malformed, incomplete and older-version backups; confirm rejected restores do not alter existing data.
7. Document retention, storage location, access control and restore owner.

### 4. Schema migrations

- Keep schema changes additive and versioned where possible.
- Test migrations against a copy of the current schema and representative data.
- Capture pre/post table counts and validate rollback or a forward-recovery plan.
- Never mark a migration complete unless every required step succeeds.
- Do not assume a browser IndexedDB transaction protects the remote Supabase database.

### 5. Vercel release and rollback

- Confirm the Vercel project is linked to the intended repository and branch.
- Confirm which branch is Production and which preview deployments use separate environment variables.
- Use a dedicated Supabase test project for previews; do not point previews at the current cloud project by default.
- Record the current production deployment identifier and verify redeployment/rollback procedure.
- Confirm Vercel environment variables do not expose secrets to the client bundle.
- Test health check, sign-in, checkout, sync, reload, and rollback on preview before promotion.

## Latest code hardening checkpoint

The development branch now also includes:
- Atomic local writes for product + per-shop stock.
- Atomic purchase, batch, and wastage inventory updates.
- Shop-scoped customer search/lookup/reports and order listing/statistics.
- Order creation and payment writes grouped with payment/audit records in local transactions.
- Guard against deleting an order with payment history; unpaid order deletions are audited and queued for cloud deletion.
- A consistent readonly local backup snapshot and backup-format version validation.
- Pure purchase validation with dedicated unit tests.
- Final queue-count check to avoid reporting sync success while concurrent queued work remains.

CI passed for commit `ae3b0f160640c52f88f604c2561adae5c60561e9`: unit tests, strict lint of selected critical modules, and production build passed. The automated suite has 29 tests for payment/refund/cash rules and pure purchase/backup validation. Full-project lint remains non-blocking. This does not validate live Supabase sync, cloud RLS, IndexedDB transaction rollback under browser faults, or actual backup restore.

## Product decisions now confirmed

The owner has confirmed multiple shops, multiple devices, owner/cashier roles, India as the initial market, and reliability as the top priority. See [`MULTI_SHOP_ARCHITECTURE.md`](./MULTI_SHOP_ARCHITECTURE.md) for the proposed data boundaries, role model, sync contract, India-market tax requirements, and regression test matrix. This is a design specification; the controls are not all implemented yet.

## Release gate

Do not merge or deploy until all are true:

- [ ] Latest CI for the exact proposed commit is green.
- [ ] Full-project lint debt is either fixed or documented as non-blocking with a tracked remediation issue.
- [ ] Supabase backup and isolated restore drill verified.
- [ ] Local JSON backup restore drill verified.
- [ ] Multi-device sync conflict and pagination integration tests pass.
- [ ] RLS / shop isolation reviewed and tested using separate accounts.
- [ ] Preview environment is isolated from the current Supabase project.
- [ ] Migration and rollback steps are documented and rehearsed.
- [ ] Final smoke tests pass and an operator is available to monitor the release.

## Current decision

**Hold release.** The next engineering task should be sync design and automated integration tests, while a separate isolated backup/restore drill is prepared. Avoid cosmetic feature work until these data-integrity blockers are addressed.
