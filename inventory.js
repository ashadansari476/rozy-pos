import { db } from "./db";
import { pushRecord } from "./syncEngine";
import { getProductsWithStock } from "./products";
import { isRefund } from "./money";

// Helper — get current shop ID
function getCurrentShopId() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

// ============================================================
// STOCK MODEL
// There is ONE stock number per product per shop: the shopStock record.
// Billing, the Inventory screen, purchases, wastage, adjustments and returns all use it.
// (Before, adjustments and purchases wrote products.stock, a second number that billing never
//  read, so restocking did not change what could be sold and sales did not change Inventory.)
// ============================================================

/**
 * Applies a stock change to THIS shop's shopStock record and logs it.
 * Must be called inside a db.transaction that includes shopStock, stockMovements and auditLog.
 * Returns the new stock and the record to push to the cloud AFTER the transaction commits.
 */
export async function applyStockChange({ shopId, product, qty, reason, note, cost, user }) {
  const ts = Date.now();
  const existing = await db.shopStock
    .where("[shopId+productId]")
    .equals([shopId, product.id])
    .first();

  const before = existing?.stock || 0;
  const newStock = Math.max(0, before + qty);
  const applied = newStock - before; // may be smaller than qty if stock would have gone below 0
  const lowStock = existing?.lowStock || product.lowStock || 5;

  let id;
  if (existing) {
    await db.shopStock.update(existing.id, { stock: newStock, updatedAt: ts });
    id = existing.id;
  } else {
    id = await db.shopStock.add({
      shopId,
      productId: product.id,
      stock: newStock,
      lowStock,
      updatedAt: ts,
    });
  }

  await db.stockMovements.add({
    shopId,
    ts,
    productId: product.id,
    productName: product.name,
    qty: applied,
    unit: product.unit,
    reason,
    note: (note || "") + (applied !== qty ? " (limited: stock cannot go below 0)" : ""),
    cost: cost || product.cost || 0,
    userName: user || "system",
    balanceAfter: newStock,
  });

  await db.auditLog.add({
    shopId,
    ts,
    userName: user || "system",
    action: "STOCK_ADJUSTED",
    entity: "product",
    entityId: product.id,
    details: { qty: applied, reason, note, newStock },
  });

  return {
    newStock,
    push: ["shopStock", { id, shopId, productId: product.id, stock: newStock, lowStock, updatedAt: ts }],
  };
}

function pushAll(pushes) {
  for (const [table, record] of pushes) {
    pushRecord(table, record).catch(() => {});
  }
}

// ============ STOCK ADJUSTMENTS ============

export async function adjustStock({ productId, qty, reason, note, cost, user, shopId }) {
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");
  if (!Number.isFinite(qty) || qty === 0) throw new Error("Enter a quantity");

  const shop = shopId || getCurrentShopId();
  let result;
  await db.transaction("rw", [db.shopStock, db.stockMovements, db.auditLog], async () => {
    result = await applyStockChange({ shopId: shop, product, qty, reason, note, cost, user });
  });
  pushAll([result.push]);
  return result.newStock;
}

// ============ WASTAGE ============

export async function recordWastage({ productId, qty, reason, note, user }) {
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  const shopId = getCurrentShopId();
  const cost = product.cost || 0;
  const wastageValue = cost * Math.abs(qty);
  let push;

  await db.transaction(
    "rw",
    [db.shopStock, db.stockMovements, db.auditLog, db.wastage],
    async () => {
      const r = await applyStockChange({
        shopId,
        product,
        qty: -Math.abs(qty),
        reason: "wastage",
        note: reason + (note ? ` - ${note}` : ""),
        user,
      });
      push = r.push;

      await db.wastage.add({
        shopId,
        ts: Date.now(),
        productId,
        productName: product.name,
        qty,
        unit: product.unit,
        reason,
        note: note || "",
        costValue: wastageValue,
        userName: user || "system",
      });
    }
  );

  pushAll([push]);
  return wastageValue;
}

