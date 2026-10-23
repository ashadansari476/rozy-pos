import { db } from "./db";

// Helper — get current shop ID
function getCurrentShopId() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

// ============ STOCK ADJUSTMENTS ============

export async function adjustStock({ productId, qty, reason, note, cost, user }) {
  if (!Number.isFinite(qty) || qty === 0) {
    throw new Error("Stock adjustment quantity must be a finite, non-zero number");
  }

  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  const shopId = getCurrentShopId();
  const ts = Date.now();
  let newStock = 0;

  // Stock belongs to a shop, not to the shared product catalogue. Keep the stock
  // update and its movement/audit records atomic so reports cannot show half a change.
  await db.transaction("rw", [db.shopStock, db.stockMovements, db.auditLog], async () => {
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

    await db.stockMovements.add({
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

    await db.auditLog.add({
      shopId,
      ts,
      userName: user || "system",
      action: "STOCK_ADJUSTED",
      entity: "product",
      entityId: productId,
      details: { qty, reason, note, newStock },
    });
  });

  return newStock;
}
// ============ WASTAGE ============

export async function recordWastage({ productId, qty, reason, note, user }) {
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Wastage quantity must be a positive number");
  }

  const shopId = getCurrentShopId();
  const cost = product.cost || 0;
  const wastageValue = cost * qty;

  // Stock movement, audit entry, and wastage record must succeed or fail together.
  // Otherwise an error could deduct stock without leaving the matching wastage record.
  await db.transaction(
    "rw",
    [db.shopStock, db.stockMovements, db.auditLog, db.wastage],
    async () => {
      await adjustStock({
        productId,
        qty: -Math.abs(qty),
        reason: "wastage",
        note: reason + (note ? ` - ${note}` : ""),
        user,
      });

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
  const product = await db.products.get(productId);
  if (!product) throw new Error("Product not found");

  const shopId = getCurrentShopId();

  let batchId;

  // Do not leave a batch record behind if its corresponding stock adjustment fails.
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
  return await db.suppliers.where("shopId").equals(getCurrentShopId()).toArray();
}

// ============ PURCHASES ============

export async function recordPurchase({ supplierId, supplierName, items, note, user }) {
  const shopId = getCurrentShopId();
  const total = items.reduce((s, it) => s + it.qty * it.cost, 0);

  let purchaseId;

  // A purchase affects several tables. Commit the purchase, stock movements, stock
  // balances, product costs, and optional expiry batches as one local transaction.
  // If any line fails validation or a write fails, Dexie rolls back the entire purchase.
  await db.transaction(
    "rw",
    [db.purchases, db.products, db.batches, db.shopStock, db.stockMovements, db.auditLog],
    async () => {
      // Validate every product before writing anything.
      for (const it of items) {
        if (!Number.isFinite(it.qty) || it.qty <= 0) {
          throw new Error("Purchase quantities must be positive numbers");
        }
        if (!Number.isFinite(it.cost) || it.cost < 0) {
          throw new Error("Purchase costs must be valid non-negative numbers");
        }
        if (!await db.products.get(it.productId)) {
          throw new Error(`Product not found: ${it.productName || it.productId}`);
        }
      }

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
        await adjustStock({
          productId: it.productId,
          qty: it.qty,
          reason: "restock",
          note: `Purchase from ${supplierName || "supplier"}`,
          cost: it.cost,
          user,
        });

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