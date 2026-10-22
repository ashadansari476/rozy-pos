// ============================================================
// ROZY POS — Supabase Integration (Legacy - now uses syncEngine)
// Kept for compatibility with product add/edit hooks
// ============================================================

import { db } from "./db";
import { authHeaders } from "./supabaseAuth";

const SUPABASE_URL_KEY = "rozy-pos-supabase-url";
const SUPABASE_KEY_KEY = "rozy-pos-supabase-key";

// ---------- Config ----------
export function getSupabaseUrl() {
  return localStorage.getItem(SUPABASE_URL_KEY) || "";
}

export function getSupabaseKey() {
  return localStorage.getItem(SUPABASE_KEY_KEY) || "";
}

export function setSupabaseConfig(url, key) {
  if (url) localStorage.setItem(SUPABASE_URL_KEY, url);
  if (key) localStorage.setItem(SUPABASE_KEY_KEY, key);
}

export function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_URL_KEY);
  localStorage.removeItem(SUPABASE_KEY_KEY);
}

export function isSyncEnabled() {
  return !!getSupabaseUrl() && !!getSupabaseKey();
}

// ---------- HTTP helpers ----------
async function sbFetch(path, options = {}) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) throw new Error("Supabase not configured");

  const fullUrl = `${url}/rest/v1${path}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${res.status} ${text}`);
  }
  return res.json().catch(() => null);
}

// ---------- Connection test ----------
export async function testConnection() {
  try {
    await sbFetch("/products?select=id&limit=1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---------- Helpers ----------
function toIso(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

// ---------- PRODUCTS SYNC ----------
export async function pushProducts() {
  const products = await db.products.toArray();
  if (!products.length) return { pushed: 0 };

  const payload = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || null,
    unit: p.unit || null,
    price: p.price || 0,
    cost: p.cost || 0,
    barcode: p.barcode || "",
    variants: p.variants || [],
    active: p.active !== false,
    created_at: toIso(p.createdAt),
    updated_at: toIso(p.updatedAt),
  }));

  await sbFetch("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { pushed: products.length };
}

export async function pullProducts() {
  const remote = await sbFetch("/products?select=*");
  if (!remote || !Array.isArray(remote)) return { pulled: 0, updated: 0 };

  let pulled = 0;
  let updated = 0;

  for (const r of remote) {
    const local = await db.products.get(r.id);
    const remoteUpdated = r.updated_at ? new Date(r.updated_at).getTime() : 0;

    if (!local) {
      await db.products.put({
        id: r.id,
        name: r.name,
        category: r.category,
        unit: r.unit,
        price: r.price || 0,
        cost: r.cost || 0,
        barcode: r.barcode || "",
        variants: r.variants || [],
        active: r.active !== false,
        createdAt: remoteUpdated,
        updatedAt: remoteUpdated,
      });
      pulled++;
    } else if (remoteUpdated > (local.updatedAt || 0)) {
      await db.products.put({
        ...local,
        name: r.name,
        category: r.category,
        unit: r.unit,
        price: r.price || 0,
        cost: r.cost || 0,
        barcode: r.barcode || "",
        variants: r.variants || [],
        active: r.active !== false,
        updatedAt: remoteUpdated,
      });
      updated++;
    }
  }

  return { pulled, updated };
}

export async function pushSingleProduct(productId) {
  if (!isSyncEnabled()) return;
  const p = await db.products.get(productId);
  if (!p) return;

  const payload = {
    id: p.id,
    name: p.name,
    category: p.category || null,
    unit: p.unit || null,
    price: p.price || 0,
    cost: p.cost || 0,
    barcode: p.barcode || "",
    variants: p.variants || [],
    active: p.active !== false,
    created_at: toIso(p.createdAt),
    updated_at: toIso(Date.now()),
  };

  try {
    await sbFetch("/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Push product failed:", e.message);
  }
}

export async function deleteProductRemote(productId) {
  if (!isSyncEnabled()) return;
  try {
    await sbFetch(`/products?id=eq.${productId}`, { method: "DELETE" });
  } catch (e) {
    console.warn("Delete product remote failed:", e.message);
  }
}

// ---------- CATEGORIES SYNC ----------
export async function pushCategories() {
  const categories = await db.categories.toArray();
  if (!categories.length) return;

  const payload = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon || "📦",
    sort_order: c.sortOrder || 0,
    created_at: toIso(Date.now()),
    updated_at: toIso(Date.now()),
  }));

  await sbFetch("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pullCategories() {
  const remote = await sbFetch("/categories?select=*");
  if (!remote || !Array.isArray(remote)) return;

  for (const r of remote) {
    const local = await db.categories.get(r.id);
    if (!local) {
      await db.categories.put({
        id: r.id,
        name: r.name,
        icon: r.icon || "📦",
        sortOrder: r.sort_order || 0,
      });
    }
  }
}

// ---------- FULL SYNC ----------
export async function fullSync() {
  if (!isSyncEnabled()) throw new Error("Sync not configured");

  const results = { products: null, categories: null };

  results.products = await pullProducts();
  await pullCategories();

  await pushProducts();
  await pushCategories();

  await pullProducts();

  return results;
}

// ---------- AUTO SYNC ----------
let syncTimer = null;

export function schedulePush(productId) {
  if (!isSyncEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushSingleProduct(productId);
  }, 2000);
}

// ---------- STATUS ----------
export async function getSyncStatus() {
  const enabled = isSyncEnabled();
  if (!enabled) return { enabled: false };

  try {
    const result = await testConnection();
    return { enabled: true, connected: result.ok, error: result.error };
  } catch (e) {
    return { enabled: true, connected: false, error: e.message };
  }
}