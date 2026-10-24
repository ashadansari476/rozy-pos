# Approved store decisions — revised October 2026

1. **Full offline operation:** All POS functions, including recording cash, UPI, card and split payments, must work without internet. The sale and its sync operations are saved locally in IndexedDB, then replayed on reconnection. **Offline digital payment entries are operator-recorded, not bank-confirmed settlements.** Do not imply provider confirmation.
2. **Complete separation:** Rozy and Warish require separate records, stock, prices, products, customers and reports. **Not complete yet:** products/prices/costs/categories remain shared in the current data model. Requires schema migration and comprehensive callsite review.
3. **Latest change wins for everything:** Owner preference for device conflicts. **Not guaranteed yet:** existing pull uses timestamps but cloud upserts have no server-enforced compare-and-set; clock skew and conflicting offline sales/stock adjustments can lose updates. Must design and test server-authoritative conflict handling.
4. **Owner only:** Price edits, deletions and refunds must be restricted to owner. Permission predicates exist but every mutation and Supabase RLS still needs enforcement.
5. **One-year deleted sale/payment audit history, subject to law:** No automatic purge until statutory retention requirements are reviewed; preserve audit history safely.

## Implemented in this revision
- Removed the accidental internet requirement from checkout.
- Sales and their sync queue entries are committed together in IndexedDB when sync is configured; background sync resumes when online.
- Product and cashier deletions now journal their delete intent in the same local transaction and replay after connectivity returns.

## Outstanding before production
- Cloud setup must be configured to queue sync; devices without cloud setup need migration strategy.
- Verify browser storage persistence, offline reloads and retry/reconciliation in real devices.
- Complete per-shop product/catalogue separation and all owner-only mutation enforcement.
- Implement and test actual last-write-wins semantics on server and conflict resolution.
- Verify cloud RLS, backups, audit retention, and full CI/build.
