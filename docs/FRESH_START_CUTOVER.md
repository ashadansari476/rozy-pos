# Fresh-start cutover — Rozy and Warish

**Do not execute on production until the new client authenticates as individual Supabase Auth users and the staging tests pass.**

User approved discarding prior business data, **not** deleting Supabase Auth users. This cutover deliberately preserves `auth.users`, owner login, and configuration.

## Preconditions

1. Export a backup of existing business data even if deletion is authorized.
2. Deploy/test a staging Supabase project and a preview build. Validate owner access to both shops and cashier access to only one.
3. Verify all 21 tables, foreign keys, defaults, RLS policies, grants, and current client payloads. Existing `public all` policies grant broad access and must be removed during the coordinated cutover.
4. Ensure the new client uses individual Supabase Auth sessions. The old anonymous/shared-sync client is **not compatible** with secure shop RLS.
5. Confirm payment, sale, stock and audit operations are safe with append-only policies. Confirm offline queue replay and two-device conflict tests.
6. Freeze writes and ensure no pending offline queue exists on any device before cutover.
7. Only then execute an explicitly reviewed, transactional business-data reset and RLS migration. Do not reset auth identities.

## Current production findings (read-only user screenshots)

- 21 public tables have permissive `public all` policies with `USING (true)` and `WITH CHECK (true)`.
- RLS is enabled but anon has SELECT/INSERT grants.
- 16 tables have `shop_id`; products and categories lack it.
- `pos_shop_memberships` does not yet exist.
- One owner Supabase Auth user was created.

## Release gates

- All public business tables have **zero** permissive `public all` policies, and anon has no read/write grants.
- Authenticated users can only read their shop, and only owner can change prices, refund, or delete permitted records.
- Owner has explicit memberships for both `rozy` and `warish`.
- Sale/payment/audit events are immutable or corrected with auditable reversals; legal retention reviewed.
- Cross-shop foreign keys and all child rows tested.
- Offline sales replay exactly once after reconnect; concurrent devices do not silently overwrite financial or stock events.
- New preview build passes end-to-end tests before production deployment.

**Do not run** `sql/20261024_shop_rls_staging.sql` on production as-is: it is a starting point and still requires compatibility review and removal of every existing permissive policy.
