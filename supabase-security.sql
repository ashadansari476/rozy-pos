-- ============================================================
-- Rozy POS: lock the cloud database so only the signed-in sync account can use it.
--
-- BEFORE running this:
--   1. Supabase -> Authentication -> Users -> "Add user": create ONE email + password
--      (tick "Auto confirm user"). This is the sync account.
--   2. In the app: Settings -> Cloud Sync -> "Sync account" -> Sign in. Do this on EVERY device.
--      Devices that are not signed in stop syncing once this script has run.
-- Then paste this whole file into Supabase -> SQL Editor and press Run (safe to run again).
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','sales','sale_items','customers','orders','order_items',
    'expenses','targets','cash_drawer','audit_log','stock_movements','wastage',
    'suppliers','purchases','purchase_items','shop_stock','pos_users','batches','payments'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists rozy_authenticated_all on public.%I', t);
      execute format(
        'create policy rozy_authenticated_all on public.%I for all to authenticated using (true) with check (true)',
        t
      );
    end if;
  end loop;
end $$;

-- Product photos: only the signed-in account may upload or delete (the bucket can stay public for viewing).
drop policy if exists rozy_images_write on storage.objects;
create policy rozy_images_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- IMPORTANT: also delete any OLD policies you created earlier that grant access to the "anon" role
-- (Supabase -> Authentication -> Policies). Any policy for anon keeps the tables open to everyone.
