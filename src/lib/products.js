import { db } from "./db";
import { isSyncConfigured, processQueue, queueOperation } from "./syncEngine";

// ============ PRODUCTS ============
import { filterProductsForShop, productBelongsToShop, withShopStock } from "./productShopRules";


export async function getAllProducts() {
  return filterProductsForShop(await db.products.toArray(), localStorage.getItem("rozy-pos-current-shop") || "rozy");
}

export async function getProductsWithStock(shopId) {
  const [products, stocks] = await Promise.all([
    db.products.toArray(),
    db.shopStock.where("shopId").equals(shopId).toArray(),
  ]);
  return withShopStock(products, stocks, shopId);
}

export async function getProduct(id) {
  const product = await db.products.get(id);
  return productBelongsToShop(product, localStorage.getItem("rozy-pos-current-shop") || "rozy") ? product : undefined;
}

// Sync product and stock changes through the durable queue only.
function flushProductQueue() {
  if (isSyncConfigured() && typeof navigator !== "undefined" && navigator.onLine) {
    processQueue().catch((error) => console.error("Product changes remain queued", error));
  }
}

export async function addProduct(product) {
  const now = Date.now();
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";
  const sync = isSyncConfigured();
  let productId;
  await db.transaction("rw", [db.products, db.shopStock, db.syncQueue], async () => {
    const { id: ignoredId, shopId: ignoredShop, stock, lowStock, ...fields } = product;
    const record = { ...fields, shopId, createdAt: now, updatedAt: now, active: true };
    productId = await db.products.add(record);
    if (sync) await queueOperation("products", productId, "upsert", { ...record, id: productId });
    const stockRecord = { shopId, productId, stock: stock ?? 0, lowStock: lowStock ?? 5, updatedAt: now };
    const stockId = await db.shopStock.add(stockRecord);
    if (sync) await queueOperation("shopStock", stockId, "upsert", { ...stockRecord, id: stockId });
  });
  flushProductQueue();
  return productId;
}

export async function updateProduct(id, product) {
  const { stock, lowStock, shopId: ignoredShopId, id: ignoredId, ...rest } = product;
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";
  const sync = isSyncConfigured();
  const now = Date.now();
  await db.transaction("rw", [db.products, db.shopStock, db.syncQueue], async () => {
    const existingProduct = await db.products.get(id);
    if (!productBelongsToShop(existingProduct, shopId)) throw new Error("Product belongs to another shop");
    const updatedProduct = { ...existingProduct, ...rest, updatedAt: now };
    await db.products.put(updatedProduct);
    if (sync) await queueOperation("products", id, "upsert", updatedProduct);
    if (stock !== undefined || lowStock !== undefined) {
      const existing = await db.shopStock.where("[shopId+productId]").equals([shopId, id]).first();
      const updatedStock = existing
        ? { ...existing, ...(stock !== undefined ? { stock } : {}), ...(lowStock !== undefined ? { lowStock } : {}), updatedAt: now }
        : { shopId, productId: id, stock: stock ?? 0, lowStock: lowStock ?? 5, updatedAt: now };
      const stockId = await db.shopStock.put(updatedStock);
      if (sync) await queueOperation("shopStock", stockId, "upsert", { ...updatedStock, id: stockId });
    }
  });
  flushProductQueue();
}

export async function deleteProduct(id) {
  const sync = isSyncConfigured();
  await db.transaction("rw", [db.products, db.syncQueue], async () => {
    const existing = await db.products.get(id);
    if (!existing) return;
    if (!productBelongsToShop(existing, localStorage.getItem("rozy-pos-current-shop") || "rozy")) throw new Error("Product belongs to another shop");
    // The delete intent and local deletion commit together, even while offline.
    if (sync) await queueOperation("products", id, "delete");
    await db.products.delete(id);
  });
  if (sync && typeof navigator !== "undefined" && navigator.onLine) {
    processQueue().catch((error) => console.error("Product deletion sync remains queued", error));
  }
}

