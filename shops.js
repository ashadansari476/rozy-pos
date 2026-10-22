import { deleteRemote, isSyncConfigured } from "./syncEngine";
import { db } from "./db";
import { hashPass } from "./users";

// ---------- Shop settings ----------
export async function getAllShops() {
  const rec = await db.settings.get("shops");
  return rec?.value || [];
}

export async function getShop(shopId) {
  const shops = await getAllShops();
  return shops.find((s) => s.id === shopId) || null;
}

export async function updateShop(shopId, updates) {
  const shops = await getAllShops();
  const updated = shops.map((s) =>
    s.id === shopId ? { ...s, ...updates } : s
  );
  await db.settings.put({ key: "shops", value: updated });
  return updated;
}

export async function addShop({ id, name, shortName, address, phone, billPrefix }) {
  const shops = await getAllShops();
  if (shops.find((s) => s.id === id)) throw new Error("Shop ID already exists");
  const newShop = {
    id,
    name,
    shortName: shortName || name,
    address: address || "",
    phone: phone || "",
    billPrefix: billPrefix || name.slice(0, 2).toUpperCase(),
    active: true,
  };
  await db.settings.put({ key: "shops", value: [...shops, newShop] });
  return newShop;
}

export async function deleteShop(shopId) {
  const shops = await getAllShops();
  const filtered = shops.filter((s) => s.id !== shopId);
  await db.settings.put({ key: "shops", value: filtered });
}

// ---------- Current shop (persisted in localStorage) ----------
const CURRENT_SHOP_KEY = "rozy-pos-current-shop";

export function getCurrentShopId() {
  return localStorage.getItem(CURRENT_SHOP_KEY) || "rozy";
}

export function setCurrentShopId(shopId) {
  localStorage.setItem(CURRENT_SHOP_KEY, shopId);
}

// ---------- Per-shop stock helpers ----------
export async function getShopStock(shopId, productId) {
  const record = await db.shopStock
    .where("[shopId+productId]")
    .equals([shopId, productId])
    .first();
  return record?.stock || 0;
}

export async function getShopStockRecord(shopId, productId) {
  return await db.shopStock
    .where("[shopId+productId]")
    .equals([shopId, productId])
    .first();
}

export async function getAllShopStock(shopId) {
  return await db.shopStock.where("shopId").equals(shopId).toArray();
}

export async function setShopStock(shopId, productId, stock, lowStock) {
  const existing = await getShopStockRecord(shopId, productId);
  if (existing) {
    await db.shopStock.update(existing.id, {
      stock,
      ...(lowStock !== undefined ? { lowStock } : {}),
    });
    return existing.id;
  } else {
    return await db.shopStock.add({
      shopId,
      productId,
      stock,
      lowStock: lowStock ?? 5,
    });
  }
}

export async function adjustShopStock(shopId, productId, delta) {
  const existing = await getShopStockRecord(shopId, productId);
  const current = existing?.stock || 0;
  const newStock = Math.max(0, current + delta);
  await setShopStock(shopId, productId, newStock);
  return newStock;
}

// ---------- List products with stock for a shop ----------
export async function getProductsWithStock(shopId) {
  const products = await db.products.toArray();
  const stocks = await getAllShopStock(shopId);
  const stockMap = {};
  for (const s of stocks) stockMap[s.productId] = s;

  return products.map((p) => ({
    ...p,
    stock: stockMap[p.id]?.stock ?? 0,
    lowStock: stockMap[p.id]?.lowStock ?? p.lowStock ?? 5,
  }));
}

// ---------- Per-shop stats ----------
export async function getShopStats(shopId) {
  const [stock, sales, customers, orders] = await Promise.all([
    db.shopStock.where("shopId").equals(shopId).toArray(),
    db.sales.where("shopId").equals(shopId).toArray(),
    db.customers.where("shopId").equals(shopId).toArray(),
    db.orders.where("shopId").equals(shopId).toArray(),
  ]);

  const totalSales = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalStockValue = stock.reduce((s, x) => s + (x.stock || 0), 0);

  return {
    productCount: stock.length,
    salesCount: sales.length,
    totalSales,
    totalStockValue,
    customerCount: customers.length,
    orderCount: orders.length,
  };
}

// ---------- Cashier management ----------
export async function getAllCashiers() {
  return await db.users.where("role").equals("cashier").toArray();
}

export async function getCashiersByShop(shopId) {
  const all = await db.users.where("role").equals("cashier").toArray();
  return all.filter((u) => u.shopId === shopId);
}

export async function addCashier({ username, password, shopId, role = "cashier" }) {
  const existing = await db.users.where("username").equals(username).first();
  if (existing) throw new Error("Username already taken");

  const hashed = await hashPass(password);

  return await db.users.add({
    username,
    password: hashed,
    role,
    shopId,
    createdAt: Date.now(),
  });
}

export async function updateCashier(id, updates) {
  const data = { ...updates };
  if (data.password) {
    data.password = await hashPass(data.password);
  } else {
    delete data.password;
  }
  return await db.users.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteCashier(id) {
  const user = await db.users.get(id);
  if (user?.role === "owner") throw new Error("Cannot delete owner");
  // Remove from the cloud too, otherwise the cashier comes back (and can log in) after the next sync.
  if (isSyncConfigured()) {
    try {
      await deleteRemote("users", id);
    } catch (e) {
      throw new Error(
        "Could not remove this cashier from the cloud. Connect to the internet and try again, " +
        "otherwise they could log in again after the next sync."
      );
    }
  }
  return await db.users.delete(id);
}