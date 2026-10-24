// ============================================================
// ROZY POS — Bidirectional Sync Engine
// ============================================================

import { db } from "./db";
import { parseSyncTimestamp } from "./syncTimestampRules";
import { nextQueueFailure, selectReadyQueueOperations, retryFailedQueueOperation } from "./syncQueueRules";
import { authHeaders } from "./supabaseAuth";
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
  { name: "users",           supabaseTable: "pos_users",       key: "id" },
  { name: "batches",         supabaseTable: "batches",         key: "id" },
  { name: "payments",        supabaseTable: "payments",        key: "id" },
];

// ---------- Field name converters ----------
const FIELD_MAP = {
  products: {
    createdAt: "created_at",
    updatedAt: "updated_at",
    syncVersion: "sync_version",
  },
  categories: {
    sortOrder: "sort_order",
    createdAt: "created_at",
    updatedAt: "updated_at",
    syncVersion: "sync_version",
  },
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
    user: "user_name",
    entityId: "entity_id",
    syncVersion: "sync_version",
    createdAt: "created_at",
  },
  stockMovements: {
    shopId: "shop_id",
    productId: "product_id",
    productName: "product_name",
    userName: "user_name",
    user: "user_name",
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
    user: "user_name",
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

// ---------- Universal local-only fields ----------
// These are skipped for ALL tables (never sent to cloud)
const LOCAL_ONLY_FIELDS = [
  "imageDataUrl",      // local base64 image fallback
  "imageUrl",          // images stored separately in Storage
  "counter",           // old field, replaced by shopId
  "product_name",      // duplicated field
  "customer",          // old field, use customerId
];

// ---------- Table-specific local-only fields ----------
// These are skipped ONLY for specific tables
const TABLE_LOCAL_ONLY = {
  // products table: stock lives in shop_stock, not products
  products: ["stock", "lowStock", "low_stock"],
};

// ---------- Field converters ----------
function toCloud(localRecord, tableName) {
  const map = FIELD_MAP[tableName] || {};
  const out = {};
  const tableLocal = TABLE_LOCAL_ONLY[tableName] || [];

  for (const [k, v] of Object.entries(localRecord)) {
    // Skip universal local-only fields
    if (LOCAL_ONLY_FIELDS.includes(k)) continue;

    // Skip table-specific local-only fields
    if (tableLocal.includes(k)) continue;

    const cloudKey = map[k] || k;

    // Convert numeric timestamps to ISO strings
    if ((cloudKey === "updated_at" || cloudKey === "created_at") && typeof v === "number") {
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

// ---------- Supabase fetch ----------
async function sbFetch(path, options = {}) {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) throw new Error("Supabase not configured");

  const fullUrl = `${url}/rest/v1${path}`;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
        throw new Error(`Sync error ${res.status}: ${text}`);
      }
      return res.json().catch(() => null);
    } catch (err) {
      lastError = err;
      const isNetworkError =
        err.message.includes("Failed to fetch") ||
        err.message.includes("ERR_CERT") ||
        err.message.includes("NetworkError") ||
        err.name === "TypeError";

      if (!isNetworkError || attempt === 2) throw err;

      await new Promise((r) => setTimeout(r, 1000 * (attempt * 2 + 1)));
    }
  }
  throw lastError;
}

// ---------- Status checks ----------
export function isSyncConfigured() {
  return !!(getSupabaseUrl() && getSupabaseKey());
}

export function isOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

// ---------- Batch normalization ----------
// Ensures every record in a batch has the SAME keys
function normalizeBatch(payloads) {
  const allKeys = new Set();
  for (const p of payloads) {
    for (const k of Object.keys(p)) allKeys.add(k);
  }
  const keysArray = [...allKeys];
  return payloads.map((p) => {
    const out = {};
    for (const k of keysArray) {
      out[k] = p[k] !== undefined ? p[k] : null;
    }
    return out;
  });
}