export async function searchProducts(query, category) {
  let products = filterProductsForShop(await db.products.toArray(), localStorage.getItem("rozy-pos-current-shop") || "rozy");
  if (category && category !== "All") {
    products = products.filter((p) => p.category === category);
  }
  if (query) {
    const q = query.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
    );
  }
  return products;
}

// ============ CATEGORIES ============

function currentShop() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

export async function getCategories() {
  const shopId = currentShop();
  return (await db.categories.orderBy("sortOrder").toArray())
    .filter((c) => (c.shopId || "rozy") === shopId);
}

export async function addCategory({ name, icon }) {
  const shopId = currentShop();
  const sync = isSyncConfigured();
  let id;
  await db.transaction("rw", [db.categories, db.syncQueue], async () => {
    const count = (await db.categories.toArray()).filter((c) => (c.shopId || "rozy") === shopId).length;
    const record = { shopId, name, icon: icon || "📦", sortOrder: count + 1, updatedAt: Date.now() };
    id = await db.categories.add(record);
    if (sync) await queueOperation("categories", id, "upsert", { ...record, id });
  });
  flushProductQueue();
  return id;
}

export async function updateCategory(id, data) {
  const sync = isSyncConfigured();
  let result;
  await db.transaction("rw", [db.categories, db.syncQueue], async () => {
    const category = await db.categories.get(id);
    if (!category || (category.shopId || "rozy") !== currentShop()) throw new Error("Category belongs to another shop");
    const { id: ignoredId, shopId: ignoredShop, ...safe } = data;
    const record = { ...category, ...safe, updatedAt: Date.now() };
    result = await db.categories.put(record);
    if (sync) await queueOperation("categories", id, "upsert", record);
  });
  flushProductQueue();
  return result;
}

export async function deleteCategory(id) {
  const sync = isSyncConfigured();
  await db.transaction("rw", [db.categories, db.syncQueue], async () => {
    const category = await db.categories.get(id);
    if (!category || (category.shopId || "rozy") !== currentShop()) throw new Error("Category belongs to another shop");
    if (sync) await queueOperation("categories", id, "delete");
    await db.categories.delete(id);
  });
  flushProductQueue();
}

// ============ BULK IMPORT ============

export async function bulkImportProducts(rows) {
  const now = Date.now();
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";
  const sync = isSyncConfigured();
  await db.transaction("rw", [db.products, db.shopStock, db.syncQueue], async () => {
    for (const r of rows) {
      const record = {
        shopId, name: r.name, category: r.category || "Uncategorized",
        unit: r.unit || "piece", price: parseFloat(r.price) || 0,
        cost: parseFloat(r.cost) || 0, barcode: r.barcode || "",
        variants: r.variants || [], createdAt: now, updatedAt: now, active: true,
      };
      const productId = await db.products.add(record);
      if (sync) await queueOperation("products", productId, "upsert", { ...record, id: productId });
      const stockRecord = {
        shopId, productId, stock: parseFloat(r.stock) || 0,
        lowStock: parseFloat(r.lowStock) || 5, updatedAt: now,
      };
      const stockId = await db.shopStock.add(stockRecord);
      if (sync) await queueOperation("shopStock", stockId, "upsert", { ...stockRecord, id: stockId });
    }
  });
  flushProductQueue();
}

// ============ CSV HELPERS ============

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    if (!vals[0]) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] || "";
    });
    rows.push(obj);
  }
  return rows;
}

export function csvTemplate() {
  return `name,category,unit,price,cost,stock,lowStock,barcode
Bread Loaf,Bakery,piece,40,30,30,5,1234567890
Kaju Katli,Sweets,kg,900,700,5,1,
Motichoor Ladoo,Sweets,kg,500,380,6,1,
Pav,Bakery,piece,5,3,200,30,`;
}