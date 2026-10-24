-- Read-only checks before and after applying staging shop policies.
-- Review all returned rows. Do not run automated destructive cleanup.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'products','categories','sales','sale_items','customers','orders',
    'order_items','expenses','targets','cash_drawer','audit_log',
    'stock_movements','wastage','suppliers','purchases','purchase_items',
    'shop_stock','pos_users','batches','payments'
  )
ORDER BY tablename, policyname;

-- Inspect legacy unscoped rows before assigning them to Rozy.
SELECT 'products' AS table_name, COUNT(*) AS unscoped FROM public.products WHERE shop_id IS NULL
UNION ALL
SELECT 'categories', COUNT(*) FROM public.categories WHERE shop_id IS NULL;

-- Shop membership is privileged: no client account should be able to
-- INSERT/UPDATE/DELETE membership records through Supabase REST.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'pos_shop_memberships'
ORDER BY grantee, privilege_type;
