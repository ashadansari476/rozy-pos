import { db } from "./db";
import { pushRecord } from "./syncEngine";

// Save a completed sale
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
  const shop = shopId || "rozy";
  const billNo = await nextBillNumber(shop);
  const ts = Date.now();

  const saleId = await db.sales.add({
    shopId: shop,
    billNo,
    counter: shop, // legacy field, kept for compatibility
    cashier,
    ts,
    subtotal,
    discount,
    total,
    payment,
    customer: customer || null,
    customerId: customer?.id || null,
  });

  const saleItems = items.map((it) => ({
    saleId,
    productId: it.id,
    name: it.name,
    unit: it.unit,
    qty: it.qty,
    price: it.price,
    lineTotal: it.qty * it.price,
    variant: it.variant || null,
  }));
  await db.saleItems.bulkAdd(saleItems);

    // Push sale + items to cloud immediately
  pushRecord("sales", {
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
    updatedAt: Date.now(),
    createdAt: Date.now(),
  }).catch(() => {});

  // Push sale items
  for (const it of saleItems) {
    // We don't have auto-generated ids here; push in batch
  }

  // Deduct stock from THIS shop's stock
  for (const it of items) {
    const existing = await db.shopStock
      .where("[shopId+productId]")
      .equals([shop, it.id])
      .first();
    if (existing) {
      await db.shopStock.update(existing.id, {
        stock: Math.max(0, (existing.stock || 0) - it.qty),
      });
    }
  }

  await db.auditLog.add({
    shopId: shop,
    ts,
    user: cashier,
    action: "SALE_CREATED",
    entity: "sale",
    entityId: saleId,
    details: { billNo, total, shopId: shop },
  });

  return { saleId, billNo, ts };
}

  // Trigger near-real-time sync
    import("../stores/syncStore").then(({ useSync }) => {
    useSync.getState().sync();
  }).catch(() => {});

// Generate next bill number for a shop, using its prefix
export async function nextBillNumber(shopId) {
  // find shop prefix
  const shopsRec = await db.settings.get("shops");
  const shop = shopsRec?.value?.find((s) => s.id === shopId);
  const prefix = shop?.billPrefix || (shopId === "rozy" ? "RZ" : "WR");

  const key = `billSeq_${shopId}`;
  const rec = await db.settings.get(key);
  const next = (rec?.value || 0) + 1;
  await db.settings.put({ key, value: next });
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

// Get recent sales for a counter
export async function getRecentSales(counter, limit = 20) {
  let sales = await db.sales.orderBy("ts").reverse().toArray();
  if (counter && counter !== "Both") {
    sales = sales.filter((s) => s.counter === counter);
  }
  return sales.slice(0, limit);
}

// Today's stats for a counter
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
  const cash = sales.reduce((sum, s) => sum + (s.payment?.cash || 0), 0);
  const upi = sales.reduce((sum, s) => sum + (s.payment?.upi || 0), 0);
  const card = sales.reduce((sum, s) => sum + (s.payment?.card || 0), 0);

  return { total, count, cash, upi, card };
}