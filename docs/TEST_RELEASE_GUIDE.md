# Rozy POS — Test Candidate Guide

Status: **internal test candidate only; not approved for production**
Branch: `hardening/phase-1-data-integrity`
Target market: India
Product model: multiple shops, multiple devices, owner and cashier roles

## Important safety rules

- Use only a dedicated test Supabase project and synthetic data.
- Do not connect this preview to the existing Supabase project unless its backup is verified and the owner explicitly approves.
- Do not enter real customer information, live GSTINs, payment credentials, or real transactions.
- Do not merge this branch to `main` or promote a Vercel deployment to Production.
- The sync engine still needs a version-aware change feed/outbox design and multi-device conflict tests. Passing CI is not proof that this risk is resolved.

## Test setup

1. Confirm the Vercel preview deployment is associated with this branch, not the Production branch.
2. Inspect the preview's environment variables. Confirm it points to a separate Supabase test project.
3. Confirm the Supabase test project contains no data that needs preserving.
4. Create synthetic test users for an owner and cashiers assigned to different shops.
5. Record the commit SHA and deployment URL for the test session.
6. Use browser profiles or separate devices to simulate independent devices.

If the preview environment or Supabase project cannot be confirmed, stop before signing in or creating records.

## Smoke-test checklist

### App basics
- [ ] App loads and refreshes without a blank screen or console error.
- [ ] Sign-in/sign-out works as intended.
- [ ] Owner and cashier views expose only their permitted actions.
- [ ] Selected shop is clearly visible and remains correct after reload.

### Sales and stock
- [ ] Create synthetic product and stock records for Shop A and Shop B.
- [ ] Simulate a failed local write where possible and verify product creation cannot leave a product without its shop-stock record.
- [ ] Record a multi-line purchase with a deliberately invalid line and confirm the entire purchase is rejected without changing any stock.
- [ ] Record batch intake and wastage; verify the batch/wastage record, stock balance, stock movement and audit entry stay consistent.
- [ ] Complete a cash sale and verify bill total, change, sale record and stock deduction.
- [ ] Complete a UPI sale and verify the amount recorded.
- [ ] Try a zero, negative, invalid and over-stock quantity; confirm rejection.
- [ ] Add the same product twice to one cart and verify total stock checks are correct.
- [ ] Verify Shop A sales and stock do not alter Shop B's stock.
- [ ] Verify discount calculations and saved sale total agree.

### Refunds and cash
- [ ] Create an advance order with an advance payment, deliver it with a balance payment, and reconcile that the advance is not counted twice in drawer cash.
- [ ] Try to delete an order with payment history; confirm deletion is blocked and the order/payment history remains.
- [ ] Try to delete a customer linked to sales/orders; confirm deletion is blocked so historical records remain.
- [ ] Refund part of a synthetic sale; verify the amount and returned stock policy.
- [ ] Attempt to refund more than sold; confirm rejection.
- [ ] Retry the same refund action and check for duplicate financial effect.
- [ ] Open and close a cash drawer; reconcile expected cash against synthetic cash sales, change, refunds and expenses.

### Sync and offline behavior — known release blocker
- [ ] With two isolated test devices, create different synthetic records while online and verify both eventually appear.
- [ ] Disconnect one device, create a sale, reload, reconnect and observe sync queue/error status.
- [ ] Force a sync request failure; confirm the UI does not report complete success.
- [ ] Replay a queued operation and confirm no duplicate sale/payment/stock movement is created.
- [ ] Test two devices editing the same record; record whether a stale value overwrites a newer one.
- [ ] Test more than 500 synthetic changes and confirm every change is retrieved.
- [ ] Verify deletions/voids are handled explicitly and are not resurrected unexpectedly.

**Do not mark sync as passed just because the UI eventually says synced.** The current architecture still pushes whole local table snapshots and does not yet have a fully verified version-aware change feed. Treat conflict, pagination and deletion tests as exploratory until that redesign is implemented.

### Multi-shop security
- [ ] Cashier assigned to Shop A cannot read or write Shop B records by changing local storage or request payloads.
- [ ] Cashier cannot create users, change roles, edit security settings or export all-shop data.
- [ ] Owner actions are restricted to the business/shop memberships assigned to that owner.
- [ ] Confirm the database's actual RLS policies and grants, not just the UI controls.

If cross-shop access is possible, stop testing and report a security failure. Do not use the current permissive all-row RLS policy for production multi-tenant use.

### India-market tax (functional review, not compliance certification)
- [ ] Verify INR/paise formatting and rounding.
- [ ] Test tax-inclusive and tax-exclusive pricing with synthetic examples.
- [ ] Verify intra-state CGST/SGST and inter-state IGST examples based on configured place-of-supply rules.
- [ ] Verify discounts, refunds/credit notes and invoice tax snapshots.
- [ ] Have an Indian tax professional validate the intended statutory invoice and numbering setup before real use.

### Backup, migration and rollback
- [ ] Export the local Rozy POS JSON backup and confirm it includes all expected tables/counts.
- [ ] Restore that backup into a separate browser profile and compare counts/relationships.
- [ ] Verify a future/unsupported backup version and mismatched table count are rejected before any data is changed.
- [ ] Try a malformed and incomplete backup; verify it is rejected without changing existing local data.
- [ ] Export/backup the Supabase test database and restore it into a separate test project.
- [ ] Run schema migration against a disposable copy and verify pre/post counts.
- [ ] Record current Vercel deployment ID and rehearse rollback in a safe test project.

## Defect report template

For every failure, capture:
- Test case and timestamp
- Commit SHA and preview deployment URL
- Shop and synthetic test user
- Expected result vs actual result
- Browser/device and online/offline state
- Redacted console/network error
- Whether the issue can be reproduced

Never include secrets, access tokens, or real customer data in an issue.

## Exit criteria for a test candidate

The preview can be used for controlled exploratory testing only when its environment is confirmed isolated. It is not production-ready until CI is green for the exact SHA, critical integration tests pass, multi-shop authorization is verified, cloud/local restore drills succeed, and Vercel rollback is rehearsed.
