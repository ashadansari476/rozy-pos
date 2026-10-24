import Dexie from "dexie";

export const db = new Dexie("RozyPOS");

db.version(7).stores({
  products: "++id, name, category, barcode",
  categories: "++id, name, sortOrder",
  settings: "key",

  shopStock: "++id, [shopId+productId], shopId, productId, stock",
  sales: "++id, shopId, billNo, ts, cashier, customerId",
  saleItems: "++id, saleId, productId",
  batches: "++id, shopId, productId, expiryDate",
  wastage: "++id, shopId, productId, ts",
  stockMovements: "++id, shopId, productId, ts, reason",
  purchases: "++id, shopId, supplierId, ts",
  purchaseItems: "++id, purchaseId, productId",
  suppliers: "++id, shopId, name",
  customers: "++id, shopId, phone, name",
  orders: "++id, shopId, customerId, status, deliveryDate",
  orderItems: "++id, orderId, productId",
  payments: "++id, shopId, orderId, ts, type",
  expenses: "++id, shopId, ts, category",
  targets: "++id, [shopId+date], shopId, date",
  users: "++id, shopId, username, role",
  auditLog: "++id, shopId, ts, user, action, entity",
  cashDrawer: "++id, [shopId+date], shopId, date",
  syncQueue: "++id, table, recordId, action, status, createdAt",
});

// Shop-specific catalogue indexes. Existing untagged rows remain Rozy's
// legacy data; no destructive product/category copy is performed.
db.version(8).stores({
  products: "++id, shopId, [shopId+name], name, category, barcode",
  categories: "++id, shopId, [shopId+name], name, sortOrder",
  settings: "key",
  shopStock: "++id, [shopId+productId], shopId, productId, stock",
  sales: "++id, shopId, billNo, ts, cashier, customerId",
  saleItems: "++id, saleId, productId",
  batches: "++id, shopId, productId, expiryDate",
  wastage: "++id, shopId, productId, ts",
  stockMovements: "++id, shopId, productId, ts, reason",
  purchases: "++id, shopId, supplierId, ts",
  purchaseItems: "++id, purchaseId, productId",
  suppliers: "++id, shopId, name",
  customers: "++id, shopId, phone, name",
  orders: "++id, shopId, customerId, status, deliveryDate",
  orderItems: "++id, orderId, productId",
  payments: "++id, shopId, orderId, ts, type",
  expenses: "++id, shopId, ts, category",
  targets: "++id, [shopId+date], shopId, date",
  users: "++id, shopId, username, role",
  auditLog: "++id, shopId, ts, user, action, entity",
  cashDrawer: "++id, [shopId+date], shopId, date",
  syncQueue: "++id, table, recordId, action, status, createdAt",
}).upgrade(async (tx) => {
  for (const tableName of ["products", "categories"]) {
    await tx.table(tableName).toCollection().modify((row) => {
      if (!row.shopId) row.shopId = "rozy";
    });
  }
});

// ========== DEVICE-SAFE IDS ==========
// Every device used to number its records 1, 2, 3 ... and push them to the cloud with
// that number as the primary key. Two devices (two shops, a phone and a laptop) then
// overwrote each other's sales. Now each device gets its own block of ids.
//   id = deviceCode * 2,000,000 + counter    (stays below 2,147,483,647 so it also fits
//                                              a Supabase int4 column)
// Old records keep their old small ids; only NEW records use the block.
const ID_BLOCK = 2_000_000;
const ID_TABLES = [
  "products", "sales", "saleItems", "customers", "orders", "orderItems", "expenses",
  "targets", "cashDrawer", "auditLog", "stockMovements", "wastage", "suppliers",
  "purchases", "purchaseItems", "shopStock", "users", "batches", "payments",
];

function getDeviceCode() {
  try {
    const saved = parseInt(localStorage.getItem("rozy-pos-device-code") || "", 10);
    if (saved >= 1 && saved <= 999) return saved;
    const code = (crypto.getRandomValues(new Uint32Array(1))[0] % 999) + 1;
    localStorage.setItem("rozy-pos-device-code", String(code));
    return code;
  } catch {
    return 1;
  }
}

const DEVICE_CODE = getDeviceCode();

/** 2-character tag unique to this device, e.g. "0A". Used inside bill and order numbers. */
export function getDeviceTag() {
  return DEVICE_CODE.toString(36).toUpperCase().padStart(2, "0");
}
const blockStart = DEVICE_CODE * ID_BLOCK;
const idCounters = {};

for (const name of ID_TABLES) {
  db.table(name).hook("creating", (primKey) => {
    if (primKey !== undefined) return; // pulled from cloud or explicit id: leave alone
    idCounters[name] = (idCounters[name] || blockStart) + 1;
    return idCounters[name];
  });
}

