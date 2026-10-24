-- REQUIRED BEFORE enabling shop-scoped product sync in production.
-- Run after backing up public.products, and before deploying the new client.
-- Legacy products were shared; assigning them to Rozy preserves the legacy
-- catalogue there without copying its prices to Warish.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shop_id text;
UPDATE public.products SET shop_id = 'rozy' WHERE shop_id IS NULL;
ALTER TABLE public.products ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN shop_id SET DEFAULT 'rozy';
CREATE INDEX IF NOT EXISTS products_shop_id_idx ON public.products(shop_id);
COMMIT;
-- WARNING: This is a schema migration, not tenant isolation.
-- Existing rozy_authenticated_all RLS policies grant every authenticated sync
-- account access to every shop. Replace with shop membership / role policies
-- and test them before treating cloud data as isolated.