// ---------- PUSH ----------
export async function pushTable(tableName, records) {
  if (!records.length) return { pushed: 0 };

  const config = SYNC_TABLES.find((t) => t.name === tableName);
  if (!config) return { pushed: 0 };

  const payload = records.map((r) => {
    const cloud = toCloud(r, tableName);
    delete cloud.syncVersion;
    delete cloud.sync_version;
    Object.keys(cloud).forEach((k) => {
      if (cloud[k] === undefined) delete cloud[k];
    });
    return cloud;
  });

  const normalized = normalizeBatch(payload);

  await sbFetch(`/${config.supabaseTable}`, {
    method: "POST",
    body: JSON.stringify(normalized),
  });

  return { pushed: records.length };
}

// ---------- PULL ----------
export async function pullTable(tableName, sinceTs) {
  const config = SYNC_TABLES.find((t) => t.name === tableName);
  if (!config) return { pulled: 0, updated: 0 };

  // Fetch every page on each pass. A newest-N pull misses updates to older
  // records (including historical sales corrections). Until server-side change
  // tracking exists, correctness takes priority over bandwidth.
  const PAGE = 500;
  const MAX_PAGES = 1000;
  const remote = [];
  let complete = false;
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    const page = await sbFetch(
      `/${config.supabaseTable}?select=*&limit=${PAGE}&offset=${pageIndex * PAGE}&order=id.desc`
    );
    if (!Array.isArray(page)) {
      throw new Error(`Invalid cloud response for ${tableName}`);
    }
    remote.push(...page);
    if (page.length < PAGE) {
      complete = true;
      break;
    }
  }
  if (!complete) {
    throw new Error(`Cloud pull exceeded pagination limit for ${tableName}`);
  }

  let pulled = 0;
  let updated = 0;

  // SPECIAL HANDLING: Categories sync by NAME to prevent duplicates
  if (tableName === "categories") {
    // Category IDs are not stable across devices; do not merge while local
    // category changes remain unsent.
    const unsentCategories = await db.syncQueue.filter((op) =>
      op.table === "categories" && (op.status === "pending" || op.status === "failed")
    ).count();
    if (unsentCategories) return { pulled: 0, updated: 0 };
    const localCategories = await db.categories.toArray();
    const localByName = {};
    for (const c of localCategories) {
      localByName[c.name.toLowerCase().trim()] = c;
    }
    const cloudByName = new Set();
    for (const r of remote) {
      cloudByName.add((r.name || "").toLowerCase().trim());
    }
    // A partial or stale cloud response must never delete local categories.
    // Deletions require an explicit, acknowledged tombstone protocol.
    // Add cloud categories that don't exist locally
    for (const r of remote) {
      const key = (r.name || "").toLowerCase().trim();
      if (!localByName[key]) {
        await db.categories.add({
          name: r.name,
          icon: r.icon || "📦",
          sortOrder: r.sort_order || 0,
        });
        pulled++;
      }
    }
    return { pulled, updated };
  }

  // Do not overwrite records that have local unacknowledged changes.
  const queued = await db.syncQueue.toArray();
  const dirtyIds = new Set(queued.filter((op) =>
    op.table === tableName && (op.status === "pending" || op.status === "failed")
  ).map((op) => String(op.recordId)));

  // Default handling for all other tables
  for (const r of remote) {
    const local = toLocal(r, tableName);
    if (dirtyIds.has(String(local.id))) continue;
    const existing = await db.table(tableName).get(local.id);

    if (!existing) {
      await db.table(tableName).put(local);
      pulled++;
    } else {
      const localTs = parseSyncTimestamp(existing.updatedAt ?? existing.createdAt);
      const remoteTs = parseSyncTimestamp(local.updatedAt ?? local.createdAt);

      // No reliable timestamp means a conflict cannot be safely resolved.
      // Preserve the local record rather than guessing that the cloud wins.
      if (remoteTs !== null && (localTs === null || remoteTs > localTs)) {
        await db.table(tableName).put({ ...existing, ...local });
        updated++;
      }
    }
  }

  return { pulled, updated };
}

