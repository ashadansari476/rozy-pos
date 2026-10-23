import { db } from "./db";
import { pushSingleProduct } from "./supabase";
import { pushRecord, isSyncConfigured, deleteRemote, queueOperation } from "./syncEngine";

// ============ PRODUCTS ============

export async function getAllProducts() {
  return await db.products.toArray();
}

export async function getProductsWithStock(shopId) {
  const products = await db.products.toArray();
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
  return await db.products.get(id);
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
  let productId;

  // Catalogue and shop-specific stock must be created together. If either write fails,
  // roll back both so a product cannot appear without a stock row for its shop.
  await db.transaction("rw", [db.products, db.shopStock], async () => {
    productId = await db.products.add({
      ...product,
      createdAt: now,
      updatedAt: now,
      active: true,
    });

    await db.shopStock.add({
      shopId,
      productId,
      stock: Number.isFinite(product.stock) ? product.stock : 0,
      lowStock: Number.isFinite(product.lowStock) ? product.lowStock : 5,
      updatedAt: now,
    });
  });

  // Push product + shopStock to cloud only after the local transaction commits.
  pushSingleProduct(productId).catch(() => {});
  pushShopStock(shopId, productId);

  return productId;
}

export async function updateProduct(id, product) {
  const { stock, lowStock, ...rest } = product;
  const shopId = localStorage.getItem("rozy-pos-current-shop") || "rozy";
  const now = Date.now();
  const stockChanged = stock !== undefined || lowStock !== undefined;

  await db.transaction("rw", [db.products, db.shopStock], async () => {
    const existingProduct = await db.products.get(id);
    if (!existingProduct) throw new Error("Product not found");

    await db.products.update(id, {
      ...rest,
      updatedAt: now,
    });

    if (stockChanged) {
      const existing = await db.shopStock
        .where("[shopId+productId]")
        .equals([shopId, id])
        .first();

      if (existing) {
        await db.shopStock.update(existing.id, {
          ...(stock !== undefined ? { stock } : {}),
          ...(lowStock !== undefined ? { lowStock } : {}),
          updatedAt: now,
        });
      } else {
        await db.shopStock.add({
          shopId,
          productId: id,
          stock: Number.isFinite(stock) ? stock : 0,
          lowStock: Number.isFinite(lowStock) ? lowStock : 5,
          updatedAt: now,
        });
      }
    }
  });

  if (stockChanged) pushShopStock(shopId, id);
  pushSingleProduct(id).catch(() => {});
}

export async function deleteProduct(id) {
  // Remove from the cloud too. If offline, remember the delete and send it at the next sync,
  // otherwise the product would reappear after the next pull.
  if (isSyncConfigured()) {
    try {
      await deleteRemote("products", id);
    } catch {
      await queueOperation("products", id, "delete", null);
    }
  }
  return await db.products.delete(id);
}

export async function searchProducts(query, category) {
  let products = await db.products.toArray();
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