# Rozy POS cutover — shared cloud account decision

**Status: staging only. Do not deploy or run the RLS migration in production yet.**

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
- **All 21 business tables still have `public all` permissive policies**; anonymous access is still exposed. Do not mistake authentication in the client for server-side security.

## Release gates

1. Preview build: run `npm test`, `npm run build`, and targeted offline/online tests with two bakery datasets and two devices.
2. Verify every sync payload against live Supabase column types and NOT NULL constraints. Check all call sites and queued operations for missing `shopId` and legacy queue entries without `shopId`.
3. Test sale, order, purchase, payment, stock, and audit event creation and replay, including parent-before-child uploads, deletions, conflict handling and offline retries.
4. Review the staging RLS SQL against actual table schema and app write patterns; verify `users`, all 21 `public all` policies, grants, and parent-derived child policies.
5. In a **staging** Supabase project, atomically remove permissive policies, revoke anon grants and test anon denial plus shared owner access to both shops. Cashier/owner server authorization **cannot** be claimed as tested under a shared owner account.
6. Only after preview testing, database backup and zero pending queues, coordinate production client deployment and the database migration. Do not merge to `main` prematurely.

The SQL file `sql/20261024_shop_rls_staging.sql` is **not approved for execution** without schema-specific review. Never backfill missing bakery IDs by guessing.
