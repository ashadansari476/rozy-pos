# Supabase shop security rollout (NOT APPLIED)

1. Take an independent, restorable database backup and stage the changes.
2. Inventory existing tables, columns, policies and cloud users. The SQL assumes
   shop-specific columns exist or can be safely backfilled to Rozy. **Do not
   blindly backfill records already belonging to Warish.** Review each row.
3. Stop using one shared sync account. Provision a separate Supabase Auth
   identity for each operator/device and assign membership using privileged
   SQL only. Do not expose the service-role key in the browser.
4. Review `sql/20261024_shop_rls_staging.sql` in a disposable Supabase
   environment first. It deliberately does not migrate existing users or
   resolve all table-specific write rules. Cashier update/delete is denied
   by default, which may block legitimate workflows until narrow policies
   or server-side RPCs are implemented.
5. Inspect **all** existing policies in `pg_policies` and remove any
   permissive policy not explicitly required. `rozy_authenticated_all` is
   removed by this script, but arbitrary earlier policies are not.
6. Verify REST calls using two separate Auth identities: Rozy cashier,
   Warish cashier, Rozy owner. Confirm both SELECT and direct POST/PATCH/
   DELETE are denied across shops. Confirm unauthorized owner operations fail.
7. Finish client migrations: `products.shopId` and `categories.shopId`
   must map to `shop_id`, and all catalogue/category queries must be scoped.
   Current category storage and bootstrap are global; **this migration alone
   does not finish bakery separation.**
8. Do not merge/deploy until real two-device offline, queue replay and
   financial event idempotency tests pass.

The script is committed for review, not executed against any database.
