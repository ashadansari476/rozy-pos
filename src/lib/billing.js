import { db, getDeviceTag } from "./db";
import { isSyncConfigured, processQueue, queueOperation } from "./syncEngine";
import { netCash } from "./money";
import { validateSaleItems, remainingStockAfterSale, assertSaleProductShop } from "./saleRules";

// Helper — get current shop ID
function getCurrentShopId() {
  return localStorage.getItem("rozy-pos-current-shop") || "rozy";
}

// ============ SAVE SALE ============
// All local writes happen inside ONE database transaction, so a crash, a closed tab or a
// dead battery can never leave a bill without its items, a used bill number with no sale,
// or stock deducted for a sale that was not saved. Cloud pushes happen after it commits.

export async function saveSale({
  shopId,
  cashier,
  items,
  subtotal,
  discount,
  total,
  payment,
  customer,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cannot save an empty bill");
  }
  if (!Number.isFinite(total) || total < 0) {
    throw new Error("Invalid bill total");
  }
  validateSaleItems(items);

  const shop = shopId || getCurrentShopId();
  const ts = Date.now();
  const shouldSync = isSyncConfigured();
  let saleId;
  let billNo;

  await db.transaction(
    "rw",
    [db.sales, db.saleItems, db.products, db.shopStock, db.stockMovements, db.auditLog, db.settings, db.syncQueue],
    async () => {
      // Verify product ownership before creating any sale or decrementing stock.
      for (const it of items) {
        assertSaleProductShop(await db.products.get(it.id), shop);
      }
      billNo = await nextBillNumber(shop);

      saleId = await db.sales.add({
        shopId: shop,
        billNo,
        counter: shop,
        cashier,
        ts,
        subtotal,
        discount,
        total,
        payment,
        customer: customer || null,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        customerPhone: customer?.phone || null,
        channel: customer?.channel || "pos",
        source: "pos",
        tax: 0,
        updatedAt: ts,
      });

      if (shouldSync) await queueOperation("sales", saleId, "upsert", await db.sales.get(saleId));
      for (const it of items) {
        const item = { saleId, productId: it.id, name: it.name, unit: it.unit, qty: it.qty, price: it.price, cost: it.cost ?? 0, lineTotal: it.qty * it.price, variant: it.variant || null };
        const itemId = await db.saleItems.add(item);
        if (shouldSync) await queueOperation("saleItems", itemId, "upsert", { ...item, id: itemId });
      }

      // Deduct stock from THIS shop's shopStock
      for (const it of items) {
        const existing = await db.shopStock
          .where("[shopId+productId]")
          .equals([shop, it.id])
          .first();
        if (!existing) throw new Error(`Missing stock record for product ${it.id} in ${shop}`);

        const newStock = remainingStockAfterSale(existing.stock ?? 0, it.qty);
        await db.shopStock.update(existing.id, { stock: newStock, updatedAt: ts });

        if (shouldSync) await queueOperation("shopStock", existing.id, "upsert", await db.shopStock.get(existing.id));

        const movementId = await db.stockMovements.add({
          shopId: shop,
          ts,
          productId: it.id,
          productName: it.name,
          qty: -it.qty,
          unit: it.unit,
          reason: "sale",
          note: `Sale ${billNo}`,
          cost: it.cost || 0,
          userName: cashier || "system",
          balanceAfter: newStock,
        });
        if (shouldSync) await queueOperation("stockMovements", movementId, "upsert", await db.stockMovements.get(movementId));
      }

      const auditId = await db.auditLog.add({
        shopId: shop,
        ts,
        userName: cashier || "system",
        action: "SALE_CREATED",
        entity: "sale",
        entityId: saleId,
        details: { billNo, total, shopId: shop },
      });
      if (shouldSync) await queueOperation("auditLog", auditId, "upsert", await db.auditLog.get(auditId));
    }
  );

  // Queue intents committed atomically with sale; network starts after commit.
  if (shouldSync) processQueue().catch((error) => console.error("Sale cloud sync remains queued", error));

  // Offline checkouts remain local and queued; connectivity restoration triggers sync.
  if (typeof navigator !== "undefined" && navigator.onLine) {
    import("../stores/syncStore")
      .then(({ useSync }) => useSync.getState().sync())
      .catch(() => {});
  }

  return { saleId, billNo, ts };
}

// ============ BILL NUMBER ============

export async function nextBillNumber(shopId) {
  const shopsRec = await db.settings.get("shops");
  const shop = shopsRec?.value?.find((s) => s.id === shopId);
  const prefix = shop?.billPrefix || (shopId === "rozy" ? "RZ" : "WR");

  const key = `billSeq_${shopId}`;
  const rec = await db.settings.get(key);
  const next = (rec?.value || 0) + 1;
  await db.settings.put({ key, value: next });
  return `${prefix}-${getDeviceTag()}-${String(next).padStart(4, "0")}`;
}

// ============ STATS ============

export async function getRecentSales(counter, limit = 20) {
  let sales = await db.sales.orderBy("ts").reverse().toArray();
  if (counter && counter !== "Both") {
    sales = sales.filter((s) => s.counter === counter);
  }
  return sales.slice(0, limit);
}

export async function getTodayStats(counter) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();

  const all = await db.sales.where("ts").aboveOrEqual(startTs).toArray();
  const sales = counter && counter !== "Both"
    ? all.filter((s) => s.counter === counter)
    : all;

  const total = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const count = sales.length;
  const cash = sales.reduce((sum, s) => sum + netCash(s), 0);
  const upi = sales.reduce((sum, s) => sum + (s.payment?.upi || 0), 0);
  const card = sales.reduce((sum, s) => sum + (s.payment?.card || 0), 0);

  return { total, count, cash, upi, card };
}