export async function getWastage({ from, to, shopId } = {}) {
  const shop = shopId || getCurrentShopId();
  const all = await db.wastage.toArray();
  return all.filter((w) => {
    if (w.shopId && w.shopId !== shop) return false;
    if (from && w.ts < from) return false;
    if (to && w.ts > to) return false;
    return true;
  });
}

// ============ EXPIRY / BATCHES ============

export async function addBatch({ productId, qty, expiryDate, cost, batchNo, user }) {
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  const shopId = getCurrentShopId();
  let batchId;
  let push;

  await db.transaction(
    "rw",
    [db.batches, db.shopStock, db.stockMovements, db.auditLog],
    async () => {
      batchId = await db.batches.add({
        shopId,
        productId,
        productName: product.name,
        qty,
        unit: product.unit,
        expiryDate: expiryDate || null,
        cost: cost || product.cost || 0,
        batchNo: batchNo || "",
        ts: Date.now(),
        active: true,
      });

      const r = await applyStockChange({
        shopId,
        product,
        qty,
        reason: "restock",
        note: `Batch ${batchNo || batchId}`,
        cost,
        user,
      });
      push = r.push;
    }
  );

  pushAll([push]);
  return batchId;
}

export async function getExpiringBatches(daysAhead = 3) {
  const shop = getCurrentShopId();
  const now = Date.now();
  const cutoff = now + daysAhead * 24 * 60 * 60 * 1000;
  const all = await db.batches.toArray();
  return all
    .filter(
      (b) =>
        (!b.shopId || b.shopId === shop) &&
        b.active && b.expiryDate && b.expiryDate <= cutoff && b.qty > 0
    )
    .sort((a, b) => a.expiryDate - b.expiryDate);
}

export async function getExpiredBatches() {
  const shop = getCurrentShopId();
  const now = Date.now();
  const all = await db.batches.toArray();
  return all.filter(
    (b) =>
      (!b.shopId || b.shopId === shop) &&
      b.active && b.expiryDate && b.expiryDate < now && b.qty > 0
  );
}

export async function markBatchExpired(batchId, user) {
  const batch = await db.batches.get(batchId);
  if (!batch) return;

  await recordWastage({
    productId: batch.productId,
    qty: batch.qty,
    reason: "expired",
    note: `Batch ${batch.batchNo || batchId}`,
    user,
  });

  await db.batches.update(batchId, { active: false, qty: 0 });
}

// ============ SUPPLIERS ============

export async function addSupplier(supplier) {
  const shopId = getCurrentShopId();
  return await db.suppliers.add({
    ...supplier,
    shopId,
    createdAt: Date.now(),
  });
}

export async function updateSupplier(id, data) {
  return await db.suppliers.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteSupplier(id) {
  return await db.suppliers.delete(id);
}

export async function getAllSuppliers() {
  return await db.suppliers.toArray();
}

// ============ PURCHASES ============

export async function recordPurchase({ supplierId, supplierName, items, note, user }) {
  const shopId = getCurrentShopId();
  const total = items.reduce((s, it) => s + it.qty * it.cost, 0);
  let purchaseId;
  const pushes = [];

  // One transaction: the purchase record, every stock increase and every batch
  // are saved together or not at all.
  await db.transaction(
    "rw",
    [db.purchases, db.products, db.batches, db.shopStock, db.stockMovements, db.auditLog],
    async () => {
      purchaseId = await db.purchases.add({
        shopId,
        ts: Date.now(),
        supplierId: supplierId || null,
        supplierName: supplierName || "Unknown",
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          unit: it.unit,
          cost: it.cost,
          lineTotal: it.qty * it.cost,
        })),
        total,
        note: note || "",
        userName: user || "system",
      });

      for (const it of items) {
        const product = await db.products.get(it.productId);
        if (!product) throw new Error(`Product not found: ${it.productName}`);

        const r = await applyStockChange({
          shopId,
          product,
          qty: it.qty,
          reason: "restock",
          note: `Purchase from ${supplierName || "supplier"}`,
          cost: it.cost,
          user,
        });
        pushes.push(r.push);

        await db.products.update(it.productId, {
          cost: it.cost,
          updatedAt: Date.now(),
        });

        if (it.expiryDate) {
          await db.batches.add({
            shopId,
            productId: it.productId,
            productName: it.productName,
            qty: it.qty,
            unit: it.unit,
            expiryDate: it.expiryDate,
            cost: it.cost,
            batchNo: it.batchNo || "",
            ts: Date.now(),
            active: true,
          });
        }
      }
    }
  );

  pushAll(pushes);
  return { purchaseId, total };
}

