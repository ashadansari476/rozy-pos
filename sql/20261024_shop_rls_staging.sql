-- Rozy POS: shop-scoped RLS, fail closed. REVIEW AND BACK UP FIRST.
-- SHARED ACCOUNT MODE: the owner deliberately uses one Supabase Auth account
-- on all devices. RLS can reject anon requests, but cannot distinguish a cashier
-- from the owner, nor enforce separation between the two shops for this owner.
-- Do NOT represent the owner-only policies below as cashier-level protection.
-- Staging only; review client write patterns before executing.
-- This migration is intentionally NOT executed by CI.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pos_shop_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id text NOT NULL CHECK (shop_id IN ('rozy','warish')),
  role text NOT NULL CHECK (role IN ('owner','cashier')),
  PRIMARY KEY (user_id, shop_id)
);
ALTER TABLE public.pos_shop_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_shop_memberships FROM anon, authenticated;
GRANT SELECT ON public.pos_shop_memberships TO authenticated;
DROP POLICY IF EXISTS pos_membership_self_read ON public.pos_shop_memberships;
CREATE POLICY pos_membership_self_read ON public.pos_shop_memberships
 FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
-- Bootstrap memberships only from Supabase SQL editor/service-role administration,
-- never from the browser. No authenticated user may grant themselves owner role.

CREATE OR REPLACE FUNCTION public.pos_has_shop_access(s text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.pos_shop_memberships m
 WHERE m.user_id = (select auth.uid()) AND m.shop_id = s) $$;
CREATE OR REPLACE FUNCTION public.pos_is_shop_owner(s text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.pos_shop_memberships m
 WHERE m.user_id = (select auth.uid()) AND m.shop_id = s AND m.role = 'owner') $$;
REVOKE ALL ON FUNCTION public.pos_has_shop_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pos_is_shop_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_has_shop_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_is_shop_owner(text) TO authenticated;

-- Stop rather than accidentally enabling broad access on an unexpected schema.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
 'products','categories','sales','customers','orders','expenses','targets',
 'cash_drawer','audit_log','stock_movements','wastage','suppliers','purchases',
 'shop_stock','pos_users','batches','payments','users'
 ] LOOP
  IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'Missing table: %',t; END IF;
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS shop_id text',t);
  -- Never guess the bakery for an untagged record.
  -- NOT NULL fails atomically if any untagged record remains.
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN shop_id SET NOT NULL',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
  EXECUTE format('DROP POLICY IF EXISTS "public all" ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS rozy_authenticated_all ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_shop_read ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_shop_insert ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_shop_update ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_shop_delete ON public.%I',t);
  EXECUTE format('CREATE POLICY pos_shop_read ON public.%I FOR SELECT TO authenticated USING (public.pos_has_shop_access(shop_id))',t);
  IF t IN ('products','categories','pos_users','targets','cash_drawer','audit_log') THEN
   EXECUTE format('CREATE POLICY pos_shop_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.pos_is_shop_owner(shop_id))',t);
  ELSE
   EXECUTE format('CREATE POLICY pos_shop_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.pos_has_shop_access(shop_id))',t);
  END IF;
  IF t NOT IN ('sales','payments','stock_movements','audit_log','purchases','wastage') THEN
   EXECUTE format('CREATE POLICY pos_shop_update ON public.%I FOR UPDATE TO authenticated USING (public.pos_is_shop_owner(shop_id)) WITH CHECK (public.pos_is_shop_owner(shop_id))',t);
  END IF;
  -- Immutable financial/audit events cannot be deleted via browser REST, even by an owner.
  -- Corrections must be new reversal events with a durable audit trail.
  IF t NOT IN ('sales','payments','stock_movements','audit_log','purchases','wastage') THEN
   EXECUTE format('CREATE POLICY pos_shop_delete ON public.%I FOR DELETE TO authenticated USING (public.pos_is_shop_owner(shop_id))',t);
  END IF;
 END LOOP;
END $$;
-- Financial event records should never be silently deleted by a cashier.
-- More restrictive per-table operation permissions and event immutability
-- must be reviewed before enabling this migration.

-- Child tables have no native shop ID in the current client; authorize through
-- their parent. This prevents cross-shop sale items/purchase items/order items.
DO $$
DECLARE t text; parent text; foreign_col text;
BEGIN
 FOR t,parent,foreign_col IN
  SELECT * FROM (VALUES
    ('sale_items','sales','sale_id'),
    ('purchase_items','purchases','purchase_id'),
    ('order_items','orders','order_id')
  ) AS x(t,parent,foreign_col)
 LOOP
  IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'Missing table: %',t; END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS rozy_authenticated_all ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_child_read ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_child_insert ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_child_update ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS pos_child_delete ON public.%I',t);
  EXECUTE format('CREATE POLICY pos_child_read ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I AND public.pos_has_shop_access(p.shop_id)))',t,parent,foreign_col);
  EXECUTE format('CREATE POLICY pos_child_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I AND public.pos_has_shop_access(p.shop_id)))',t,parent,foreign_col);
  EXECUTE format('CREATE POLICY pos_child_update ON public.%I FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I AND public.pos_is_shop_owner(p.shop_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I AND public.pos_is_shop_owner(p.shop_id)))',t,parent,foreign_col,parent,foreign_col);
  EXECUTE format('CREATE POLICY pos_child_delete ON public.%I FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I AND public.pos_is_shop_owner(p.shop_id)))',t,parent,foreign_col);
 END LOOP;
END $$;
-- Verify the migration fails if any broad permissive policy remains.
DO $
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND policyname='public all';
 IF n > 0 THEN RAISE EXCEPTION 'Unsafe: % public all policies remain', n; END IF;
END $;
-- STILL STAGING ONLY: validate client roles, table schema, child insert order,
-- and per-user Auth before execution. Shared owner sessions cannot restrict cashiers.
COMMIT;
