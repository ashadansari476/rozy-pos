# Approved store decisions — October 2026

- Internet required for payment completion. Browser online detection is only a connectivity check, **not proof of settlement**.
- Rozy and Warish financial records and stock must be separate. **Current gap:** products, prices and costs are still shared across shops; full separation is not implemented.
- Latest change wins on device conflict. **Current gap:** server-enforced last-write-wins, clock skew and concurrency need design and tests; not guaranteed yet.
- Only owner may change prices, delete records or issue refunds. Role predicates are defined; mutation endpoints and UI callsites need full enforcement audit. Cloud RLS remains required.
- Keep deleted sale and payment audit history for one year. **No automatic deletion is enabled** pending review of applicable tax and record retention laws.

## This batch
Checkout blocks offline payment completion and saves sale, line items, stock changes, stock movement and audit sync intents atomically when sync is configured. Cloud processing begins after local commit. Role permissions explicitly define owner-only pricing and refund privileges.

## Remaining release blockers
External payment confirmation, server-authoritative shop isolation and permissions, shop-specific prices, robust last-write-wins conflict handling, deletion tombstones, statutory retention review, and integration/build tests.