export async function getPurchases({ from, to, supplierId, shopId } = {}) {
  const shop = shopId || getCurrentShopId();
  const all = await db.purchases.toArray();
  return all
    .filter((p) => {
      if (p.shopId && p.shopId !== shop) return false;
      if (from && p.ts < from) return false;
      if (to && p.ts > to) return false;
      if (supplierId && p.supplierId !== supplierId) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts);
}

// ============ STOCK MOVEMENTS ============

export async function getMovements({ productId, from, to, limit = 100, shopId } = {}) {
  const shop = shopId || getCurrentShopId();
  const all = await db.stockMovements.toArray();
  return all
    .filter((m) => {
      if (m.shopId && m.shopId !== shop) return false;
      if (productId && m.productId !== productId) return false;
      if (from && m.ts < from) return false;
      if (to && m.ts > to) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

// ============ INVENTORY STATS (this shop's stock) ============

export async function getInventoryStats(shopId) {
  const products = await getProductsWithStock(shopId || getCurrentShopId());
  let totalValue = 0;
  let retailValue = 0;
  let lowCount = 0;
  let outCount = 0;

  for (const p of products) {
    const cost = p.cost || 0;
    const price = p.price || 0;
    const stock = p.stock || 0;

    totalValue += cost * stock;
    retailValue += price * stock;

    if (stock === 0) outCount++;
    else if (stock <= (p.lowStock || 0)) lowCount++;
  }

  return {
    totalProducts: products.length,
    totalValue,
    retailValue,
    potentialProfit: retailValue - totalValue,
    lowCount,
    outCount,
  };
}

// ============ PROFIT CALCULATION (this shop) ============
// Refund bills carry negative quantities and totals, so returns reduce revenue and cost automatically.

export async function calculateProfit({ from, to, shopId } = {}) {
  const shop = shopId || getCurrentShopId();
  const sales = await db.sales.toArray();
  const saleItems = await db.saleItems.toArray();
  const products = await db.products.toArray();

  const productById = {};
  for (const p of products) productById[p.id] = p;

  const filteredSales = sales.filter((s) => {
    if ((s.shopId || s.counter) !== shop) return false;
    if (from && s.ts < from) return false;
    if (to && s.ts > to) return false;
    return true;
  });
  const saleIds = new Set(filteredSales.map((s) => s.id));
  // returned goods that went back into stock reduce cost; refunds without restock do not
  const noRestock = new Set(
    filteredSales.filter((s) => isRefund(s) && s.payment?.restock === false).map((s) => s.id)
  );

  let revenue = 0;
  let cost = 0;

  for (const it of saleItems) {
    if (!saleIds.has(it.saleId)) continue;
    revenue += it.lineTotal || it.qty * it.price;
    if (noRestock.has(it.saleId)) continue;
    const p = productById[it.productId];
    cost += (p?.cost || 0) * it.qty;
  }

  const wastage = await getWastage({ from, to, shopId: shop });
  const wastageCost = wastage.reduce((s, w) => s + (w.costValue || 0), 0);

  return {
    revenue,
    cost,
    wastageCost,
    grossProfit: revenue - cost,
    netProfit: revenue - cost - wastageCost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
  };
}
