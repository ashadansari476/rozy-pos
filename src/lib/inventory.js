import { validatePurchaseItems } from "./inventoryRules";
import { db } from "./db";
import Dexie from "dexie";
import { isSyncConfigured, processQueue, queueOperation } from "./syncEngine";

async function queueInventoryRow(table, id) {
  if (!isSyncConfigured() || id == null) return;
  const record = await db.table(table).get(id);
  if (record) await queueOperation(table, id, "upsert", record);
}

function flushInventoryQueue() {
  // Wastage/expiry/purchases can call stock helpers from a larger transaction.
  // Never send cloud requests before that outer transaction has committed.
  if (Dexie.currentTransaction) return;
  if (isSyncConfigured() && typeof navigator !== "undefined" && navigator.onLine) {
    processQueue().catch((error) => console.error("Inventory cloud changes remain queued", error));
  }
}

// Helper — get current shop ID
function getCurrentShopId() {
  const shop = localStorage.getItem("rozy-pos-current-shop");
  if (shop !== "rozy" && shop !== "warish") throw new Error("Select a valid bakery");
  return shop;
}

// ============ STOCK ADJUSTMENTS ============

export async function adjustStock({ productId, qty, reason, note, cost, user }) {
  if (!Number.isFinite(qty) || qty === 0) {
    throw new Error("Stock adjustment quantity must be a finite, non-zero number");
  }
  if (cost !== undefined && cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    throw new Error("Stock adjustment cost must be a non-negative finite number");
  }

  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  const shopId = getCurrentShopId();
  if (product.shopId !== shopId) throw new Error("Cannot change stock for a product from another bakery");
  const insideParentTransaction = Boolean(Dexie.currentTransaction);
  const ts = Date.now();
  let newStock = 0;

  // Stock belongs to a shop, not to the shared product catalogue. Keep the stock
  // update and its movement/audit records atomic so reports cannot show half a change.
  await db.transaction("rw", [db.shopStock, db.stockMovements, db.auditLog, db.syncQueue], async () => {
    let stockRecord = await db.shopStock
      .where("[shopId+productId]")
      .equals([shopId, productId])
      .first();

    if (!stockRecord) {
      stockRecord = {
        shopId,
        productId,
        stock: 0,
        lowStock: product.lowStock ?? 5,
      };
      stockRecord.id = await db.shopStock.add(stockRecord);
    }

    const currentStock = Number.isFinite(stockRecord.stock) ? stockRecord.stock : 0;
    newStock = currentStock + qty;
    if (newStock < 0) {
      throw new Error(`Insufficient stock. Available: ${currentStock} ${product.unit || ""}`.trim());
    }

    await db.shopStock.update(stockRecord.id, { stock: newStock, updatedAt: ts });
    await queueInventoryRow("shopStock", stockRecord.id);

    const movementId = await db.stockMovements.add({
      shopId,
      ts,
      productId,
      productName: product.name,
      qty,
      unit: product.unit,
      reason,
      note: note || "",
      cost: cost ?? product.cost ?? 0,
      userName: user || "system",
      balanceAfter: newStock,
    });
    await queueInventoryRow("stockMovements", movementId);

    const auditId = await db.auditLog.add({
      shopId,
      ts,
      userName: user || "system",
      action: "STOCK_ADJUSTED",
      entity: "product",
      entityId: productId,
      details: { qty, reason, note, newStock },
    });
    await queueInventoryRow("auditLog", auditId);
  });

  if (!insideParentTransaction) flushInventoryQueue();
  return newStock;
}
// ============ WASTAGE ============

