# Release blockers: shop isolation and offline conflict safety

**Status:** NOT production-ready. The development branch must not be merged or deployed without an explicit owner approval.

## Shop catalogue migration
The client now tags new product rows with `shopId` and filters local catalogues.
The cloud `products` table must have a `shop_id` column before these
writes can succeed. Back up Supabase first, then run
`sql/20261024_products_shop_scope.sql` manually. Do not run it against
production until the migration is reviewed. Existing untagged products are
assigned to Rozy; Warish needs its own separate catalogue. The migration
does **not** grant server-side shop isolation.

## Security
`supabase-security.sql` still contains authenticated-wide RLS access. A
shared sync account cannot provide per-user owner permissions or true tenant
separation. Before release: create server-enforced shop memberships and
owner-only write policies, eliminate permissive policies, and test direct
REST calls as both cashier and owner. Browser-side role flags are not
sufficient security.

## Multi-device conflict resolution
Local pull compares timestamps for clean records, but cloud upserts do not
atomically reject stale writes. Stock and payments require event-aware
reconciliation: blindly applying last-write-wins to stock balances can lose
sales. Server-side version checks and idempotent financial events remain
required. The client-generated device code can also collide and is not a
globally guaranteed unique identifier.

## End-to-end testing
GitHub CI runs Node unit tests and a Vite build, not a two-device browser
test. Before release, test two separate browser profiles and real devices:
offline cash checkout, unverified digital payments, refresh and recovery,
queue replay, concurrent edits, deletion propagation, product isolation,
cashier restrictions, and duplicate prevention. Confirm audit retention
against local legal requirements before implementing any purge.
