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

  // NEW in v7 — Sync queue
  syncQueue: "++id, table, recordId, action, status, createdAt",
});

// ========== BOOTSTRAP ==========
export async function bootstrapSettings() {
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
      { key: "ownerPin", value: "9832" },
    ]);

    await seedCategoriesIfMissing();
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
async function seedCategoriesIfMissing() {
  const defaults = [
    { name: "Bakery", sortOrder: 1, icon: "🥖" },
    { name: "Sweets", sortOrder: 2, icon: "🍬" },
    { name: "Snacks", sortOrder: 3, icon: "🥨" },
    { name: "Beverages", sortOrder: 4, icon: "☕" },
  ];

  const existing = await db.categories.toArray();
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase().trim()));

  for (const cat of defaults) {
    if (!existingNames.has(cat.name.toLowerCase().trim())) {
      await db.categories.add(cat);
    }
  }
}

async function dedupeCategories() {
  const all = await db.categories.toArray();
  const seen = new Map();
  const toDelete = [];

  for (const c of all) {
    const key = (c.name || "").toLowerCase().trim();
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