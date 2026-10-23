# Multi-shop architecture decisions for Rozy POS

Status: proposed design for review; not a statement that all controls are implemented.
Product decisions supplied by the owner on 2026-10-23:
- Multiple shops/branches
- Multiple computers/tablets per business
- Owner and cashier roles
- Initial market: India
- First priority: reliability
- Do not deploy to production until backup, migration, and rollback are verified

## 1. Data ownership boundaries

### Business-wide catalogue
Products and categories may be shared across a business only if the owner chooses that behavior. Product metadata (name, SKU/barcode, unit, tax classification, active status) must be distinguished from shop-specific values such as selling price overrides, reorder levels, and stock.

### Shop-owned operational records
Every operational record must carry an authoritative `shop_id` (local `shopId`) and be checked against the user's shop membership:
- sales and sale items (sale items inherit shop from their parent sale or also store it for policy simplicity)
- stock, stock movements, batches, wastage
- purchases and purchase items
- customers (unless the owner explicitly opts into a business-wide customer directory)
- orders and payments
- expenses, cash drawer sessions, targets
- audit events

Client-side `localStorage` shop selection is a UI preference only; it is not authorization. A client must not gain access by changing `rozy-pos-current-shop`, editing a request, or forging a row's `shop_id`.

## 2. Roles

### Owner
- Manage business profile and branches.
- Create/disable cashier accounts and assign a cashier to one or more permitted shops.
- View reports only for shops they own or are explicitly assigned to.
- Manage products, tax settings, prices, stock adjustments, purchases, refunds and backups according to an explicit permission matrix.

### Cashier
- Create sales for assigned shop(s).
- View only the operational data needed for those shop(s).
- Cannot manage users, change security policies, delete audit logs, export all-business data, or change tax configuration unless the owner explicitly grants a separate permission.
- Refunds, voids, discounts above a configured threshold, and stock adjustments should require a permission and be audit logged.

The existing shared Supabase sync-account pattern is not sufficient to enforce these roles in the cloud. Shared credentials cannot reliably tell the database which cashier is acting. Before multi-user production use, use individual authenticated identities and a server-enforced membership/role model.

## 3. Synchronization contract

Do not treat a full local table as the queue of changes to upload.

Each syncable row needs a stable identity and metadata:
- `id`: globally unique, stable across devices
- `shop_id`: authoritative tenant boundary where applicable
- `created_at`, `updated_at`: server-compatible timestamps
- `revision` or `sync_version`: monotonic version for conflict detection
- `device_id` / mutation ID: unique origin and idempotency key
- deletion tombstone or explicit change-log event where deletions are supported

A safe sync loop should:
1. Commit the local business transaction and its outbox event atomically.
2. Upload only pending outbox events, with idempotency keys.
3. Let the server validate identity, membership, shop, and expected revision.
4. Store acknowledged server revisions/cursors.
5. Pull changes from a durable ordered change feed/cursor, not just the newest N rows.
6. Apply remote changes transactionally and never infer deletion from a row missing in a page.
7. Surface version conflicts for explicit resolution. Do not silently overwrite a newer server row with a stale local copy.

Sales, sale items, stock movements, payments and refunds need idempotent mutation IDs to prevent duplicate financial effects when a device retries after a network timeout.

## 4. India-market finance requirements

Build tax behavior as configurable and testable, not hard-coded into the UI:
- INR currency formatting and paise precision.
- Tax-inclusive and tax-exclusive pricing behavior defined explicitly.
- GST rates and tax categories configurable by product and effective date.
- CGST/SGST versus IGST determined by validated place-of-supply/business rules, not guessed from the device.
- Store taxable value, tax components, rate, invoice number, seller GSTIN (when applicable), buyer details when required, and a snapshot of tax calculation on the invoice.
- Credit notes/refunds must reverse the original sale's amounts and tax components consistently.
- Sequential invoice numbering requirements and bill-series rules must be configurable and validated for the business's registration and transaction types.
- Do not advertise statutory compliance until the implementation is reviewed against current Indian requirements by a qualified tax professional.

## 5. Reliability test matrix

Before a release, add automated tests for:
- Shop A cannot read/write Shop B rows by changing client state or request payload.
- Cashier cannot perform owner-only actions.
- Two devices create sales concurrently without ID collisions or duplicate bill IDs.
- Replaying the same sync mutation twice has one financial effect.
- Offline sale survives browser restart and sync retry.
- A newer server revision is not overwritten by stale local data.
- Pagination/change cursor includes more than 500 changes and does not skip updates.
- Parent/child records (sale and sale items) remain consistent on interrupted sync.
- Stock never becomes negative through concurrent checkout/adjustment.
- Refund and credit-note retries do not duplicate reversals.
- GST calculations cover intra-state and inter-state examples, rounding, discounts, returns, and tax-inclusive/exclusive prices.
- Backup restore reproduces critical table counts and relationships in an isolated environment.

## 6. Release safety

- Use a separate Supabase test project for Vercel previews.
- Take a provider-supported cloud backup/export and verify a restore into a separate project/database.
- Test local JSON backup restore in a clean test browser profile.
- Test database migration against a copy of the schema and representative data.
- Record the current Vercel production deployment and rehearse rollback.
- Keep the pull request unmerged until CI and release gates are satisfied.

## 7. Implementation order

1. Add regression tests around current sync behavior and critical billing flows.
2. Design database tenant membership and row-level security; test in a separate Supabase project.
3. Implement a transactional local outbox and idempotent server sync protocol.
4. Add version-aware change feed, pagination/cursors, and conflict reporting.
5. Add role checks and shop membership enforcement on the server.
6. Add GST invoice snapshots and finance tests for India.
7. Complete backup/restore, migration, preview, smoke-test, and rollback drills.
