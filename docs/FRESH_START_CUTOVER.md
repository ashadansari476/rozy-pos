# Rozy POS cutover — shared cloud account decision

**Status (24 Oct 2026): existing Supabase project migrated and read/write RLS checks reported PASS. Development branch is NOT merged into production. Final live REST/browser sync testing remains required.**

## Authentication decision

The owner selected **one shared Supabase Auth account** for cloud sync. The account is an **owner member of both** `rozy` and `warish`. Cashier usernames/PINs are local application identities, not separate Supabase Auth users.

### Explicit security limitations

- **The database cannot identify the individual cashier.** Every device using the shared session has the same database privileges as the owner, including both shops.
- **Server-side cashier-vs-owner restrictions are not enforceable** with this design. Local role checks only control the normal UI; a compromised device, browser session, or stolen token can bypass them.
- **Server-side bakery isolation between those devices is not enforceable** because the shared owner is authorized for both bakeries. Client-side `shop_id` filtering is a safety measure, **not** a security boundary.
- Audit trails from Supabase identify the shared sync identity, not the cashier who performed the operation. Locally recorded cashier names can be modified by a compromised client.
- Revoking a single cashier's cloud access requires rotating/revoking the shared account's sessions and updating all devices. The shared password must never be embedded in source code or shared publicly.

**Recommendation:** Individual Supabase Auth accounts remain necessary for genuine least-privilege cashier security and enforced separation. This shared-login option accepts the above limitations; it must not be represented as equivalent security.

## Completed database work (reported from SQL Editor)

- Previous business data cleared with user authorization; Supabase Auth account preserved.
- `pos_shop_memberships` has two owner memberships; helper functions `pos_has_shop_access` and `pos_is_shop_owner` created and tested.
- All 19 tables containing `shop_id` require a valid `rozy` or `warish` value.
- Child `sale_id`, `order_id`, `purchase_id` columns are required.
- **No foreign keys** currently enforce child/parent existence or cross-shop product references.
- **Update (24 Oct 2026):** user verified that all 21 business tables have RLS enabled, exactly four replacement policies, no `public all` policy, `anon` SELECT denied, and `authenticated` SELECT granted. Owner JWT SQL test confirmed owner access to both shops. A rollback-only test reported PASS for owner writes, parent/child authorization, outsider denial, and anonymous read denial. These results have not yet been reproduced via real browser REST requests.

## Release gates

1. Preview build: run `npm test`, `npm run build`, and targeted offline/online tests with two bakery datasets and two devices.
2. Verify every sync payload against live Supabase column types and NOT NULL constraints. Check all call sites and queued operations for missing `shopId` and legacy queue entries without `shopId`.
3. Test sale, order, purchase, payment, stock, and audit event creation and replay, including parent-before-child uploads, deletions, conflict handling and offline retries.
4. Review the staging RLS SQL against actual table schema and app write patterns; verify `users`, all 21 `public all` policies, grants, and parent-derived child policies.
5. **Completed on existing Supabase project:** SQL Editor migration was committed and subsequent read-only and transaction rollback security checks reported PASS. No separate staging project was created. Cashier/owner server authorization **cannot** be claimed as tested under a shared owner account.
6. Only after preview testing, database backup and zero pending queues, coordinate production client deployment and the database migration. Do not merge to `main` prematurely.

The SQL file `sql/20261024_shop_rls_staging.sql` is an **obsolete pre-migration draft**, NOT the applied SQL. Do not run it on the existing migrated database; its contents are not an authoritative record of the applied migration. Never backfill missing bakery IDs by guessing.

## Development branch after live database RLS migration

- Added schema-aware cloud upload payload filtering, JSONB order details, durable inventory/purchase queue changes, stronger ID collision checks, safe queue retry, and 41 read-only REST diagnostic checks accessible in Cloud Sync settings.
- Automated `npm test` and `npm run build` passing through commit `0dee58a1d561e0580f1d1bb9373162ce4cc2510e`.
- Latest Vercel preview deployments were blocked by a **Vercel build-rate limit**, unrelated to GitHub CI. Do not treat earlier preview URLs as representing the latest code.
- Next release gate: run the latest branch locally or after Vercel preview quota is restored; authenticate as the owner via the app and run **Read-Only Cloud Diagnostics**. Test writes, parent-before-child sync, payments, stock, retries, shop switching, and multiple devices after confirming the dry-run results. Do not merge to `main` until these end-to-end checks pass.