export async function recordWastage({ productId, qty, reason, note, user }) {
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Wastage quantity must be a positive number");
  }
  if (!Number.isFinite(product.cost ?? 0) || (product.cost ?? 0) < 0) {
    throw new Error("Product cost must be a non-negative finite number");
  }

  const shopId = getCurrentShopId();
  const cost = product.cost ?? 0;
  const wastageValue = cost * qty;
  if (!Number.isFinite(wastageValue) || wastageValue < 0) {
    throw new Error("Wastage value exceeds safe currency limits");
  }

  // Stock movement, audit entry, and wastage record must succeed or fail together.
  // Otherwise an error could deduct stock without leaving the matching wastage record.
  await db.transaction(
    "rw",
    [db.products, db.shopStock, db.stockMovements, db.auditLog, db.wastage, db.syncQueue],
    async () => {
      await adjustStock({
        productId,
        qty: -Math.abs(qty),
        reason: "wastage",
        note: reason + (note ? ` - ${note}` : ""),
        user,
      });

      const wastageId = await db.wastage.add({
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
      await queueInventoryRow("wastage", wastageId);
    }
  );

  flushInventoryQueue();
  return wastageValue;
}

export async function getWastage({ from, to, shopId = getCurrentShopId() } = {}) {
  const all = await db.wastage.where("shopId").equals(shopId).toArray();
  return all.filter((w) => {
    if (from && w.ts < from) return false;
    if (to && w.ts > to) return false;
    return true;
  });
}

// ============ EXPIRY / BATCHES ============

export async function addBatch({ productId, qty, expiryDate, cost, batchNo, user }) {
  // A batch is an inbound stock movement. Invalid quantities must not create
  // stock, leave zero-quantity batches, or bypass inventory accounting.
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Batch quantity must be a positive finite number");
  }
  if (cost !== undefined && cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    throw new Error("Batch unit cost must be a non-negative finite number");
  }
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  const shopId = getCurrentShopId();

  let batchId;

  // Do not leave a batch record behind if its corresponding stock adjustment fails.
  await db.transaction(
    "rw",
    [db.products, db.batches, db.shopStock, db.stockMovements, db.auditLog, db.syncQueue],
    async () => {
      batchId = await db.batches.add({
        shopId,
        productId,
        productName: product.name,
        qty,
        unit: product.unit,
        expiryDate: expiryDate || null,
        cost: cost ?? product.cost ?? 0,
        batchNo: batchNo || "",
        ts: Date.now(),
        active: true,
      });
      await queueInventoryRow("batches", batchId);

      await adjustStock({
        productId,
        qty,
        reason: "restock",
        note: `Batch ${batchNo || batchId}`,
        cost,
        user,
      });
    }
  );

  flushInventoryQueue();
  return batchId;
}

export async function getExpiringBatches(daysAhead = 3) {
  const now = Date.now();
  const cutoff = now + daysAhead * 24 * 60 * 60 * 1000;
  const all = await db.batches.where("shopId").equals(getCurrentShopId()).toArray();
  return all
    .filter((b) => b.active && b.expiryDate && b.expiryDate <= cutoff && b.qty > 0)
    .sort((a, b) => a.expiryDate - b.expiryDate);
}

export async function getExpiredBatches() {
  const now = Date.now();
  const all = await db.batches.where("shopId").equals(getCurrentShopId()).toArray();
  return all.filter((b) => b.active && b.expiryDate && b.expiryDate < now && b.qty > 0);
}

export async function markBatchExpired(batchId, user) {
  await db.transaction(
    "rw",
    [db.products, db.batches, db.shopStock, db.stockMovements, db.auditLog, db.wastage, db.syncQueue],
    async () => {
      const batch = await db.batches.get(batchId);
      if (!batch || !batch.active || batch.qty <= 0) return;
      if (batch.shopId !== getCurrentShopId()) {
        throw new Error("Cannot expire a batch belonging to another shop");
      }

      await recordWastage({
        productId: batch.productId,
        qty: batch.qty,
        reason: "expired",
        note: `Batch ${batch.batchNo || batchId}`,
        user,
      });

      await db.batches.update(batchId, { active: false, qty: 0 });
      await queueInventoryRow("batches", batchId);
    }
  );
  flushInventoryQueue();
}

// ============ SUPPLIERS ============

