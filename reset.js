// ============================================================
// ROZY POS — Reset Data
// Wipes ALL transactional data, keeps settings + shops
// ============================================================

import { db } from "./db";
import { authHeaders } from "./supabaseAuth";
import { getSupabaseUrl, getSupabaseKey } from "./supabase";

// Tables to CLEAR (transactional data)
// Note: order matters — child tables before parents for some cases
export const TABLES_TO_CLEAR = [
  "syncQueue",
  "saleItems",
  "sales",
  "orderItems",
  "orders",
  "payments",
  "customers",
  "expenses",
  "targets",
  "cashDrawer",
  "auditLog",
  "stockMovements",
  "wastage",
  "purchaseItems",
  "purchases",
  "suppliers",
  "batches",
  "shopStock",
  "products",
  "categories",
  "users", // Cashiers
];

// Tables to KEEP (settings and config)
export const TABLES_TO_KEEP = [
  "settings",
];

// ---------- Supabase ----------
async function sbFetch(path, options = {}) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return null;

  const fullUrl = `${url}/rest/v1${path}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers || {}),
    },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return true;
}

// Supabase table names
const SUPABASE_TABLES = [
  "sale_items", "sales",
  "order_items", "orders",
  "payments", "customers",
  "expenses", "targets",
  "cash_drawer", "audit_log",
  "stock_movements", "wastage",
  "purchase_items", "purchases",
  "suppliers", "batches",
  "shop_stock", "products", "categories", "users",
];

// ---------- RESET LOCAL (IndexedDB) ----------
export async function resetLocal(onProgress) {
  const results = { cleared: [], errors: [] };

  // forget "already pulled full history" markers so a fresh pull is complete
  try {
    await db.settings.where("key").startsWith("pulledAll_").delete();
  } catch (e) {
    /* ignore */
  }

  for (const tableName of TABLES_TO_CLEAR) {
    try {
      if (!db.tables.some((t) => t.name === tableName)) {
        continue;
      }
      const count = await db.table(tableName).count();
      await db.table(tableName).clear();
      results.cleared.push(`${tableName}: ${count}`);
      if (onProgress) onProgress(`Cleared ${tableName} (${count} records)`);
    } catch (e) {
      results.errors.push(`${tableName}: ${e.message}`);
      if (onProgress) onProgress(`Failed: ${tableName}`);
    }
  }

  return results;
}

// ---------- RESET CLOUD (Supabase) ----------
export async function resetCloud(onProgress) {
  const results = { cleared: [], errors: [] };

  for (const tableName of SUPABASE_TABLES) {
    try {
      // Delete all rows — use a filter that matches everything
      // Supabase requires a filter; use id > 0 (all records)
      await sbFetch(`/${tableName}?id=gte.0`, {
        method: "DELETE",
      });
      results.cleared.push(tableName);
      if (onProgress) onProgress(`Cleared Supabase: ${tableName}`);
    } catch (e) {
      results.errors.push(`${tableName}: ${e.message}`);
      if (onProgress) onProgress(`Supabase failed: ${tableName}`);
    }
  }

  return results;
}

// ---------- DELETE ALL IMAGES ----------
export async function deleteAllProductImages(onProgress) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return { deleted: 0, errors: [] };

  const results = { deleted: 0, errors: [] };

  try {
    // List files in product-images bucket
    const listRes = await fetch(`${url}/storage/v1/object/list/product-images`, {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefix: "",
        limit: 1000,
        offset: 0,
      }),
    });

    if (!listRes.ok) {
      results.errors.push(`List failed: ${listRes.status}`);
      return results;
    }

    const files = await listRes.json();
    if (!Array.isArray(files)) return results;

    for (const file of files) {
      try {
        const deleteRes = await fetch(
          `${url}/storage/v1/object/product-images/${file.name}`,
          {
            method: "DELETE",
            headers: {
              ...(await authHeaders()),
            },
          }
        );
        if (deleteRes.ok) {
          results.deleted++;
          if (onProgress) onProgress(`Deleted image: ${file.name}`);
        }
      } catch (e) {
        results.errors.push(`Delete failed: ${file.name}`);
      }
    }
  } catch (e) {
    results.errors.push(e.message);
  }

  return results;
}

// ---------- RESET BILL NUMBERS ----------
export async function resetBillNumbers() {
  // Reset sequences in settings
  try {
    const sequences = ["billSeq_Rozy", "billSeq_Warish", "billSeq_rozy", "billSeq_warish"];
    for (const key of sequences) {
      await db.settings.delete(key);
    }
  } catch (e) {
    console.warn("Failed to reset bill numbers:", e.message);
  }
}

// ---------- FULL RESET ----------
export async function fullReset(onProgress) {
  if (onProgress) onProgress("Starting full reset...");

  // Step 1: Clear local IndexedDB
  if (onProgress) onProgress("Clearing local data...");
  const local = await resetLocal(onProgress);

  // Step 2: Clear Supabase
  if (onProgress) onProgress("Clearing cloud data...");
  const cloud = await resetCloud(onProgress);

  // Step 3: Delete product images
  if (onProgress) onProgress("Deleting product images...");
  const images = await deleteAllProductImages(onProgress);

  // Step 4: Reset bill numbers
  if (onProgress) onProgress("Resetting bill numbers...");
  await resetBillNumbers();

  // Step 5: Reset sync timestamp
  localStorage.removeItem("rozy-pos-last-sync");

  return { local, cloud, images };
}

// ---------- VERIFY RESET ----------
export async function verifyReset() {
  const stats = {};
  let totalRecords = 0;

  for (const tableName of TABLES_TO_CLEAR) {
    try {
      if (!db.tables.some((t) => t.name === tableName)) continue;
      const count = await db.table(tableName).count();
      stats[tableName] = count;
      totalRecords += count;
    } catch (e) {
      stats[tableName] = "error";
    }
  }

  return { stats, totalRecords };
}