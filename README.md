# Rozy POS

Offline-first billing, stock, orders and day-end for Rozy Sweet, Snacks & Bakery (and other shops you add).
Built with React + Vite + Tailwind. Data is stored on each device (Dexie / IndexedDB) and can sync to your own Supabase project.
Works on phones, tablets and desktops, and can be installed to the home screen.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in /dist
```

Deploy `dist` on Vercel (already configured in `vercel.json`).

## First login

There is **no default PIN**. The first time the app opens on a device, the Owner tab asks you to create a 4-6 digit PIN.
Change it later in Settings -> Owner PIN. Cashiers log in with the username and password the owner creates (6+ characters).

## Cloud sync (Supabase)

Settings -> Cloud Sync: paste your Supabase **Project URL** and **anon public key**.
Never paste the `service_role` key into the app. Keep the URL and key private: they live in the browser of every device that syncs.

**Lock the cloud data (do this once):**
1. Supabase -> Authentication -> Users -> Add user. Create one email + password and tick "Auto confirm user". This is the sync account.
2. In the app on every device: Settings -> Cloud Sync -> Sync account -> Sign in.
3. Supabase -> SQL Editor: paste and run `supabase-security.sql`. After this the public key alone can no longer read or change your tables.
4. Delete any old Supabase policies that allow the `anon` role.

Each device now creates record ids inside its own number range, so two shops or devices no longer overwrite each other's sales.
Your Supabase `id` columns must be `bigint` (or `int8`); `int4` also works because ids stay below 2,147,483,647.

## Setting up a second location

1. Open the deployed site on the new device and create the owner PIN.
2. Settings -> Cloud Sync: enter the same Supabase URL and anon key, then press Sync.
3. The first sync downloads the full history; later syncs are fast.
4. Create a cashier for that shop in Settings -> Cashiers. Cashiers are locked to their own shop.

## Stock, refunds and day-end rules

- **One stock number per product per shop.** Billing, Inventory, purchases, wastage, adjustments and returns all use it.
- **Refunds:** Bills screen -> open a bill -> Refund / return items. A refund is saved as its own bill with negative amounts (RF-xx-0001), linked to the original, which is never edited. Cashiers need the owner's PIN. Items go back into stock only if you tick the box.
- **Payments must reconcile:** UPI and card must equal the bill; cash can be more (change is given back); in split payments any change comes out of the cash part.
- **Day-end:** expected cash = opening + cash from bills - cash refunds + cash received on orders - expenses paid from the drawer. A closed day cannot be closed again or billed into until the owner reopens it (logged).

## Tests

```bash
npm test      # money, payment, refund and cash rules (no install needed beyond Node)
```

## Known limits (read before relying on it)

- **PIN and password checks run in the browser.** They stop casual use of an unlocked device, but anyone who can open the browser developer tools on that device can read its local data. Cloud data is protected by the sync account and `supabase-security.sql` above (all devices share that one account).
- Bill numbers look like `RZ-0A-0001`; the middle part is a tag for the device, so two devices never issue the same number. Old bills keep the old format.
- Deleting a product or cashier needs the cloud. A product deleted offline is queued and removed at the next sync; a cashier cannot be deleted offline.
- Backups are plain JSON files containing customer data. Store them somewhere private.
- Dark mode is not implemented.

## Project layout

- `src/lib` - database, sync engine, billing, reports, auth helpers
- `src/stores` - app (login), cart, sync and product state
- `src/screens` - one file per page
- `src/index.css` and `tailwind.config.js` - the glass ("spatial") theme; change colours in the `:root` variables