export async function addSupplier(supplier) {
  const shopId = getCurrentShopId();
  const { id: _ignoredId, shopId: _ignoredShop, ...details } = supplier || {};
  const id = await db.transaction("rw", [db.suppliers, db.syncQueue], async () => {
    const created = await db.suppliers.add({ ...details, shopId, createdAt: Date.now() });
    await queueInventoryRow("suppliers", created);
    return created;
  });
  flushInventoryQueue();
  return id;
}

export async function updateSupplier(id, data) {
  const shopId = getCurrentShopId();
  const result = await db.transaction("rw", [db.suppliers, db.syncQueue], async () => {
    const supplier = await db.suppliers.get(id);
    if (!supplier || supplier.shopId !== shopId) {
      throw new Error("Supplier not found in the current shop");
    }
    const { id: _ignoredId, shopId: _ignoredShop, ...changes } = data || {};
    const updated = await db.suppliers.update(id, { ...changes, updatedAt: Date.now() });
    await queueInventoryRow("suppliers", id);
    return updated;
  });
  flushInventoryQueue();
  return result;
}

export async function deleteSupplier(id) {
  const shopId = getCurrentShopId();
  const result = await db.transaction("rw", [db.suppliers, db.syncQueue], async () => {
    const supplier = await db.suppliers.get(id);
    if (!supplier || supplier.shopId !== shopId) {
      throw new Error("Supplier not found in the current shop");
    }
    if (isSyncConfigured()) await queueOperation("suppliers", id, "delete");
    return db.suppliers.delete(id);
  });
  flushInventoryQueue();
  return result;
}

export async function getAllSuppliers() {
  return await db.suppliers.where("shopId").equals(getCurrentShopId()).toArray();
}

// ============ PURCHASES ============