// ---------- DELETE FROM CLOUD ----------
// Deleting only on this device is not enough: the next pull would bring the record back.
export async function deleteRemote(tableName, id) {
  const config = SYNC_TABLES.find((t) => t.name === tableName);
  if (!config) throw new Error(`Unknown table ${tableName}`);
  if (!isOnline()) throw new Error("You are offline");
  await sbFetch(`/${config.supabaseTable}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- SINGLE PUSH ----------
export async function pushRecord(tableName, record) {
  if (!isSyncConfigured()) return;
  if (!isOnline()) {
    await queueOperation(tableName, record.id, "upsert", record);
    return;
  }

  try {
    await pushTable(tableName, [record]);
  } catch (e) {
    await queueOperation(tableName, record.id, "upsert", record);
  }
}

// ---------- BATCH PUSH ----------
let batchQueue = new Map();
let batchTimer = null;

export function schedulePushBatch(tableName, record) {
  if (!isSyncConfigured()) return;

  if (!batchQueue.has(tableName)) {
    batchQueue.set(tableName, new Map());
  }
  batchQueue.get(tableName).set(record.id, record);

  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, 30000);
}

async function flushBatch() {
  const snapshot = new Map(batchQueue);
  batchQueue = new Map();

  if (!isOnline()) {
    for (const [tableName, records] of snapshot) {
      for (const record of records.values()) {
        await queueOperation(tableName, record.id, "upsert", record);
      }
    }
    return;
  }

  for (const [tableName, records] of snapshot) {
    try {
      await pushTable(tableName, Array.from(records.values()));
    } catch (e) {
      for (const record of records.values()) {
        await queueOperation(tableName, record.id, "upsert", record);
      }
    }
  }
}

// ---------- QUEUE ----------
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
  if (!isOnline()) return { processed: 0, failed: 0 };

  // Fetch all queue states so an older failed/deferred write can block newer
  // operations for the same record. Otherwise a stale upsert can resurrect a delete.
  const pending = selectReadyQueueOperations(await db.syncQueue.toArray());

  let processed = 0;
  let failed = 0;

  for (const op of pending) {
    try {
      if (op.action === "delete") {
        await deleteRemote(op.table, op.recordId);
      } else {
        await pushTable(op.table, [op.data]);
      }
      await db.syncQueue.delete(op.id);
      processed++;
    } catch (e) {
      await db.syncQueue.update(op.id, nextQueueFailure(op, e));
      failed++;
    }
  }

  // Never delete unacknowledged operations solely due to age.

  return { processed, failed };
}

export async function retryFailedSyncOperation(id) {
  const op = await db.syncQueue.get(id);
  if (!op) throw new Error("Sync operation not found");
  await db.syncQueue.update(id, retryFailedQueueOperation(op));
}

// ---------- FULL SYNC ----------
let syncInProgress = false;

export async function fullSync() {
  if (!isSyncConfigured()) throw new Error("Sync not configured");
  if (!isOnline()) throw new Error("You are offline");
  if (syncInProgress) return { skipped: true };

  syncInProgress = true;

  try {
    const results = { pushed: 0, pulled: 0, updated: 0 };

    const queueResult = await processQueue();
    results.pushed += queueResult.processed;

    // Pull
    for (const table of SYNC_TABLES) {
      try {
        const pull = await pullTable(table.name);
        results.pulled += pull.pulled;
        results.updated += pull.updated;
      } catch (e) {
        throw new Error(`Pull failed for ${table.name}: ${e.message}`, { cause: e });
      }
    }

    // NEVER bulk-upload the entire local database on a timer.
    // Only explicit changes queued by the application may be sent.
    // Initial data migration must be a separate reviewed and authenticated operation.
    localStorage.setItem("rozy-pos-last-sync", String(Date.now()));
    return results;
  } finally {
    syncInProgress = false;
  }
}

// ---------- AUTO SYNC ----------
let autoSyncTimer = null;

export function startAutoSync(intervalMs = 5 * 60 * 1000) {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  if (!isSyncConfigured()) return;

  setTimeout(() => fullSync().catch(() => {}), 5000);

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

// ---------- NETWORK LISTENERS ----------
export function setupNetworkListeners(onOnline, onOffline) {
  window.addEventListener("online", () => {
    if (onOnline) onOnline();
    setTimeout(() => fullSync().catch(() => {}), 2000);
  });

  window.addEventListener("offline", () => {
    if (onOffline) onOffline();
  });
}