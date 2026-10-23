import { db, getDeviceTag } from "./db";
import { pushRecord } from "./syncEngine";
import { netCash } from "./money";

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
  for (const item of items) {
    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      throw new Error("Every sale item must have a positive quantity");
    }
    if (!Number.isFinite(item.price) || item.price < 0) {
      throw new Error("Every sale item must have a valid non-negative price");
    }
    if (item.id == null) {
      throw new Error("Every sale item must reference a product");
    }
  }

  const shop = shopId || getCurrentShopId();
  const ts = Date.now();
  const pushes = [];
  let saleId;
  let billNo;

  await db.transaction(
    "rw",
    [db.sales, db.saleItems, db.shopStock, db.stockMovements, db.auditLog, db.settings],
    async () => {
      // Validate all requested quantities before writing the sale. Missing stock rows
      // are treated as zero, not as permission to sell without deducting inventory.
      const requestedByProduct = new Map();
      for (const item of items) {
        requestedByProduct.set(
          item.id,
          (requestedByProduct.get(item.id) || 0) + item.qty
        );
      }
      for (const [productId, requestedQty] of requestedByProduct) {
        const stock = await db.shopStock
          .where("[shopId+productId]")
          .equals([shop, productId])
          .first();
        const available = Number.isFinite(stock?.stock) ? stock.stock : 0;
        if (requestedQty > available) {
          const product = await db.products.get(productId);
          throw new Error(
            `Insufficient stock for ${product?.name || "product"}: ${available} available, ${requestedQty} requested.`
          );
        }
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

      await db.saleItems.bulkAdd(
        items.map((it) => ({
          saleId,
          productId: it.id,
          name: it.name,
          unit: it.unit,
          qty: it.qty,
          price: it.price,
          cost: Number.isFinite(it.cost) ? it.cost : 0,
          lineTotal: it.qty * it.price,
          variant: it.variant || null,
        }))
      );

      pushes.push([
        "sales",
        {
          id: saleId,
          shopId: shop,
          billNo,
          ts,
          cashier,
          subtotal,
          discount,
          tax: 0,
          total,
          payment,
          customerId: customer?.id || null,
          customerName: customer?.name || null,
          customerPhone: customer?.phone || null,
          channel: customer?.channel || "pos",
          source: "pos",
          updatedAt: ts,
          createdAt: ts,
        },
      ]);

      // Deduct stock from THIS shop's shopStock
      for (const it of items) {
        const existing = await db.shopStock
          .where("[shopId+productId]")
          .equals([shop, it.id])
          .first();
        // The transaction preflight above guarantees the row exists and that
        // aggregate requested quantities do not exceed available stock.
        if (!existing) throw new Error("Stock record disappeared during checkout");

        const newStock = (existing.stock || 0) - it.qty;
        await db.shopStock.update(existing.id, { stock: newStock, updatedAt: ts });

        pushes.push([
          "shopStock",
          {
            id: existing.id,
            shopId: shop,
            productId: it.id,
            stock: newStock,
            lowStock: existing.lowStock || 5,
            updatedAt: ts,
          },
        ]);

        await db.stockMovements.add({
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
      }

      await db.auditLog.add({
        shopId: shop,
        ts,
        userName: cashier || "system",
        action: "SALE_CREATED",
        entity: "sale",
        entityId: saleId,
        details: { billNo, total, shopId: shop },
      });
    }
  );

  // Cloud push happens AFTER the local commit; failures are queued by pushRecord.
  for (const [table, record] of pushes) {
    pushRecord(table, record).catch(() => {});
  }

  import("../stores/syncStore")
    .then(({ useSync }) => useSync.getState().sync())
    .catch(() => {});

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