async function initIdCounters() {
  for (const name of ID_TABLES) {
    const last = await db.table(name).where(":id").between(blockStart, blockStart + ID_BLOCK - 1, true, true).last();
    idCounters[name] = last ? last.id : blockStart;
  }
}

// ========== BOOTSTRAP ==========
export async function bootstrapSettings() {
  await initIdCounters();
  const existing = await db.settings.get("shop");

  if (!existing) {
    await db.settings.bulkPut([
      {
        key: "shop",
        value: {
          name: "Rozy Sweet, Snacks & Bakery",
          address: "Sukhia Pokhri, Darjeeling",
          phone: "",
          gstin: "",
          billPrefix: "RZ",
        },
      },
      {
        key: "receipt",
        value: {
          width: "58mm",
          showUPIQR: false,
          upiId: "",
          footerNote: "Thank you! Visit again",
        },
      },
      {
        key: "preferences",
        value: { language: "en", keyboardShortcuts: true },
      },
      // NOTE: no default owner PIN. The owner chooses one on first login (see Login.jsx).
    ]);
  }

  // ALWAYS ensure categories exist (fixes blank category dropdown after reset)
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkPut([
      { shopId: "rozy", name: "Bakery", sortOrder: 1, icon: "🥖" },
      { shopId: "rozy", name: "Sweets", sortOrder: 2, icon: "🍬" },
      { shopId: "rozy", name: "Snacks", sortOrder: 3, icon: "🥨" },
      { shopId: "rozy", name: "Beverages", sortOrder: 4, icon: "☕" },
    ]);
  }

  // Always ensure shops exist
  const shopsRec = await db.settings.get("shops");
  if (!shopsRec) {
    await db.settings.put({
      key: "shops",
      value: [
        {
          id: "rozy",
          name: "Rozy Sweet, Snacks & Bakery",
          shortName: "Rozy",
          address: "Sukhia Pokhri, Darjeeling",
          phone: "",
          billPrefix: "RZ",
          active: true,
        },
        {
          id: "warish",
          name: "Warish Bakery",
          shortName: "Warish",
          address: "Sukhia Pokhri, Darjeeling",
          phone: "",
          billPrefix: "WR",
          active: true,
        },
      ],
    });
  }

  // Ensure current shop is set
  const currentShop = localStorage.getItem("rozy-pos-current-shop");
  if (!currentShop) {
    localStorage.setItem("rozy-pos-current-shop", "rozy");
  }

  // Always dedupe categories on startup
  await dedupeCategories();
}

// ========== HELPERS ==========
async function dedupeCategories() {
  const all = await db.categories.toArray();
  const seen = new Map();
  const toDelete = [];

  for (const c of all) {
    const key = JSON.stringify([c.shopId || "rozy", (c.name || "").toLowerCase().trim()]);
    if (!key) continue;
    if (seen.has(key)) {
      toDelete.push(c.id);
    } else {
      seen.set(key, c.id);
    }
  }

  if (toDelete.length > 0) {
    console.log(`🧹 Removing ${toDelete.length} duplicate categories`);
    for (const id of toDelete) {
      await db.categories.delete(id);
    }
  }
}

// ========== MIGRATION ==========
export async function migrateExistingDataToRozy() {
  const flag = await db.settings.get("migrated_v4");
  if (flag?.value) return;

  console.log("Migrating existing data to Rozy...");

  const tablesToMigrate = [
    "sales", "batches", "wastage", "stockMovements",
    "purchases", "suppliers", "customers", "orders",
    "payments", "expenses", "targets",
  ];

  for (const tableName of tablesToMigrate) {
    try {
      const table = db.table(tableName);
      const all = await table.toArray();
      const updates = all
        .filter((r) => !r.shopId)
        .map((r) => table.update(r.id, { shopId: "rozy" }));
      await Promise.all(updates);
    } catch (e) {
      // ignore
    }
  }

  const products = await db.products.toArray();
  const existingStock = await db.shopStock.toArray();
  const existingKeys = new Set(existingStock.map((s) => `${s.shopId}-${s.productId}`));

  const stockRows = [];
  for (const p of products) {
    // Never create a Rozy stock record for a product owned by Warish.
    if ((p.shopId || "rozy") !== "rozy") continue;
    const key = `rozy-${p.id}`;
    if (!existingKeys.has(key)) {
      stockRows.push({
        shopId: "rozy",
        productId: p.id,
        stock: p.stock || 0,
        lowStock: p.lowStock || 5,
      });
    }
  }
  if (stockRows.length) {
    await db.shopStock.bulkAdd(stockRows);
  }

  await db.settings.put({ key: "migrated_v4", value: true });
  console.log("Migration complete.");
}