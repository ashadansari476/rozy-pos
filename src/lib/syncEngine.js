// ============================================================
// ROZY POS — Bidirectional Sync Engine
// ============================================================
// Syncs local IndexedDB ↔ Supabase cloud
// Handles: queuing, retrying, conflict resolution
// ============================================================

import { db } from "./db";
import { getSupabaseUrl, getSupabaseKey } from "./supabase";

// ---------- Tables to sync ----------
export const SYNC_TABLES = [
  { name: "products",        supabaseTable: "products",        key: "id" },
  { name: "categories",      supabaseTable: "categories",      key: "id" },
  { name: "sales",           supabaseTable: "sales",           key: "id" },
  { name: "saleItems",       supabaseTable: "sale_items",      key: "id" },
  { name: "customers",       supabaseTable: "customers",       key: "id" },
  { name: "orders",          supabaseTable: "orders",          key: "id" },
  { name: "orderItems",      supabaseTable: "order_items",     key: "id" },
  { name: "expenses",        supabaseTable: "expenses",        key: "id" },
  { name: "targets",         supabaseTable: "targets",         key: "id" },
  { name: "cashDrawer",      supabaseTable: "cash_drawer",     key: "id" },
  { name: "auditLog",        supabaseTable: "audit_log",       key: "id" },
  { name: "stockMovements",  supabaseTable: "stock_movements", key: "id" },
  { name: "wastage",         supabaseTable: "wastage",         key: "id" },
  { name: "suppliers",       supabaseTable: "suppliers",       key: "id" },
  { name: "purchases",       supabaseTable: "purchases",       key: "id" },
  { name: "purchaseItems",   supabaseTable: "purchase_items",  key: "id" },
  { name: "shopStock",       supabaseTable: "shop_stock",      key: "id" },
  { name: "users",           supabaseTable: "users",           key: "id" },
  { name: "batches",         supabaseTable: "batches",         key: "id" },
  { name: "payments",        supabaseTable: "payments",        key: "id" },
];

