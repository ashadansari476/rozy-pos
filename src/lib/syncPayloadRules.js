// Strict Supabase column allowlists, based on the existing public table schema.
// Prevents local-only fields (for example sale-item cost and order totals) from
// producing PostgREST "column not found" errors during queued uploads.
export const CLOUD_COLUMNS = {
  products: ["id","shop_id","name","category","unit","price","cost","barcode","variants","active","sync_version","created_at","updated_at"],
  categories: ["id","shop_id","name","icon","sort_order","sync_version","created_at","updated_at"],
  sales: ["id","shop_id","bill_no","ts","cashier","subtotal","discount","total","payment","customer_id","data","channel","source","from_order_id","customer_name","customer_phone","note","tax","sync_version","created_at","updated_at"],
  saleItems: ["id","sale_id","product_id","name","qty","unit","price","line_total","variant","sync_version","created_at","updated_at"],
  customers: ["id","shop_id","name","phone","data","total_spent","total_orders","last_visit","birthday","notes","address","sync_version","created_at","updated_at"],
  orders: ["id","shop_id","customer_name","status","delivery_date","data","channel","source","order_no","created_at_ts","created_by","delivered_at","delivered_by","bill_no","sale_id","sync_version","created_at","updated_at"],
  orderItems: ["id","order_id","product_id","product_name","qty","unit","price","line_total","sync_version","created_at","updated_at"],
  expenses: ["id","shop_id","amount","category","note","user_name","ts","sync_version","created_at","updated_at"],
  targets: ["id","shop_id","date","amount","created_by","sync_version","created_at","updated_at"],
  cashDrawer: ["id","shop_id","date","opening_cash","opened_at","opened_by","closing_cash","closed_at","closed_by","expected_cash","difference","notes","sync_version","created_at","updated_at"],
  auditLog: ["id","shop_id","user_name","action","entity","entity_id","details","ts","sync_version","created_at","updated_at"],
  stockMovements: ["id","shop_id","product_id","product_name","qty","unit","reason","note","cost","user_name","balance_after","ts","sync_version","created_at","updated_at"],
  wastage: ["id","shop_id","product_id","product_name","qty","unit","reason","note","cost_value","user_name","ts","sync_version","created_at","updated_at"],
  suppliers: ["id","shop_id","name","phone","address","supplies","sync_version","created_at","updated_at"],
  purchases: ["id","shop_id","supplier_id","supplier_name","total","note","user_name","ts","sync_version","created_at","updated_at"],
  purchaseItems: ["id","purchase_id","product_id","product_name","qty","unit","cost","line_total","sync_version","created_at","updated_at"],
  shopStock: ["id","shop_id","product_id","stock","low_stock","sync_version","updated_at"],
  users: ["id","shop_id","username","password","role","sync_version","created_at","updated_at"],
  batches: ["id","shop_id","product_id","product_name","qty","unit","cost","batch_no","expiry_date","active","sync_version","created_at","updated_at"],
  payments: ["id","shop_id","order_id","type","amount","note","ts","sync_version","created_at","updated_at"],
};

// The existing orders table has no native totals, customer_id, phone, items,
// order_type, notes or address columns. Preserve them in the JSONB data column.
const ORDER_EXTRA = new Set([
  "customerId", "customerPhone", "items", "totalAmount", "advanceAmount",
  "balanceAmount", "orderType", "notes", "address"
]);

export function serializeCloudRecord(record, table, fieldMap = {}, localOnly = [], tableLocalOnly = []) {
  const columns = CLOUD_COLUMNS[table];
  if (!columns) throw new Error(`Unknown cloud table mapping: ${table}`);
  const allowed = new Set(columns);
  const payload = {};
  const extra = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || localOnly.includes(key) || tableLocalOnly.includes(key)) continue;
    const cloudKey = fieldMap[key] || key;
    if (table === "orders" && ORDER_EXTRA.has(key)) {
      extra[key] = value;
      continue;
    }
    if (!allowed.has(cloudKey)) continue;
    if ((cloudKey === "created_at" || cloudKey === "updated_at") && typeof value === "number") {
      payload[cloudKey] = new Date(value).toISOString();
    } else {
      payload[cloudKey] = value;
    }
  }
  if (table === "orders") {
    const previous = record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? record.data : {};
    payload.data = { ...previous, ...extra };
  }
  return payload;
}

export function deserializeCloudRecord(record, table, fieldMap = {}) {
  const reverse = Object.fromEntries(Object.entries(fieldMap).map(([k, v]) => [v, k]));
  const local = {};
  for (const [key, value] of Object.entries(record)) {
    const localKey = reverse[key] || key;
    if ((localKey === "createdAt" || localKey === "updatedAt") && typeof value === "string") {
      const parsed = Date.parse(value);
      local[localKey] = Number.isFinite(parsed) ? parsed : value;
    } else {
      local[localKey] = value;
    }
  }
  if (table === "orders" && local.data && typeof local.data === "object" && !Array.isArray(local.data)) {
    // Native columns win over any conflicting fields inside JSONB.
    return { ...local.data, ...local };
  }
  return local;
}
