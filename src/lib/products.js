import { db } from "./db";
import { pushSingleProduct } from "./supabase";
import { pushRecord, isSyncConfigured, processQueue, queueOperation } from "./syncEngine";

// ============ PRODUCTS ============
import { filterProductsForShop, productBelongsToShop } from "./productShopRules";


export async function getAllProducts() {
  return filterProductsForShop(await db.products.toArray(), localStorage.getItem("rozy-pos-current-shop") || "rozy");
}

export async function getProductsWithStock(shopId) {
  const products = filterProductsForShop(await db.products.toArray(), shopId);
  const stocks = await db.shopStock.where("shopId").equals(shopId).toArray();
  const stockMap = {};
  for (const s of stocks) stockMap[s.productId] = s;

  return products.map((p) => ({
    ...p,
    stock: stockMap[p.id]?.stock ?? 0,
    lowStock: stockMap[p.id]?.lowStock ?? p.lowStock ?? 5,
  }));
}

export async function getProduct(id) {
  const product = await db.products.get(id);
  return productBelongsToShop(product, localStorage.getItem("rozy-pos-current-shop") || "rozy") ? product : undefined;
}

// Helper — push a single shopStock record to cloud
async function pushShopStock(shopId, productId) {
  try {
    const record = await db.shopStock
      .where("[shopId+productId]")
      .equals([shopId, productId])
      .first();
    if (!record) return;

    pushRecord("shopStock", {
      id: record.id,
      shopId: record.shopId,
      productId: record.productId,
      stock: record.stock || 0,
      lowStock: record.lowStock || 5,
      updatedAt: Date.now(),
    }).catch(() => {});
  } catch (e) {
    console.warn("Failed to push shopStock:", e.message);
  }
}

export async function addProduct(product) {
  const now = Date.now();
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";
  const productId = await db.products.add({
    ...product,
    shopId,
    createdAt: now,
    updatedAt: now,
    active: true,
  });

  // Create stock record for the current shop
  await db.shopStock.add({
    shopId,
    productId,
    stock: product.stock || 0,
    lowStock: product.lowStock || 5,
  });

  // Push product + shopStock to cloud
  pushSingleProduct(productId).catch(() => {});
  pushShopStock(shopId, productId);

  return productId;
}

export async function updateProduct(id, product) {
  const { stock, lowStock, shopId: ignoredShopId, ...rest } = product;
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";
  const existingProduct = await db.products.get(id);
  if (!productBelongsToShop(existingProduct, shopId)) throw new Error("Product belongs to another shop");
  await db.products.update(id, {
    ...rest,
    updatedAt: Date.now(),
  });


  // Update stock for current shop
  if (stock !== undefined || lowStock !== undefined) {
    const existing = await db.shopStock
      .where("[shopId+productId]")
      .equals([shopId, id])
      .first();

    if (existing) {
      await db.shopStock.update(existing.id, {
        ...(stock !== undefined ? { stock } : {}),
        ...(lowStock !== undefined ? { lowStock } : {}),
      });
    } else {
      await db.shopStock.add({
        shopId,
        productId: id,
        stock: stock || 0,
        lowStock: lowStock || 5,
      });
    }

    // Push updated stock
    pushShopStock(shopId, id);
  }

  // Push updated product to cloud
  pushSingleProduct(id).catch(() => {});
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

export async function getCategories() {
  return await db.categories.orderBy("sortOrder").toArray();
}

export async function addCategory({ name, icon }) {
  const count = await db.categories.count();
  return await db.categories.add({ name, icon: icon || "📦", sortOrder: count + 1 });
}

export async function updateCategory(id, data) {
  return await db.categories.update(id, data);
}

export async function deleteCategory(id) {
  return await db.categories.delete(id);
}

// ============ BULK IMPORT ============

export async function bulkImportProducts(rows) {
  const now = Date.now();
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";

  for (const r of rows) {
    const productId = await db.products.add({
      shopId,
      name: r.name,
      category: r.category || "Uncategorized",
      unit: r.unit || "piece",
      price: parseFloat(r.price) || 0,
      cost: parseFloat(r.cost) || 0,
      barcode: r.barcode || "",
      variants: r.variants || [],
      createdAt: now,
      updatedAt: now,
      active: true,
    });

    await db.shopStock.add({
      shopId,
      productId,
      stock: parseFloat(r.stock) || 0,
      lowStock: parseFloat(r.lowStock) || 5,
    });

    pushSingleProduct(productId).catch(() => {});
    pushShopStock(shopId, productId);
  }
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