// Field name converters (camelCase local ↔ snake_case cloud)
const FIELD_MAP = {
  sales: {
    shopId: "shop_id",
    billNo: "bill_no",
    customerId: "customer_id",
    customerName: "customer_name",
    customerPhone: "customer_phone",
    fromOrderId: "from_order_id",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  saleItems: {
    saleId: "sale_id",
    productId: "product_id",
    lineTotal: "line_total",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  customers: {
    shopId: "shop_id",
    totalSpent: "total_spent",
    totalOrders: "total_orders",
    lastVisit: "last_visit",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  orders: {
    shopId: "shop_id",
    orderNo: "order_no",
    customerId: "customer_id",
    customerName: "customer_name",
    customerPhone: "customer_phone",
    totalAmount: "total_amount",
    advanceAmount: "advance_amount",
    balanceAmount: "balance_amount",
    deliveryDate: "delivery_date",
    orderType: "order_type",
    createdAtTs: "created_at_ts",
    createdBy: "created_by",
    deliveredAt: "delivered_at",
    deliveredBy: "delivered_by",
    billNo: "bill_no",
    saleId: "sale_id",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  orderItems: {
    orderId: "order_id",
    productId: "product_id",
    productName: "product_name",
    lineTotal: "line_total",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  expenses: {
    shopId: "shop_id",
    userName: "user_name",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  targets: {
    shopId: "shop_id",
    createdBy: "created_by",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  cashDrawer: {
    shopId: "shop_id",
    openingCash: "opening_cash",
    openedAt: "opened_at",
    openedBy: "opened_by",
    closingCash: "closing_cash",
    closedAt: "closed_at",
    closedBy: "closed_by",
    expectedCash: "expected_cash",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  auditLog: {
    shopId: "shop_id",
    userName: "user_name",
    entityId: "entity_id",
    syncVersion: "sync_version",
    createdAt: "created_at",
  },
  stockMovements: {
    shopId: "shop_id",
    productId: "product_id",
    productName: "product_name",
    userName: "user_name",
    balanceAfter: "balance_after",
    syncVersion: "sync_version",
    createdAt: "created_at",
  },
  wastage: {
    shopId: "shop_id",
    productId: "product_id",
    productName: "product_name",
    costValue: "cost_value",
    userName: "user_name",
    syncVersion: "sync_version",
    createdAt: "created_at",
  },
  suppliers: {
    shopId: "shop_id",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  purchases: {
    shopId: "shop_id",
    supplierId: "supplier_id",
    supplierName: "supplier_name",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  purchaseItems: {
    purchaseId: "purchase_id",
    productId: "product_id",
    productName: "product_name",
    lineTotal: "line_total",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  shopStock: {
    shopId: "shop_id",
    productId: "product_id",
    lowStock: "low_stock",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
  },
  users: {
    shopId: "shop_id",
    syncVersion: "sync_version",
    updatedAt: "updated_at",
    createdAt: "created_at",
  },
  batches: {
    shopId: "shop_id",
    productId: "product_id",
    productName: "product_name",
    expiryDate: "expiry_date",
    batchNo: "batch_no",
    syncVersion: "sync_version",
    createdAt: "created_at",
  },
  payments: {
    shopId: "shop_id",
    orderId: "order_id",
    syncVersion: "sync_version",
    createdAt: "created_at",
  },
};

// ---------- Field converters ----------
function toCloud(localRecord, tableName) {
  const map = FIELD_MAP[tableName] || {};
  const out = {};
  for (const [k, v] of Object.entries(localRecord)) {
    const cloudKey = map[k] || k;
    // Convert numeric timestamps to ISO strings for Supabase timestamp columns
    if (cloudKey === "updated_at" && typeof v === "number") {
      out[cloudKey] = new Date(v).toISOString();
    } else if (cloudKey === "created_at" && typeof v === "number") {
      out[cloudKey] = new Date(v).toISOString();
    } else {
      out[cloudKey] = v;
    }
  }
  return out;
}

function toLocal(cloudRecord, tableName) {
  const map = FIELD_MAP[tableName] || {};
  const reverse = {};
  for (const [k, v] of Object.entries(map)) {
    reverse[v] = k;
  }
  const out = {};
  for (const [k, v] of Object.entries(cloudRecord)) {
    const localKey = reverse[k] || k;
    out[localKey] = v;
  }
  return out;
}

async function sbFetch(path, options = {}) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) throw new Error("Supabase not configured");

  const fullUrl = `${url}/rest/v1${path}`;

  // Retry logic for flaky connections (3 attempts)
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(fullUrl, {
        ...options,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
          ...(options.headers || {}),
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sync error ${res.status}: ${text}`);
      }
      return res.json().catch(() => null);
    } catch (err) {
      lastError = err;
      // Only retry on network errors (not on 4xx)
      const isNetworkError =
        err.message.includes("Failed to fetch") ||
        err.message.includes("ERR_CERT") ||
        err.message.includes("NetworkError") ||
        err.name === "TypeError";

      if (!isNetworkError || attempt === 2) throw err;

      // Wait before retry: 1s, 3s
      await new Promise((r) => setTimeout(r, 1000 * (attempt * 2 + 1)));
    }
  }
  throw lastError;
}

// ---------- Sync status check ----------
export function isSyncConfigured() {
  return !!(getSupabaseUrl() && getSupabaseKey());
}

export function isOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

// ---------- PUSH: Local → Cloud ----------
export async function pushTable(tableName, records) {
  if (!records.length) return { pushed: 0 };

  const config = SYNC_TABLES.find((t) => t.name === tableName);
  if (!config) return { pushed: 0 };

  // Convert to cloud format
  const payload = records.map((r) => {
    const cloud = toCloud(r, tableName);
    // Remove any local-only fields
    delete cloud.syncVersion;
    return cloud;
  });

  // Upsert (merge duplicates)
  await sbFetch(`/${config.supabaseTable}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { pushed: records.length };
}

// ---------- PULL: Cloud → Local ----------
export async function pullTable(tableName, sinceTs) {
  const config = SYNC_TABLES.find((t) => t.name === tableName);
  if (!config) return { pulled: 0, updated: 0 };

  // Tables that don't have updated_at column — pull everything
  const noUpdatedAtTables = ["auditLog", "stockMovements", "wastage", "saleItems", "orderItems", "purchaseItems", "payments"];

  let query = `/${config.supabaseTable}?select=*&limit=500`;
  if (sinceTs && !noUpdatedAtTables.includes(tableName)) {
    query += `&updated_at=gt.${new Date(sinceTs).toISOString()}`;
  }

  const remote = await sbFetch(query);
  if (!Array.isArray(remote)) return { pulled: 0, updated: 0 };

  let pulled = 0;
  let updated = 0;

  for (const r of remote) {
    const local = toLocal(r, tableName);
    const existing = await db.table(tableName).get(local.id);

    if (!existing) {
      await db.table(tableName).put(local);
      pulled++;
    } else {
      // Conflict: latest updated_at wins
      const localTs = existing.updatedAt || existing.createdAt || 0;
      const remoteTs = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      if (remoteTs > localTs) {
        await db.table(tableName).put({ ...existing, ...local });
        updated++;
      }
    }
  }

  return { pulled, updated };
}

// ---------- SINGLE RECORD PUSH (for critical actions) ----------
export async function pushRecord(tableName, record) {
  if (!isSyncConfigured()) return;
  if (!isOnline()) {
    // Queue for later
    await queueOperation(tableName, record.id, "upsert", record);
    return;
  }

  try {
    await pushTable(tableName, [record]);
  } catch (e) {
    // Queue on failure
    await queueOperation(tableName, record.id, "upsert", record);
  }
}

// ---------- BATCH PUSH (for edits) ----------
let batchQueue = new Map();
let batchTimer = null;

export function schedulePushBatch(tableName, record) {
  if (!isSyncConfigured()) return;

  // Add to batch queue
  if (!batchQueue.has(tableName)) {
    batchQueue.set(tableName, new Map());
  }
  batchQueue.get(tableName).set(record.id, record);

  // Reset timer
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, 30000); // 30 seconds
}

async function flushBatch() {
  if (!isOnline()) return;

  const snapshot = new Map(batchQueue);
  batchQueue = new Map();

  for (const [tableName, records] of snapshot) {
    try {
      await pushTable(tableName, Array.from(records.values()));
    } catch (e) {
      // Queue for later
      for (const record of records.values()) {
        await queueOperation(tableName, record.id, "upsert", record);
      }
    }
  }
}

// ---------- SYNC QUEUE (retry mechanism) ----------
export async function queueOperation(tableName, recordId, action, data) {
  await db.syncQueue.add({
    table: tableName,
    recordId,
    action,
    data,
    status: "pending",
    createdAt: Date.now(),
    retries: 0,
  });
}

export async function processQueue() {
  if (!isOnline()) return { processed: 0 };

  const pending = await db.syncQueue
    .where("status")
    .equals("pending")
    .toArray();

  let processed = 0;

  for (const op of pending) {
    try {
      await pushTable(op.table, [op.data]);
      await db.syncQueue.update(op.id, { status: "done" });
      processed++;
    } catch (e) {
      await db.syncQueue.update(op.id, {
        retries: (op.retries || 0) + 1,
      });
    }
  }

  // Clean up old completed operations
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await db.syncQueue.where("createdAt").below(weekAgo).delete();

  return { processed };
}

// ---------- FULL BIDIRECTIONAL SYNC ----------
let syncInProgress = false;

export async function fullSync() {
  if (!isSyncConfigured()) throw new Error("Sync not configured");
  if (!isOnline()) throw new Error("You are offline");
  if (syncInProgress) return { skipped: true };

  syncInProgress = true;

  try {
    const lastSync = parseInt(localStorage.getItem("rozy-pos-last-sync") || "0");

    const results = { pushed: 0, pulled: 0, updated: 0 };

    // Step 1: Process pending queue (retry failed ops)
    await processQueue();

    // Step 2: Pull changes from cloud
    for (const table of SYNC_TABLES) {
      try {
        const pull = await pullTable(table.name, lastSync);
        results.pulled += pull.pulled;
        results.updated += pull.updated;
      } catch (e) {
        console.warn(`Pull failed for ${table.name}:`, e.message);
      }
    }

    // Step 3: Push local changes (only records newer than lastSync)
    // For simplicity, push recent records (last 7 days) on first sync
    if (lastSync === 0) {
      for (const table of SYNC_TABLES) {
        try {
          const localRecords = await db.table(table.name).toArray();
          if (localRecords.length > 0) {
            // Push in chunks of 100
            for (let i = 0; i < localRecords.length; i += 100) {
              const chunk = localRecords.slice(i, i + 100);
              await pushTable(table.name, chunk);
              results.pushed += chunk.length;
            }
          }
        } catch (e) {
          console.warn(`Push failed for ${table.name}:`, e.message);
        }
      }
    }

    // Record sync time
    localStorage.setItem("rozy-pos-last-sync", String(Date.now()));

    return results;
  } finally {
    syncInProgress = false;
  }
}

// ---------- AUTO SYNC SCHEDULER ----------
let autoSyncTimer = null;

export function startAutoSync(intervalMs = 5 * 60 * 1000) {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  if (!isSyncConfigured()) return;

  // Sync on start (after a delay)
  setTimeout(() => fullSync().catch(() => {}), 5000);

  // Periodic sync
  autoSyncTimer = setInterval(() => {
    if (isOnline()) {
      fullSync().catch(() => {});
    }
  }, intervalMs);
}

export function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

// ---------- ONLINE/OFFLINE LISTENERS ----------
export function setupNetworkListeners(onOnline, onOffline) {
  window.addEventListener("online", () => {
    if (onOnline) onOnline();
    // Auto-sync when back online
    setTimeout(() => fullSync().catch(() => {}), 2000);
  });

  window.addEventListener("offline", () => {
    if (onOffline) onOffline();
  });
}