export async function recordPurchase({ supplierId, supplierName, items, note, user }) {
  const shopId = getCurrentShopId();
  const total = validatePurchaseItems(items);

  let purchaseId;

  // A purchase affects several tables. Commit the purchase, stock movements, stock
  // balances, product costs, and optional expiry batches as one local transaction.
  // If any line fails validation or a write fails, Dexie rolls back the entire purchase.
  await db.transaction(
    "rw",
    [db.purchases, db.purchaseItems, db.suppliers, db.products, db.batches, db.shopStock, db.stockMovements, db.auditLog, db.syncQueue],
    async () => {
      // A purchase must not link to a supplier belonging to another shop.
      // Verify inside the transaction so a missing or cross-shop supplier
      // cannot be committed into the purchase ledger.
      if (supplierId !== undefined && supplierId !== null && supplierId !== "") {
        const supplier = await db.suppliers.get(supplierId);
        if (!supplier || supplier.shopId !== shopId) {
          throw new Error("Purchase supplier not found in the current shop");
        }
      }

      // Validate every product before writing anything.
      for (const it of items) {
        const product = await db.products.get(it.productId);
        if (!product || product.shopId !== shopId) {
          throw new Error(`Product not found in the selected bakery: ${it.productName || it.productId}`);
        }
      }

      // Resolve the supplier name from the verified local record rather than
      // trusting a caller-supplied label that could misstate the purchase ledger.
      const verifiedSupplier = supplierId !== undefined && supplierId !== null && supplierId !== ""
        ? await db.suppliers.get(supplierId)
        : null;
      const recordedSupplierName = verifiedSupplier?.name || supplierName || "Unknown";

      purchaseId = await db.purchases.add({
        shopId,
        ts: Date.now(),
        supplierId: supplierId ?? null,
        supplierName: recordedSupplierName,
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
      await queueInventoryRow("purchases", purchaseId);

      for (const it of items) {
        const purchaseItemId = await db.purchaseItems.add({
          purchaseId,
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          unit: it.unit,
          cost: it.cost,
          lineTotal: it.qty * it.cost,
        });
        await queueInventoryRow("purchaseItems", purchaseItemId);
        await adjustStock({
          productId: it.productId,
          qty: it.qty,
          reason: "restock",
          note: `Purchase from ${recordedSupplierName}`,
          cost: it.cost,
          user,
        });

        await db.products.update(it.productId, {
          cost: it.cost,
          updatedAt: Date.now(),
        });
        await queueInventoryRow("products", it.productId);

        if (it.expiryDate) {
          const batchId = await db.batches.add({
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
          await queueInventoryRow("batches", batchId);
        }
      }
    }
  );

  flushInventoryQueue();
  return { purchaseId, total };
}

export async function getPurchases({ from, to, supplierId } = {}) {
  const all = await db.purchases.where("shopId").equals(getCurrentShopId()).toArray();
  return all
    .filter((p) => {
      if (from && p.ts < from) return false;
      if (to && p.ts > to) return false;
      if (supplierId && p.supplierId !== supplierId) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts);
}

// ============ STOCK MOVEMENTS ============

export async function getMovements({ productId, from, to, limit = 100 } = {}) {
  const all = await db.stockMovements.where("shopId").equals(getCurrentShopId()).toArray();
  return all
    .filter((m) => {
      if (productId && m.productId !== productId) return false;
      if (from && m.ts < from) return false;
      if (to && m.ts > to) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

// ============ INVENTORY STATS ============

export async function getInventoryStats(shopId = getCurrentShopId()) {
  const [products, stockRows] = await Promise.all([
    db.products.toArray(),
    db.shopStock.where("shopId").equals(shopId).toArray(),
  ]);
  const stockByProduct = new Map(stockRows.map((row) => [row.productId, row]));
  let totalValue = 0;
  let retailValue = 0;
  let lowCount = 0;
  let outCount = 0;

  for (const p of products) {
    if (p.active === false) continue;
    const stockRow = stockByProduct.get(p.id);
    const cost = Number.isFinite(p.cost) ? p.cost : 0;
    const price = Number.isFinite(p.price) ? p.price : 0;
    const stock = Number.isFinite(stockRow?.stock) ? stockRow.stock : 0;
    const lowStock = Number.isFinite(stockRow?.lowStock)
      ? stockRow.lowStock
      : (p.lowStock ?? 5);

    totalValue += cost * stock;
    retailValue += price * stock;

    if (stock === 0) outCount++;
    else if (stock <= lowStock) lowCount++;
  }

  return {
    totalProducts: products.filter((p) => p.active !== false).length,
    totalValue,
    retailValue,
    potentialProfit: retailValue - totalValue,
    lowCount,
    outCount,
  };
}

// ============ PROFIT CALCULATION ============

export async function calculateProfit({ from, to, shopId = getCurrentShopId() } = {}) {
  const [sales, saleItems, products] = await Promise.all([
    db.sales.where("shopId").equals(shopId).toArray(),
    db.saleItems.toArray(),
    db.products.toArray(),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const filteredSales = sales.filter((s) => {
    if (from && s.ts < from) return false;
    if (to && s.ts > to) return false;
    return true;
  });
  const saleById = new Map(filteredSales.map((s) => [s.id, s]));

  // Use the saved sale total so bill-level discounts are reflected in revenue.
  // Store historical item cost at checkout; fall back to today's product cost only for
  // legacy sales that predate that field. Refund rows have negative totals/quantities.
  const revenue = filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  let cost = 0;

  for (const it of saleItems) {
    if (!saleById.has(it.saleId)) continue;
    const product = productById.get(it.productId);
    const unitCost = Number.isFinite(it.cost) ? it.cost : (product?.cost || 0);
    cost += unitCost * (Number(it.qty) || 0);
  }

  const wastage = await getWastage({ from, to, shopId });
  const wastageCost = wastage.reduce((sum, item) => sum + (item.costValue || 0), 0);

  return {
    revenue,
    cost,
    wastageCost,
    grossProfit: revenue - cost,
    netProfit: revenue - cost - wastageCost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
  };
}